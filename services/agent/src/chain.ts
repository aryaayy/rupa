import { applyMapping, parseMapping } from "@rupa/mapping-dsl";
import { appRegistryAbi, createContentReader, createRupa, mappingId, mappingPairKey, mappingRegistryAbi, RupaError } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";
import { keccak256, parseAbi, toBytes, zeroAddress, zeroHash } from "viem";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import type { Proposal, TranslationChain } from "./translator.js";
import { serialQueue } from "./limits.js";

export const identityAbi = parseAbi([
  "function ownerOf(uint256 agentId) view returns (address)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function register(string agentURI) returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
export function createTranslationChain(options: { publicClient: PublicClient; walletClient: WalletClient; deployment: RupaDeployment; agentId: bigint; identityRegistry: Address; gateway?: string }): TranslationChain {
  const { publicClient: client, walletClient: wallet, deployment: d, agentId } = options;
  const sdk = createRupa({ publicClient: client, deployment: d, ...(options.gateway ? { ipfsGateway: options.gateway } : {}) });
  const content = createContentReader(options.gateway ? { gateway: options.gateway } : {});
  const queue = serialQueue();
  const submitted = new Map<string, Proposal>();
  const entry = (id: Hex) => client.readContract({ address: d.contracts.MappingRegistry, abi: mappingRegistryAbi, functionName: "mappings", args: [id] });
  async function current(type: Hex, target: number, version: bigint, candidate?: Proposal): Promise<Proposal | undefined> {
    const pair = mappingPairKey(type, target), pending = submitted.get(pair);
    if (pending?.txHash) {
      let receipt;
      try { receipt = await client.getTransactionReceipt({ hash: pending.txHash }); }
      catch { throw new RupaError("TX_STATUS_UNKNOWN", "A proposal is already submitted for this pair. Check its hash before retrying.", { txHash: pending.txHash }); }
      if (receipt.status !== "success") {
        submitted.delete(pair);
        throw new RupaError("TX_REVERTED", "The previous mapping proposal reverted.", { txHash: pending.txHash });
      }
      candidate = pending;
    }
    const active = await client.readContract({ address: d.contracts.MappingRegistry, abi: mappingRegistryAbi, functionName: "activeMapping", args: [mappingPairKey(type, target)] });
    for (const id of [active, candidate?.mappingId ?? zeroHash]) {
      if (id === zeroHash) continue;
      const data = await entry(id);
      if (!data.revoked && data.assetType.toLowerCase() === type.toLowerCase() && data.targetAppId === target && data.targetSchemaVersion === version) {
        submitted.delete(pair);
        return { mappingId: id, contentURI: data.contentURI, txHash: candidate?.mappingId === id ? candidate.txHash : null, reused: true };
      }
    }
    submitted.delete(pair);
    return undefined;
  }
  return {
    source: sdk.getSourceAsset,
    target: async id => { const { app, schema } = await sdk.getAppSchema(id); return { schema, version: app.version }; },
    cached: current,
    async validateCached(proposal, asset, target) {
      const data = await entry(proposal.mappingId), { app, schema } = await sdk.getAppSchema(target);
      const rules = parseMapping(await content(data.contentURI, data.contentHash));
      if (data.revoked || data.targetSchemaVersion !== app.version || rules.targetSchemaVersion !== Number(app.version) || rules.targetAppId !== target || keccak256(toBytes(rules.assetType)).toLowerCase() !== asset.base.assetType.toLowerCase()) throw new RupaError("MAPPING_REJECTED", "Cached rule metadata differs from chain state.");
      applyMapping(rules, asset.context, schema);
    },
    propose: (mapping, published) => queue(async () => {
      if (!wallet.account) throw new RupaError("NO_WALLET", "Agent signer is not configured.");
      if (await client.getChainId() !== d.chainId || await wallet.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Agent chain mismatch.");
      const assetType = keccak256(toBytes(mapping.assetType)), version = BigInt(mapping.targetSchemaVersion);
      const reusable = await current(assetType, mapping.targetAppId, version);
      if (reusable) return reusable;
      if (submitted.size >= 64) throw new RupaError("RATE_LIMITED", "Resolve pending proposals before submitting more mappings.");
      if (await client.readContract({ address: d.contracts.AppRegistry, abi: appRegistryAbi, functionName: "version", args: [mapping.targetAppId] }) !== version) throw new RupaError("SCHEMA_OUTDATED", "Schema changed before signing.");
      const id = mappingId(assetType, mapping.targetAppId, version, published.hash);
      const existing = await entry(id);
      if (existing.targetSchemaVersion !== 0n) {
        if (existing.revoked) throw new RupaError("MAPPING_REJECTED", "Identical mapping was revoked; generate different rules.");
        return { mappingId: id, contentURI: existing.contentURI, txHash: null, reused: true };
      }
      const agentOwner = await client.readContract({ address: options.identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [agentId] });
      const agentWallet = await client.readContract({ address: options.identityRegistry, abi: identityAbi, functionName: "getAgentWallet", args: [agentId] });
      if ((agentWallet === zeroAddress ? agentOwner : agentWallet).toLowerCase() !== wallet.account.address.toLowerCase()) throw new RupaError("NO_WALLET", "Configured signer is not the registered agent wallet.");
      const signature = await wallet.signTypedData({ account: wallet.account, domain: { name: "Rupa", version: "1", chainId: d.chainId, verifyingContract: d.contracts.MappingRegistry }, primaryType: "Mapping", types: { Mapping: [{ name: "assetType", type: "bytes32" }, { name: "targetAppId", type: "uint32" }, { name: "schemaVersion", type: "uint64" }, { name: "agentId", type: "uint256" }, { name: "contentHash", type: "bytes32" }] }, message: { assetType, targetAppId: mapping.targetAppId, schemaVersion: version, agentId, contentHash: published.hash } });
      const { request } = await client.simulateContract({ address: d.contracts.MappingRegistry, abi: mappingRegistryAbi, functionName: "proposeMapping", args: [assetType, mapping.targetAppId, version, agentId, published.hash, published.uri, signature], account: wallet.account });
      const hash = await wallet.writeContract({ ...request, chain: wallet.chain ?? null });
      const pair = mappingPairKey(assetType, mapping.targetAppId);
      submitted.set(pair, { mappingId: id, contentURI: published.uri, txHash: hash, reused: false });
      let receipt;
      try { receipt = await client.waitForTransactionReceipt({ hash, timeout: 45_000 }); }
      catch { throw new RupaError("TX_STATUS_UNKNOWN", "Proposal submitted; check its hash before retrying.", { txHash: hash }); }
      submitted.delete(pair);
      if (receipt.status !== "success") throw new RupaError("TX_REVERTED", "Mapping proposal reverted.", { txHash: hash });
      return { mappingId: id, contentURI: published.uri, txHash: hash, reused: false };
    }),
  };
}
