import { expect, it, vi } from "vitest";
import { keccak256, toBytes } from "viem";
import type { PublicClient } from "viem";
import { monadTestnetDeployment } from "@rupa/sdk";
import { createWinIndex } from "../src/win-index.js";

const WIN = keccak256(toBytes("WIN"));
const used = (id: bigint, block: bigint, i = 0) => ({ eventName: "Used", args: { assetId: id, appId: 1, actionTag: WIN }, blockNumber: block, blockHash: `0x${block.toString(16).padStart(64, "0")}`, logIndex: i });
const minted = (id: bigint, block: bigint) => ({ eventName: "AssetMinted", args: { id, originAppId: 1 }, blockNumber: block, blockHash: `0x${block.toString(16).padStart(64, "0")}`, logIndex: 9 });

it("answers immediately, fills recent blocks first, and marks counts final once the mint is seen", async () => {
  const logs = [minted(1n, 120n), used(1n, 150n), used(1n, 990n)];
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let backfillCalls = 0;
  const client = {
    getBlockNumber: vi.fn(async () => 1000n),
    getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (toBlock < 995n && ++backfillCalls > 1) await gate; // hold the deep backfill
      return logs.filter(log => log.blockNumber >= fromBlock && log.blockNumber <= toBlock);
    }),
  };
  const index = createWinIndex({ publicClient: client as unknown as PublicClient, deployment: { ...monadTestnetDeployment, deploymentBlock: "100" }, range: 100n, concurrency: 1, sleep: () => new Promise(() => {}) });
  expect(index.query([1n]).counts["1"]).toEqual({ wins: 0, final: false, latestBlock: null });
  index.start();
  await vi.waitFor(() => expect(index.query([1n]).counts["1"]!.wins).toBe(1));
  // Recent win (block 990) is visible while older history is still warming.
  expect(index.query([1n])).toMatchObject({ ready: false, counts: { "1": { wins: 1, final: false, latestBlock: "990" } } });
  release();
  await vi.waitFor(() => expect(index.query([1n]).ready).toBe(true));
  expect(index.query([1n]).counts["1"]).toEqual({ wins: 2, final: true, latestBlock: "990" });
  index.stop();
});
