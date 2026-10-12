import { applyMapping, contentHash, MappingError, parseMapping } from "@rupa/mapping-dsl";
import type { JsonObject, Mapping } from "@rupa/mapping-dsl";
import { RupaError } from "@rupa/sdk";
import type { LoadedAsset } from "@rupa/sdk";
import type { Hex } from "viem";
import type { Publisher, RuleProvider, RuleRequest } from "./provider.js";
import { RateLimiter } from "./limits.js";

export type Proposal = { mappingId: Hex; contentURI: string; txHash: Hex | null; reused: boolean };
export interface TranslationChain {
  source(id: bigint): Promise<LoadedAsset>;
  target(id: number): Promise<{ schema: JsonObject; version: bigint }>;
  cached(type: Hex, target: number, version: bigint, candidate?: Proposal): Promise<Proposal | undefined>;
  validateCached(proposal: Proposal, asset: LoadedAsset, target: number): Promise<void>;
  propose(mapping: Mapping, content: { uri: string; hash: Hex }): Promise<Proposal>;
}
export function createTranslator(options: { chain: TranslationChain; provider: RuleProvider; publish: Publisher; types: Readonly<Record<string, string>>; namespace: string }) {
  const pending = new Map<string, Promise<Proposal>>(), cache = new Map<string, Proposal>();
  const rate = new RateLimiter();
  const stats = { requests: 0, generated: 0, reused: 0 };
  function remember(pair: string, proposal: Proposal) {
    if (cache.size >= 256 && !cache.has(pair)) cache.delete(cache.keys().next().value!);
    cache.set(pair, proposal);
  }
  async function translate(assetId: bigint, targetAppId: number): Promise<Proposal> {
    stats.requests++;
    const asset = await options.chain.source(assetId), target = await options.chain.target(targetAppId);
    const assetType = options.types[asset.base.assetType.toLowerCase()];
    if (!assetType) throw new RupaError("UNSUPPORTED_ASSET", "This agent does not support the source asset type.");
    const version = Number(target.version);
    if (!Number.isSafeInteger(version) || version < 1) throw new RupaError("MAPPING_REJECTED", "Schema version is outside DSL v1's safe integer range.");
    const pair = `${options.namespace}:${asset.base.assetType}:${targetAppId}:${version}`;
    const cached = await options.chain.cached(asset.base.assetType, targetAppId, target.version, cache.get(pair));
    if (cached) { await options.chain.validateCached(cached, asset, targetAppId); remember(pair, cached); stats.reused++; return { ...cached, reused: true }; }
    const existing = pending.get(pair);
    if (existing) { const proposal = await existing; await options.chain.validateCached(proposal, asset, targetAppId); stats.reused++; return { ...proposal, reused: true }; }
    // Do not author a new rule from an incomplete history (agent win index still warming after a cold start).
    if (asset.winsPending) throw new RupaError("DEPENDENCY_UNAVAILABLE", "Asset history is still loading. Retry in a few seconds.");
    if (pending.size >= 4) throw new RupaError("RATE_LIMITED", "Translation capacity reached.");
    rate.take(asset.base.assetType, 6, 60_000);
    const task = (async () => {
      const name = asset.attrs.name, element = asset.attrs.element;
      if (typeof name !== "string" || name.length > 128 || typeof element !== "string" || element.length > 32) throw new RupaError("MAPPING_REJECTED", "Source public attributes do not match the supported profile.");
      const request: RuleRequest = { assetType, targetAppId, targetSchemaVersion: version, schema: target.schema, source: { base: { rarity: asset.base.rarity }, attrs: { name, element }, history: asset.context.history }, feedback: "" };
      let mapping: Mapping | undefined, unavailable = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          stats.generated++;
          const proposed = parseMapping(await options.provider(request));
          if (proposed.assetType !== assetType || proposed.targetAppId !== targetAppId || proposed.targetSchemaVersion !== version) throw new RupaError("MAPPING_REJECTED", "Model changed mapping metadata.");
          const samples = [request.source, ...[0, 2, 4].map(rarity => ({ base: { rarity }, attrs: { name: "Sample relic", element: "unknown" }, history: { wins: rarity * 10 } }))];
          for (const sample of samples) applyMapping(proposed, sample, target.schema);
          mapping = proposed; break;
        } catch (error) {
          // Bounded: one extra provider round for transient outages, without consuming a validation attempt.
          if (error instanceof RupaError && error.code === "DEPENDENCY_UNAVAILABLE") { if (++unavailable > 1) throw error; attempt--; continue; }
          request.feedback = error instanceof MappingError ? `${error.code}: ${error.message}` : "Return a reusable rule satisfying the supplied schema and metadata.";
        }
      }
      if (!mapping) throw new RupaError("MAPPING_REJECTED", "No valid mapping after three attempts. Nothing was signed.");
      if ((await options.chain.target(targetAppId)).version !== target.version) throw new RupaError("SCHEMA_OUTDATED", "Target schema changed during generation.");
      const published = await options.publish(mapping);
      if (published.hash.toLowerCase() !== contentHash(mapping).toLowerCase()) throw new RupaError("CONTENT_HASH_MISMATCH", "Publisher hash differs from validated content.");
      const proposal = await options.chain.propose(mapping, published);
      remember(pair, proposal);
      return proposal;
    })();
    pending.set(pair, task);
    try { return await task; } finally { pending.delete(pair); }
  }
  return { translate, stats };
}
