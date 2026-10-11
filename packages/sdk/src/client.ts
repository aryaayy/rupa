import { applyMapping, contentHash, MappingError, object, parseJson, parseMapping } from "@rupa/mapping-dsl";
import type { JsonObject } from "@rupa/mapping-dsl";
import { BaseError, ContractFunctionRevertedError, encodeAbiParameters, isAddress, keccak256, parseEventLogs, sha256, toBytes, zeroHash } from "viem";
import type { Abi, Address, Hex, TransactionReceipt } from "viem";
import { appRegistryAbi, mappingRegistryAbi, passkeyApproverAbi, portLedgerAbi, rupaAssetAbi } from "./abis.js";
import { approvalHash } from "./approval.js";
import { boundedText, createContentReader } from "./content.js";
import { monadTestnetDeployment } from "./deployment.js";
import { RupaError } from "./errors.js";
import type { RupaErrorCode } from "./errors.js";
import { createPasskey, requestAssertion } from "./passkey.js";
import type { RegisteredPasskey } from "./passkey.js";
import { verifyProvenance } from "./provenance.js";
import type { LoadedAsset, MappingData, PortOptions, ProvenanceRecord, RupaAssetView, RupaConfig } from "./types.js";

type Snapshot = { number: bigint; hash: Hex; timestamp: bigint };
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function mappingPairKey(assetType: Hex, appId: number): Hex {
  return keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint32" }], [assetType, appId]));
}
export function mappingId(assetType: Hex, appId: number, version: bigint, hash: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint32" }, { type: "uint64" }, { type: "bytes32" }], [assetType, appId, version, hash]));
}
function appId(value: number | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1 || value > 0xffffffff) throw new RupaError("INVALID_REQUEST", "A valid target app ID is required.");
  return value;
}
function assetId(value: bigint): bigint {
  if (typeof value !== "bigint" || value < 1n || value >= 1n << 256n) throw new RupaError("INVALID_REQUEST", "Invalid asset ID.");
  return value;
}
function errorOf(error: unknown): RupaError {
  if (error instanceof RupaError) return error;
  if (error instanceof MappingError) return new RupaError("MAPPING_REJECTED", error.message);
  if (error instanceof BaseError) {
    const revert = error.walk(item => item instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const codes: Record<string, RupaErrorCode> = { NoPasskey: "NO_PASSKEY", SchemaOutdated: "SCHEMA_OUTDATED", InvalidMapping: "INVALID_MAPPING", DeadlineExpired: "DEADLINE_EXPIRED", ERC721NonexistentToken: "ASSET_NOT_FOUND", UnknownApp: "APP_NOT_FOUND", InvalidAssertion: "INVALID_ASSERTION" };
      const code = codes[revert.data?.errorName ?? ""] ?? "TX_REVERTED";
      return new RupaError(code, `Contract rejected the request (${code}).`);
    }
  }
  return new RupaError("RPC_ERROR", "Unable to complete the chain request. Retry after checking the connection.");
}
const safe = async <T>(action: () => Promise<T>): Promise<T> => { try { return await action(); } catch (error) { throw errorOf(error); } };

export function createRupa(config: RupaConfig) {
  const client = config.publicClient;
  const deployment = config.deployment ?? monadTestnetDeployment;
  const addresses = deployment.contracts;
  const fetcher = config.fetch ?? globalThis.fetch;
  const readContent = config.content ?? createContentReader({ fetch: fetcher, ...(config.contentOrigins ? { allowedOrigins: config.contentOrigins } : {}), ...(config.ipfsGateway ? { gateway: config.ipfsGateway } : {}) });
  const content = async (uri: string, hash: Hex) => {
    const value = await readContent(uri, hash);
    if (!equal(contentHash(value), hash)) throw new RupaError("CONTENT_HASH_MISMATCH", "Content adapter returned data with a different hash.");
    return value;
  };
  const webauthn = config.webauthn ?? { create: createPasskey, get: requestAssertion };
  // Monad's public RPC rejects eth_getLogs spans above 100 blocks (-32614).
  const range = config.logRange ?? 100n;
  if (range < 1n || range > 50_000n || !Number.isSafeInteger(deployment.chainId) || Object.values(addresses).some(address => !isAddress(address))) throw new RupaError("INVALID_REQUEST", "Invalid chain, contract address, or log range.");
  let firstBlock: bigint | undefined = deployment.deploymentBlock == null ? undefined : BigInt(deployment.deploymentBlock);
  if (firstBlock !== undefined && firstBlock < 0n) throw new RupaError("INVALID_REQUEST", "Invalid deployment block.");

  async function snapshot(): Promise<Snapshot> {
    if (await client.getChainId() !== deployment.chainId) throw new RupaError("WRONG_CHAIN", "RPC is connected to the wrong chain.");
    const block = await client.getBlock({ blockTag: "latest" });
    return { number: block.number, hash: block.hash, timestamp: block.timestamp };
  }
  async function consistent(s: Snapshot) {
    if ((await client.getBlock({ blockNumber: s.number })).hash !== s.hash) throw new RupaError("RPC_ERROR", "Chain reorganized during the read. Refresh and retry.");
  }
  async function startBlock(tip: bigint): Promise<bigint> {
    if (firstBlock !== undefined) return firstBlock;
    // The supplied live manifest has no receipt block. Find creation once instead of scanning from genesis.
    const deployedCode = await client.getBytecode({ address: addresses.RupaAsset, blockNumber: tip });
    if (!deployedCode || deployedCode === "0x") throw new RupaError("INVALID_REQUEST", "Asset contract is absent from this chain.");
    let low = 0n, high = tip;
    while (low < high) {
      const mid = (low + high) / 2n;
      const code = await client.getBytecode({ address: addresses.RupaAsset, blockNumber: mid });
      if (code && code !== "0x") high = mid; else low = mid + 1n;
    }
    firstBlock = low;
    return low;
  }
  async function scan<T extends { blockNumber: bigint | null; logIndex: number | null; blockHash: Hex | null; removed: boolean }>(tip: bigint, request: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>): Promise<T[]> {
    const found: T[] = [];
    const chunks: [bigint, bigint][] = [];
    for (let from = await startBlock(tip); from <= tip; from += range) chunks.push([from, from + range - 1n > tip ? tip : from + range - 1n]);
    // Small fixed concurrency keeps 100-block scans fast without tripping public RPC rate limits.
    for (let i = 0; i < chunks.length; i += 4) for (const logs of await Promise.all(chunks.slice(i, i + 4).map(([from, to]) => request(from, to)))) found.push(...logs);
    if (found.some(log => log.removed || log.blockNumber === null || log.blockHash === null || log.logIndex === null)) throw new RupaError("PROVENANCE_INVALID", "Incomplete or removed event log.");
    const unique = [...new Map(found.map(log => [`${log.blockHash}:${log.logIndex}`, log])).values()];
    return unique.sort((a, b) => a.blockNumber! < b.blockNumber! ? -1 : a.blockNumber! > b.blockNumber! ? 1 : a.logIndex! - b.logIndex!);
  }
  const readApp = (id: number, at: bigint) => client.readContract({ address: addresses.AppRegistry, abi: appRegistryAbi, functionName: "getApp", args: [appId(id)], blockNumber: at });
  const readMapping = (id: Hex, at: bigint): Promise<MappingData> => client.readContract({ address: addresses.MappingRegistry, abi: mappingRegistryAbi, functionName: "mappings", args: [id], blockNumber: at });
  async function appSchema(id: number, at: bigint) {
    const app = await readApp(id, at);
    return { app, schema: await content(app.schemaURI, app.schemaHash) };
  }
  async function source(id: bigint, s: Snapshot): Promise<LoadedAsset> {
    assetId(id);
    const base = await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "getBase", args: [id], blockNumber: s.number });
    const owner = await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "ownerOfAsset", args: [id], blockNumber: s.number });
    const uri = await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "tokenURI", args: [id], blockNumber: s.number });
    const attrs = await content(uri, base.attrsHash);
    const wins = await scan(s.number, (fromBlock, toBlock) => client.getContractEvents({ address: addresses.PortLedger, abi: portLedgerAbi, eventName: "Used", args: { assetId: id, appId: base.originAppId }, fromBlock, toBlock, strict: true }));
    return { base, owner, attrs, context: { base: { rarity: base.rarity }, attrs, history: { wins: wins.filter(log => equal(log.args.actionTag, keccak256(toBytes("WIN")))).length } } };
  }
  async function provenance(id: bigint, s: Snapshot): Promise<ProvenanceRecord[]> {
    assetId(id);
    await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "getBase", args: [id], blockNumber: s.number });
    const logs = await scan(s.number, (fromBlock, toBlock) => client.getContractEvents({ address: addresses.PortLedger, abi: portLedgerAbi, eventName: "Ported", args: { assetId: id }, fromBlock, toBlock, strict: true }));
    const records: ProvenanceRecord[] = [];
    const timestamps = new Map<Hex, bigint>();
    for (const log of logs) {
      if (!timestamps.has(log.blockHash!)) timestamps.set(log.blockHash!, (await client.getBlock({ blockHash: log.blockHash! })).timestamp);
      const mapping = await readMapping(log.args.mappingId, s.number);
      records.push({ ...log.args, at: timestamps.get(log.blockHash!)!, blockNumber: log.blockNumber!, transactionHash: log.transactionHash!, mappingSchemaVersion: mapping.targetSchemaVersion });
    }
    const head = await client.readContract({ address: addresses.PortLedger, abi: portLedgerAbi, functionName: "headOf", args: [id], blockNumber: s.number });
    verifyProvenance(records, head, id);
    return records;
  }
  async function usable(id: Hex, type: Hex, target: number, version: bigint, at: bigint) {
    if (id === zeroHash) return false;
    const mapping = await readMapping(id, at);
    return !mapping.revoked && mapping.targetSchemaVersion === version && mapping.targetAppId === target && equal(mapping.assetType, type);
  }
  async function view(id: Hex, asset: LoadedAsset, target: number, s: Snapshot) {
    const data = await readMapping(id, s.number);
    const { app, schema } = await appSchema(target, s.number);
    if (data.targetSchemaVersion !== app.version) throw new RupaError("SCHEMA_OUTDATED", "Target schema changed; refresh the mapping.");
    if (data.revoked || data.targetAppId !== target || !equal(data.assetType, asset.base.assetType)) throw new RupaError("INVALID_MAPPING", "Mapping is revoked or belongs to a different asset type or app.");
    const rules = parseMapping(await content(data.contentURI, data.contentHash));
    if (!equal(keccak256(toBytes(rules.assetType)), data.assetType) || rules.targetAppId !== target || BigInt(rules.targetSchemaVersion) !== data.targetSchemaVersion || !equal(mappingId(data.assetType, target, data.targetSchemaVersion, data.contentHash), id)) throw new RupaError("INVALID_MAPPING", "Mapping content does not match its registry entry.");
    return { data, view: applyMapping(rules, asset.context, schema) };
  }

  async function getAssetsFor(owner: Address, targetAppId = config.appId): Promise<RupaAssetView[]> {
    return safe(async () => {
      if (!isAddress(owner)) throw new RupaError("INVALID_REQUEST", "Invalid owner address.");
      const target = appId(targetAppId), s = await snapshot(), app = await readApp(target, s.number);
      const incoming = await scan(s.number, (fromBlock, toBlock) => client.getContractEvents({ address: addresses.RupaAsset, abi: rupaAssetAbi, eventName: "Transfer", args: { to: owner }, fromBlock, toBlock, strict: true }));
      const result: RupaAssetView[] = [];
      for (const id of new Set(incoming.map(log => log.args.tokenId))) {
        const currentOwner = await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "ownerOfAsset", args: [id], blockNumber: s.number });
        if (!equal(currentOwner, owner)) continue;
        const asset = await source(id, s), history = await provenance(id, s);
        const item: RupaAssetView = { assetId: id, base: asset.base, attrs: asset.attrs, origin: { appId: asset.base.originAppId }, provenance: history, status: "portable" };
        if (asset.base.originAppId === target) { result.push({ ...item, status: "active", view: asset.attrs }); continue; }
        const activation = await client.readContract({ address: addresses.PortLedger, abi: portLedgerAbi, functionName: "activeIn", args: [id, target], blockNumber: s.number });
        const active = await usable(activation, asset.base.assetType, target, app.version, s.number);
        const selected = active ? activation : await client.readContract({ address: addresses.MappingRegistry, abi: mappingRegistryAbi, functionName: "activeMapping", args: [mappingPairKey(asset.base.assetType, target)], blockNumber: s.number });
        if (await usable(selected, asset.base.assetType, target, app.version, s.number)) {
          const mapped = await view(selected, asset, target, s);
          item.view = mapped.view;
          item.mapping = { id: selected, schemaVersion: mapped.data.targetSchemaVersion, agentId: mapped.data.agentId };
          if (active) {
            const record = [...history].reverse().find(record => record.toAppId === target && equal(record.mappingId, activation));
            if (!record) throw new RupaError("PROVENANCE_INVALID", "Activation has no verified approval record.");
            item.status = "active";
            item.activation = { mappingId: activation, approver: record.approver, approvedByPreviousOwner: !equal(record.approver, owner) };
          }
        } else if (!config.agentUrl || (config.supportedAssetTypes && !config.supportedAssetTypes.some(type => equal(type, asset.base.assetType)))) {
          item.status = "unsupported"; item.reason = "No usable mapping or configured agent for this type.";
        } else if (activation !== zeroHash) item.reason = "Previous activation is revoked or uses an older schema; approval is needed again.";
        result.push(item);
      }
      await consistent(s);
      return result;
    });
  }
  function wallet() {
    const value = config.walletClient;
    if (!value?.account) throw new RupaError("NO_WALLET", "Connect a wallet before submitting a transaction.");
    return { client: value, account: value.account };
  }
  const notify = (options: PortOptions, step: Parameters<NonNullable<PortOptions["onStep"]>>[0], hash?: Hex) => {
    // Progress observers cannot turn a submitted transaction into a misleading failure.
    try { options.onStep?.(step, hash ? { txHash: hash } : undefined); } catch { /* Consumer observer only. */ }
  };
  async function submit(address: Address, abi: Abi, functionName: string, args: readonly unknown[], value = 0n, options: PortOptions = {}): Promise<TransactionReceipt> {
    const w = wallet();
    if (await w.client.getChainId() !== deployment.chainId) throw new RupaError("WRONG_CHAIN", "Wallet is connected to the wrong chain.");
    const { request } = await client.simulateContract({ address, abi, functionName, args, value, account: w.account });
    const hash = await w.client.writeContract({ ...request, chain: w.client.chain ?? null });
    notify(options, "tx:sent", hash);
    let receipt: TransactionReceipt;
    try { receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 }); }
    catch { throw new RupaError("TX_STATUS_UNKNOWN", "Transaction was submitted but confirmation is not known. Check the hash before retrying.", { txHash: hash }); }
    if (receipt.status !== "success") throw new RupaError("TX_REVERTED", "Transaction reverted.", { txHash: hash });
    return receipt;
  }
  async function passkeyConfig(s: Snapshot) {
    const [rpHash, origin] = await Promise.all([
      client.readContract({ address: addresses.PasskeyApprover, abi: passkeyApproverAbi, functionName: "RP_ID_HASH", blockNumber: s.number }),
      client.readContract({ address: addresses.PasskeyApprover, abi: passkeyApproverAbi, functionName: "allowedOrigin", blockNumber: s.number }),
    ]);
    if (!equal(rpHash, sha256(toBytes(deployment.rpId))) || origin !== deployment.origin || (typeof location !== "undefined" && location.origin !== origin)) throw new RupaError("WRONG_ORIGIN", `Use ${deployment.origin} for this deployment's passkey.`);
  }
  async function registerPasskey(rotate = false): Promise<RegisteredPasskey> {
    return safe(async () => {
      const s = await snapshot(); await passkeyConfig(s);
      const w = wallet();
      const key = await webauthn.create({ rpId: deployment.rpId, owner: w.account.address });
      await submit(addresses.PasskeyApprover, passkeyApproverAbi, rotate ? "rotatePasskey" : "registerPasskey", [key.qx, key.qy, key.credIdHash]);
      return key;
    });
  }
  async function port(id: bigint, targetAppId: number, key: RegisteredPasskey, options: PortOptions = {}) {
    return safe(async () => {
      assetId(id); const target = appId(targetAppId), w = wallet();
      let s = await snapshot(); await passkeyConfig(s);
      let asset = await source(id, s);
      if (!equal(asset.owner, w.account.address)) throw new RupaError("NOT_OWNER", "The connected wallet no longer owns this asset.");
      const registered = await client.readContract({ address: addresses.PasskeyApprover, abi: passkeyApproverAbi, functionName: "keyOf", args: [asset.owner], blockNumber: s.number });
      if (!key || !equal(registered[2], key.credIdHash) || registered[0] !== key.qx || registered[1] !== key.qy || !equal(keccak256(key.credentialId), key.credIdHash)) throw new RupaError("NO_PASSKEY", "This credential is not registered for the asset owner.");
      const app = await readApp(target, s.number);
      let selected = await client.readContract({ address: addresses.MappingRegistry, abi: mappingRegistryAbi, functionName: "activeMapping", args: [mappingPairKey(asset.base.assetType, target)], blockNumber: s.number });
      if (await usable(selected, asset.base.assetType, target, app.version, s.number)) notify(options, "mapping:cached");
      else {
        if (!config.agentUrl) throw new RupaError("UNSUPPORTED_ASSET", "Configure an agent to request a new mapping.");
        notify(options, "mapping:requesting");
        const response = await fetcher(`${config.agentUrl.replace(/\/$/, "")}/translate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId: id.toString(), targetAppId: target }), redirect: "error", signal: AbortSignal.timeout(60_000) });
        if (!response.ok) {
          let failure: unknown;
          try { failure = parseJson(await boundedText(new Response(response.body, { headers: response.headers }))); } catch { /* Malformed error bodies use the HTTP fallback. */ }
          const error = object(failure) && object(failure.error) ? failure.error : undefined;
          const allowed: readonly RupaErrorCode[] = ["TX_STATUS_UNKNOWN", "TX_REVERTED", "SCHEMA_OUTDATED", "MAPPING_REJECTED", "UNSUPPORTED_ASSET", "RATE_LIMITED", "INVALID_REQUEST"];
          const code: RupaErrorCode = error && typeof error.code === "string" && allowed.includes(error.code as RupaErrorCode) ? error.code as RupaErrorCode : response.status === 429 ? "RATE_LIMITED" : response.status === 422 ? "MAPPING_REJECTED" : "DEPENDENCY_UNAVAILABLE";
          const txHash = error && typeof error.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(error.txHash) ? error.txHash as Hex : undefined;
          throw new RupaError(code, "The mapping agent could not complete this request. Inspect any submitted transaction before retrying.", txHash ? { txHash } : undefined);
        }
        const data = parseJson(await boundedText(response));
        if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.mappingId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(data.mappingId)) throw new RupaError("MAPPING_REJECTED", "Agent returned an invalid proposal ID.");
        selected = data.mappingId as Hex;
        s = await snapshot(); asset = await source(id, s);
      }
      const mapped = await view(selected, asset, target, s);
      const fee = await client.readContract({ address: addresses.PortLedger, abi: portLedgerAbi, functionName: "PORT_FEE", blockNumber: s.number });
      if (options.onReview && !await options.onReview({ assetId: id, targetAppId: target, mappingId: selected, agentId: mapped.data.agentId, schemaVersion: mapped.data.targetSchemaVersion, fee, view: mapped.view })) throw new RupaError("APPROVAL_CANCELLED", "Port cancelled before passkey approval.");
      // Refresh after a potentially long mapping request/review. Never sign stale review data.
      s = await snapshot();
      const owner = await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "ownerOfAsset", args: [id], blockNumber: s.number });
      if (!equal(owner, w.account.address)) throw new RupaError("NOT_OWNER", "Ownership changed before approval.");
      if ((await readApp(target, s.number)).version !== mapped.data.targetSchemaVersion || !await usable(selected, asset.base.assetType, target, mapped.data.targetSchemaVersion, s.number)) throw new RupaError("SCHEMA_OUTDATED", "Mapping changed during review. Refresh and review again.");
      const nonce = await client.readContract({ address: addresses.PasskeyApprover, abi: passkeyApproverAbi, functionName: "nonces", args: [owner], blockNumber: s.number });
      const deadline = s.timestamp + 300n;
      const challenge = approvalHash({ chainId: BigInt(deployment.chainId), ledger: addresses.PortLedger, owner, assetId: id, targetAppId: target, mappingId: selected, nonce, deadline });
      notify(options, "passkey:prompt");
      // Fallback for older deployments that reject Chromium's extra clientDataJSON keys; bounded retries.
      let assertion: Awaited<ReturnType<typeof webauthn.get>> | undefined;
      for (let attempt = 0; !assertion; attempt++) {
        try { assertion = await webauthn.get({ challenge, rpId: deployment.rpId, origin: deployment.origin, credentialId: key.credentialId }); }
        catch (error) { if (!(error instanceof RupaError) || error.code !== "UNSUPPORTED_CLIENT_DATA" || attempt >= 2) throw error; }
      }
      const latest = await snapshot();
      if (latest.timestamp > deadline) throw new RupaError("DEADLINE_EXPIRED", "Passkey approval expired. Request a new approval.");
      if (await client.readContract({ address: addresses.PasskeyApprover, abi: passkeyApproverAbi, functionName: "nonces", args: [owner], blockNumber: latest.number }) !== nonce) throw new RupaError("NONCE_CHANGED", "Another approval or key rotation changed the nonce.");
      if (!equal(await client.readContract({ address: addresses.RupaAsset, abi: rupaAssetAbi, functionName: "ownerOfAsset", args: [id], blockNumber: latest.number }), owner)) throw new RupaError("NOT_OWNER", "Ownership changed during approval.");
      if (!await usable(selected, asset.base.assetType, target, (await readApp(target, latest.number)).version, latest.number)) throw new RupaError("SCHEMA_OUTDATED", "Mapping became stale or revoked during approval.");
      const receipt = await submit(addresses.PortLedger, portLedgerAbi, "port", [id, target, selected, deadline, assertion], fee, options);
      const record = parseEventLogs({ abi: portLedgerAbi, eventName: "Ported", logs: receipt.logs.filter(log => equal(log.address, addresses.PortLedger)), strict: true }).find(log => log.args.assetId === id && equal(log.args.mappingId, selected) && log.args.toAppId === target);
      if (!record) throw new RupaError("PROVENANCE_INVALID", "Receipt has no matching port event.", { txHash: receipt.transactionHash });
      notify(options, "tx:confirmed", receipt.transactionHash);
      return { txHash: receipt.transactionHash, recordId: record.args.recordId, mappingId: selected };
    });
  }
  return {
    getAssetsFor, port,
    getProvenance: (id: bigint) => safe(async () => { const s = await snapshot(); const result = await provenance(id, s); await consistent(s); return result; }),
    getSourceAsset: (id: bigint) => safe(async () => { const s = await snapshot(); const result = await source(id, s); await consistent(s); return result; }),
    getAppSchema: (id: number) => safe(async () => { const s = await snapshot(); const result = await appSchema(id, s.number); await consistent(s); return result; }),
    passkey: { register: () => registerPasskey(), rotate: () => registerPasskey(true) },
    applyMapping,
  };
}
