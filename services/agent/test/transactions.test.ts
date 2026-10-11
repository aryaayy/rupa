import { expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, toBytes, zeroAddress, zeroHash } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { contentHash } from "@rupa/mapping-dsl";
import type { Mapping } from "@rupa/mapping-dsl";
import { monadTestnetDeployment } from "@rupa/sdk";
import { createTranslationChain, identityAbi } from "../src/chain.js";
import { ARENA_SCHEMA, displaySchema, RELIC_TYPE } from "../src/demo.js";
import { inlinePublisher, mockProvider } from "../src/provider.js";
import { registerDemo } from "../src/setup.js";
import type { SetupCheckpoint } from "../src/setup.js";

it("reconciles an unknown mapping transaction before signing another proposal", async () => {
  const account = privateKeyToAccount(generatePrivateKey()), hash = keccak256(toBytes("submitted"));
  const rule = await mockProvider({ assetType: RELIC_TYPE, targetAppId: 2, targetSchemaVersion: 1, schema: displaySchema("profile_badge"), source: { base: { rarity: 3 }, attrs: { name: "Sword", element: "fire" }, history: { wins: 0 } }, feedback: "" }) as Mapping;
  const published = await inlinePublisher(rule); let confirmed = false;
  const client = {
    getChainId: vi.fn(async () => 10143),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "activeMapping") return zeroHash;
      if (functionName === "version") return 1n;
      if (functionName === "ownerOf") return account.address;
      if (functionName === "getAgentWallet") return zeroAddress;
      if (functionName === "mappings") return { targetSchemaVersion: confirmed ? 1n : 0n, assetType: keccak256(toBytes(RELIC_TYPE)), targetAppId: 2, revoked: false, contentURI: published.uri };
      throw new Error("Unexpected read");
    }),
    simulateContract: vi.fn(async () => ({ request: {} })),
    waitForTransactionReceipt: vi.fn(async () => { throw new Error("timeout"); }),
    getTransactionReceipt: vi.fn(async () => { if (!confirmed) throw new Error("pending"); return { status: "success" }; }),
  };
  const wallet = { account, chain: null, getChainId: vi.fn(async () => 10143), signTypedData: vi.fn(async () => "0x"), writeContract: vi.fn(async () => hash) };
  const chain = createTranslationChain({ publicClient: client as unknown as PublicClient, walletClient: wallet as unknown as WalletClient, deployment: monadTestnetDeployment, agentId: 1n, identityRegistry: monadTestnetDeployment.identityRegistry });
  await expect(chain.propose(rule, published)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  await expect(chain.propose(rule, published)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  expect(wallet.writeContract).toHaveBeenCalledOnce(); expect(wallet.signTypedData).toHaveBeenCalledOnce();
  confirmed = true;
  expect(await chain.cached(keccak256(toBytes(RELIC_TYPE)), 2, 1n)).toMatchObject({ txHash: hash, reused: true });
  expect(wallet.writeContract).toHaveBeenCalledOnce();
});

it("resumes the checkpoint's identity registration without sending a duplicate transaction", async () => {
  const account = privateKeyToAccount(generatePrivateKey()), hash = keccak256(toBytes("registration"));
  const schemas = [ARENA_SCHEMA, displaySchema("profile_badge"), displaySchema("artwork")];
  const state: SetupCheckpoint = { apps: { arena: 1, social: 2, gallery: 3 }, pending: { kind: "agent", txHash: hash } };
  const checkpoint = vi.fn(async (value: SetupCheckpoint) => { Object.assign(state, value); if (!value.pending) delete state.pending; });
  const write = vi.fn(), publish = vi.fn(inlinePublisher);
  const client = {
    getChainId: vi.fn(async () => 10143),
    readContract: vi.fn(async ({ functionName, args }: { functionName: string; args: [number] }) => functionName === "getApp" ? { admin: account.address, minter: account.address, schemaHash: contentHash(schemas[args[0] - 1]) } : functionName === "ownerOf" ? account.address : zeroAddress),
    waitForTransactionReceipt: vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ status: "success", transactionHash: hash, logs: [{ address: monadTestnetDeployment.identityRegistry, topics: encodeEventTopics({ abi: identityAbi, eventName: "Registered", args: { agentId: 17n, owner: account.address } }), data: encodeAbiParameters([{ type: "string" }], ["data:application/json;base64,e30="]) }] }),
  };
  const wallet = { account, getChainId: vi.fn(async () => 10143), writeContract: write } as unknown as WalletClient;
  const options = { publicClient: client as unknown as PublicClient, admin: wallet, agent: wallet, deployment: monadTestnetDeployment, identityRegistry: monadTestnetDeployment.identityRegistry, publish, agentUrl: "https://agent.example", checkpoint };
  await expect(registerDemo({ ...options, apps: state.apps, pending: state.pending })).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  const result = await registerDemo({ ...options, apps: state.apps, pending: state.pending });
  expect(result.agentId).toBe("17"); expect(state.pending).toBeUndefined();
  expect(write).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
});
