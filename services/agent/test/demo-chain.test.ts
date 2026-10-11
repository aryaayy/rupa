import { beforeEach, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, HttpRequestError, InsufficientFundsError, keccak256, toBytes, TransactionExecutionError } from "viem";
import type { Hex, PublicClient, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnetDeployment as d, rupaAssetAbi } from "@rupa/sdk";

vi.mock("@rupa/sdk", async importOriginal => ({ ...await importOriginal<typeof import("@rupa/sdk")>(), createRupa: () => ({ getOwnedAssets: async () => [] }) }));
const { createDemoActions } = await import("../src/demo-chain.js");

const signed = "0xdeadbeef" as Hex, hash = keccak256(signed);
const user = privateKeyToAccount(generatePrivateKey()).address;
const mintLog = { address: d.contracts.RupaAsset, topics: encodeEventTopics({ abi: rupaAssetAbi, eventName: "AssetMinted", args: { id: 7n, assetType: keccak256(toBytes("x")), originAppId: 1 } }), data: encodeAbiParameters([{ type: "address" }], [user]) };

let client: Record<string, ReturnType<typeof vi.fn>>, admin: Record<string, unknown>;
beforeEach(() => {
  client = {
    getChainId: vi.fn(async () => d.chainId),
    simulateContract: vi.fn(async ({ address, abi, functionName, args }: Record<string, unknown>) => ({ request: { address, abi, functionName, args } })),
    sendRawTransaction: vi.fn(async () => hash),
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success", transactionHash: hash, logs: [mintLog] })),
    getTransactionReceipt: vi.fn(async () => { throw new Error("not found"); }),
    getTransaction: vi.fn(async () => { throw new Error("not found"); }),
    getTransactionCount: vi.fn(async () => 5),
  };
  admin = { account: privateKeyToAccount(generatePrivateKey()), chain: null, getChainId: vi.fn(async () => d.chainId), prepareTransactionRequest: vi.fn(async (r: object) => ({ ...r, nonce: 5 })), signTransaction: vi.fn(async () => signed) };
});
const actions = () => createDemoActions({ publicClient: client as unknown as PublicClient, admin: admin as unknown as WalletClient, deployment: d, arena: 1 });

it("records the hash before broadcast and never re-mints when the send error hid an accepted tx", async () => {
  const a = actions();
  client.sendRawTransaction!.mockRejectedValueOnce(new Error("socket hang up"));
  client.getTransaction!.mockResolvedValueOnce({ hash });
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  client.getTransactionReceipt!.mockResolvedValueOnce({ status: "success", transactionHash: hash, logs: [mintLog] });
  expect(await a.reward(user)).toEqual({ assetId: "7", txHash: hash, minted: true });
  expect(client.sendRawTransaction).toHaveBeenCalledOnce();
});
it("treats an advanced nonce after a send error as possibly submitted", async () => {
  const a = actions();
  client.sendRawTransaction!.mockRejectedValueOnce(new HttpRequestError({ url: "https://rpc" }));
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
});
it("rebroadcasts the same signed bytes instead of signing nonce+1 while a tx is unresolved", async () => {
  const a = actions();
  client.sendRawTransaction!.mockRejectedValueOnce(new HttpRequestError({ url: "https://rpc" }));
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  // Load-balanced RPC: this node does not know the tx and the nonce is still unused.
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  expect(client.sendRawTransaction).toHaveBeenCalledTimes(2);
  expect(client.sendRawTransaction!.mock.calls.every(([arg]) => (arg as { serializedTransaction: Hex }).serializedTransaction === signed)).toBe(true);
  expect(admin.signTransaction).toHaveBeenCalledOnce();
  // Later it confirms: the reward is delivered without a second mint.
  client.getTransactionReceipt!.mockResolvedValueOnce({ status: "success", transactionHash: hash, logs: [mintLog] });
  expect(await a.reward(user)).toMatchObject({ assetId: "7", minted: true });
  expect(admin.signTransaction).toHaveBeenCalledOnce();
});
it("blocks other actions of the same signer while one of its transactions is unresolved", async () => {
  const a = actions(), other = privateKeyToAccount(generatePrivateKey()).address;
  client.sendRawTransaction!.mockRejectedValueOnce(new HttpRequestError({ url: "https://rpc" }));
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
  await expect(a.reward(other)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN", txHash: hash });
  expect(admin.signTransaction).toHaveBeenCalledOnce();
});
it("forgets a tx only once its nonce was definitively consumed by another transaction", async () => {
  const a = actions();
  client.waitForTransactionReceipt!.mockRejectedValueOnce(new Error("timeout"));
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
  client.getTransactionCount!.mockResolvedValueOnce(6);
  expect(await a.reward(user)).toMatchObject({ minted: true });
  expect(admin.signTransaction).toHaveBeenCalledTimes(2);
});
it("forgets a provably unsent transaction so the win can be retried", async () => {
  const a = actions();
  client.sendRawTransaction!.mockRejectedValueOnce(new TransactionExecutionError(new InsufficientFundsError(), { account: undefined } as never));
  await expect(a.reward(user)).rejects.toBeInstanceOf(TransactionExecutionError);
  expect(await a.reward(user)).toMatchObject({ minted: true });
  expect(client.sendRawTransaction).toHaveBeenCalledTimes(2);
});
it("re-checks an uncertain transaction on the next request and clears it once resolved", async () => {
  const a = actions();
  client.waitForTransactionReceipt!.mockRejectedValueOnce(new Error("timeout"));
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
  client.getTransaction!.mockResolvedValueOnce({ hash });
  await expect(a.reward(user)).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
  client.getTransactionReceipt!.mockResolvedValueOnce({ status: "reverted", transactionHash: hash, logs: [] });
  expect(await a.reward(user)).toMatchObject({ minted: true });
  expect(admin.signTransaction).toHaveBeenCalledTimes(2); // pending: same bytes rebroadcast; reverted: one new tx
});
