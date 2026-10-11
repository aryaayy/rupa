import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, sha256, toBytes, zeroHash } from "viem";
import type { Hex, PublicClient, WalletClient } from "viem";
import { createRupa, hashPortRecord, inlineContent, mappingId, monadTestnetDeployment, portLedgerAbi } from "../src/index.js";
import type { PortRecord, RegisteredPasskey, RupaConfig } from "../src/index.js";
import type { JsonObject, Mapping } from "@rupa/mapping-dsl";

const owner = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const tx = `0x${"a1".repeat(32)}` as Hex, blockHash = `0x${"b1".repeat(32)}` as Hex;
const type = keccak256(toBytes("rupa.weapon.sword"));
const schema: JsonObject = { type: "object", properties: { title: { type: "string", maxLength: 256 }, tier: { enum: ["bronze", "silver", "steel", "gold", "legend"] } }, required: ["title", "tier"], additionalProperties: false };
const rule: Mapping = { rupa: "mapping/v1", assetType: "rupa.weapon.sword", targetAppId: 2, targetSchemaVersion: 1, rationale: "Rule fixture", rules: [{ target: "title", template: "{{attrs.name}} — {{history.wins}} wins" }, { target: "tier", from: "base.rarity", map: { "0": "bronze", "1": "silver", "2": "steel", "3": "gold", "4": "legend" } }] };
const attrs = inlineContent({ name: "Fire Sword", element: "fire" });
const schemaContent = inlineContent(schema), rules = inlineContent(rule);
const id = mappingId(type, 2, 1n, rules.hash);
const key: RegisteredPasskey = { credentialId: Uint8Array.from(toBytes("credential")), credIdHash: keccak256(toBytes("credential")), qx: 1n, qy: 2n };

function fixture() {
  const state = { owner: owner as Hex, nonce: 0n, version: 1n, active: zeroHash as Hex, cached: id as Hex, revoked: false, records: [] as (PortRecord & { recordId: Hex })[] };
  const base = { assetType: type, rarity: 3, originAppId: 1, createdAt: 1n, attrsHash: attrs.hash };
  const data = { assetType: type, targetAppId: 2, targetSchemaVersion: 1n, agentId: 7n, contentHash: rules.hash, contentURI: rules.uri, createdAt: 1n, approvals: 0, revoked: false };
  const log = (args: unknown, index = 0) => ({ args, blockNumber: 5n, blockHash, logIndex: index, transactionIndex: 0, transactionHash: tx, removed: false });
  const read = vi.fn(async ({ functionName }: { functionName: string }) => {
    switch (functionName) {
      case "getApp": return { admin: owner, minter: owner, payout: owner, schemaHash: schemaContent.hash, schemaURI: schemaContent.uri, royaltyBps: 100, version: state.version };
      case "ownerOfAsset": return state.owner;
      case "getBase": return base;
      case "tokenURI": return attrs.uri;
      case "mappings": return { ...data, revoked: state.revoked };
      case "headOf": return state.records.at(-1)?.recordId ?? zeroHash;
      case "activeIn": return state.active;
      case "activeMapping": return state.cached;
      case "PORT_FEE": return 100n;
      case "nonces": return state.nonce;
      case "keyOf": return [key.qx, key.qy, key.credIdHash];
      case "RP_ID_HASH": return sha256(toBytes("localhost"));
      case "allowedOrigin": return "http://localhost:5173";
      default: throw new Error(`Unexpected read ${functionName}`);
    }
  });
  const publicClient = {
    getChainId: vi.fn(async () => 31337), getBlock: vi.fn(async () => ({ number: 10n, hash: blockHash, timestamp: 100n })), readContract: read,
    getContractEvents: vi.fn(async ({ eventName }: { eventName: string }) => {
      if (eventName === "Transfer") return [log({ tokenId: 1n, to: owner, from: other }), log({ tokenId: 1n, to: owner, from: other })];
      if (eventName === "Used") return [log({ actionTag: keccak256(toBytes("WIN")), assetId: 1n, appId: 1 })];
      return state.records.map(({ at: _, ...record }, i) => log(record, i));
    }),
    simulateContract: vi.fn(async (request: unknown) => ({ request })),
    waitForTransactionReceipt: vi.fn(async () => {
      const record: PortRecord = { assetId: 1n, fromAppId: 1, toAppId: 2, mappingId: id, agentId: 7n, approver: owner, at: 100n, prevRecord: zeroHash };
      return { status: "success", transactionHash: tx, logs: [{ address: monadTestnetDeployment.contracts.PortLedger, topics: encodeEventTopics({ abi: portLedgerAbi, eventName: "Ported", args: { recordId: hashPortRecord(record), assetId: 1n, toAppId: 2 } }), data: encodeAbiParameters([{ type: "uint32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }, { type: "bytes32" }], [1, id, 7n, owner, zeroHash]) }] };
    }),
  };
  const walletClient = { account: { address: owner, type: "json-rpc" }, chain: { id: 31337 }, getChainId: vi.fn(async () => 31337), writeContract: vi.fn(async () => tx) };
  const get = vi.fn(async (_: unknown) => ({ authenticatorData: "0x" as Hex, clientDataJSON: "", typeIndex: 1n, challengeIndex: 23n, r: 1n, s: 1n }));
  const config: RupaConfig = { publicClient: publicClient as unknown as PublicClient, walletClient: walletClient as unknown as WalletClient, deployment: { ...monadTestnetDeployment, chainId: 31337, rpId: "localhost", origin: "http://localhost:5173", deploymentBlock: "0" }, appId: 2, agentUrl: "http://localhost:8787", webauthn: { create: vi.fn(async () => key), get } };
  return { state, publicClient, walletClient, get, config, rupa: createRupa(config) };
}
describe("deployment and SDK client", () => {
  it("exports exactly the supplied deployment manifest", async () => {
    expect(monadTestnetDeployment).toEqual(JSON.parse(await readFile(new URL("../../../deployments/monad-testnet.json", import.meta.url), "utf8")));
  });
  it("deduplicates discovery, checks live owners, and evaluates a cached mapping", async () => {
    const f = fixture();
    const assets = await f.rupa.getAssetsFor(owner, 2);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ status: "portable", view: { title: "Fire Sword — 1 wins", tier: "gold" } });
    f.state.owner = other;
    expect(await f.rupa.getAssetsFor(owner, 2)).toEqual([]);
  });
  it("does not turn RPC failure into an empty/unsupported asset list", async () => {
    const f = fixture(); f.publicClient.getChainId.mockRejectedValue(new Error("offline"));
    await expect(f.rupa.getAssetsFor(owner, 2)).rejects.toMatchObject({ code: "RPC_ERROR" });
  });
  it("reconstructs timestamps, checks head, and labels previous-owner approvals", async () => {
    const f = fixture();
    const record = { assetId: 1n, fromAppId: 1, toAppId: 2, mappingId: id, agentId: 7n, approver: other, at: 100n, prevRecord: zeroHash };
    f.state.records = [{ ...record, recordId: hashPortRecord(record) }]; f.state.active = id;
    expect((await f.rupa.getAssetsFor(owner))[0]?.activation?.approvedByPreviousOwner).toBe(true);
    f.state.records[0]!.approver = owner;
    await expect(f.rupa.getProvenance(1n)).rejects.toMatchObject({ code: "PROVENANCE_INVALID" });
  });
  it("a revoked or stale activation is never presented as active", async () => {
    const f = fixture(); f.state.active = id; f.state.revoked = true;
    expect((await f.rupa.getAssetsFor(owner))[0]?.status).toBe("portable");
    f.state.revoked = false; f.state.version = 2n;
    expect((await f.rupa.getAssetsFor(owner))[0]?.status).toBe("portable");
  });
  it("ports using the exact cached mapping, required fee, passkey and confirmed event", async () => {
    const f = fixture(), steps: string[] = [];
    const result = await f.rupa.port(1n, 2, key, { onStep: step => steps.push(step), onReview: async preview => preview.view.tier === "gold" });
    expect(result).toMatchObject({ txHash: tx, mappingId: id });
    expect(steps).toEqual(["mapping:cached", "passkey:prompt", "tx:sent", "tx:confirmed"]);
    expect(f.publicClient.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "port", value: 100n }));
    expect(f.get).toHaveBeenCalledWith(expect.objectContaining({ rpId: "localhost", origin: "http://localhost:5173" }));
  });
  it("requests an uncached mapping and independently validates its registry content", async () => {
    const f = fixture(); f.state.cached = zeroHash;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ mappingId: id })));
    const rupa = createRupa({ ...f.config, fetch });
    await rupa.port(1n, 2, key);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ assetId: "1", targetAppId: 2 });
  });
  it("cancellation stops before credential access or transaction submission", async () => {
    const f = fixture();
    await expect(f.rupa.port(1n, 2, key, { onReview: async () => false })).rejects.toMatchObject({ code: "APPROVAL_CANCELLED" });
    expect(f.get).not.toHaveBeenCalled(); expect(f.walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("preserves the agent proposal hash without prompting when its confirmation is unknown", async () => {
    const f = fixture(); f.state.cached = zeroHash;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ error: { code: "TX_STATUS_UNKNOWN", txHash: tx } }), { status: 503 }));
    await expect(createRupa({ ...f.config, fetch }).port(1n, 2, key)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: tx });
    expect(f.get).not.toHaveBeenCalled(); expect(f.walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("rejects a schema change during review and a nonce change during the passkey prompt", async () => {
    const f = fixture();
    await expect(f.rupa.port(1n, 2, key, { onReview: async () => { f.state.version++; return true; } })).rejects.toMatchObject({ code: "SCHEMA_OUTDATED" });
    f.state.version = 1n;
    f.get.mockImplementation(async () => { f.state.nonce++; return { authenticatorData: "0x", clientDataJSON: "", typeIndex: 1n, challengeIndex: 23n, r: 1n, s: 1n }; });
    await expect(f.rupa.port(1n, 2, key)).rejects.toMatchObject({ code: "NONCE_CHANGED" });
    expect(f.walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("preserves a submitted transaction hash on confirmation timeout", async () => {
    const f = fixture(); f.publicClient.waitForTransactionReceipt.mockRejectedValue(new Error("timeout"));
    await expect(f.rupa.port(1n, 2, key)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: tx });
    expect(f.walletClient.writeContract).toHaveBeenCalledOnce();
  });
  it("rejects wrong chain, wrong owner, and a mismatched passkey", async () => {
    const f = fixture(); f.publicClient.getChainId.mockResolvedValueOnce(1);
    await expect(f.rupa.port(1n, 2, key)).rejects.toMatchObject({ code: "WRONG_CHAIN" });
    f.state.owner = other;
    await expect(f.rupa.port(1n, 2, key)).rejects.toMatchObject({ code: "NOT_OWNER" });
    f.state.owner = owner;
    await expect(f.rupa.port(1n, 2, { ...key, credIdHash: zeroHash })).rejects.toMatchObject({ code: "NO_PASSKEY" });
  });
});
