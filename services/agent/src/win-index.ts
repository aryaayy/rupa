import { portLedgerAbi, rupaAssetAbi } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";
import { getAbiItem, keccak256, toBytes } from "viem";
import type { PublicClient } from "viem";

const WIN = keccak256(toBytes("WIN")).toLowerCase();
const events = [getAbiItem({ abi: portLedgerAbi, name: "Used" }), getAbiItem({ abi: rupaAssetAbi, name: "AssetMinted" })];
export type WinEntry = { wins: number; final: boolean; latestBlock: string | null };
export type WinSnapshot = { ready: boolean; coveredFrom: string | null; coveredTo: string | null; counts: Record<string, WinEntry> };

/**
 * Warm, in-memory index of WIN uses. Never blocks callers: query() always answers from what is indexed so far.
 * At boot it follows the tip forward (every `interval`) and backfills newest-first toward the deployment block,
 * so recent wins are visible within seconds even after a cold wake. A count is `final` once the asset's own
 * AssetMinted event has been seen, because every Used log of that asset is after its mint and inside the covered span.
 */
export function createWinIndex(options: { publicClient: PublicClient; deployment: RupaDeployment; interval?: number; range?: bigint; concurrency?: number; sleep?: (ms: number) => Promise<void> }) {
  const client = options.publicClient, d = options.deployment, range = options.range ?? 100n, parallel = options.concurrency ?? 4;
  const floor = BigInt(d.deploymentBlock ?? "0"), sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const seen = new Set<string>();
  const uses = new Map<string, Map<number, { wins: number; latest: bigint }>>();
  const origin = new Map<string, number>();
  let low: bigint | undefined, high: bigint | undefined, stopped = false;

  function ingest(logs: Awaited<ReturnType<typeof fetchLogs>>) {
    for (const log of logs) {
      const key = `${log.blockHash}:${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (log.eventName === "AssetMinted") { origin.set(log.args.id.toString(), log.args.originAppId); continue; }
      if (log.args.actionTag.toLowerCase() !== WIN) continue;
      const id = log.args.assetId.toString(), byApp = uses.get(id) ?? new Map();
      const entry = byApp.get(log.args.appId) ?? { wins: 0, latest: 0n };
      entry.wins++; if (log.blockNumber! > entry.latest) entry.latest = log.blockNumber!;
      byApp.set(log.args.appId, entry); uses.set(id, byApp);
    }
  }
  function fetchLogs(fromBlock: bigint, toBlock: bigint) {
    return client.getLogs({ address: [d.contracts.PortLedger, d.contracts.RupaAsset], events, fromBlock, toBlock, strict: true });
  }
  async function forward() {
    const tip = await client.getBlockNumber();
    if (high === undefined) { high = tip; low = tip + 1n; }
    // Re-read a short window so a shallow reorg or a lagging load-balanced node cannot hide a log for good.
    const from = high > floor + 5n ? high - 5n : floor;
    for (let start = from; start <= tip; start += range) ingest(await fetchLogs(start, start + range - 1n > tip ? tip : start + range - 1n));
    high = tip;
  }
  async function backfill() {
    while (!stopped && low !== undefined && low > floor) {
      const chunks: [bigint, bigint][] = [];
      for (let end = low - 1n; chunks.length < parallel && end >= floor; end -= range) chunks.push([end - range + 1n < floor ? floor : end - range + 1n, end]);
      try {
        for (const logs of await Promise.all(chunks.map(([from, to]) => fetchLogs(from, to)))) ingest(logs);
        low = chunks.at(-1)![0];
      } catch { await sleep(2_000); }
    }
  }
  const status = { started: false, backfilling: false };
  return {
    /** Starts both loops in the background; resolves immediately. */
    start() {
      if (status.started) return; status.started = true;
      void (async () => {
        while (!stopped) {
          try { await forward(); if (low !== undefined && !status.backfilling) { status.backfilling = true; void backfill(); } }
          catch { /* RPC hiccup: keep serving the last snapshot and try again next tick. */ }
          await sleep(options.interval ?? 10_000);
        }
      })();
    },
    stop() { stopped = true; },
    /** Pull the newest blocks now (e.g. right after this agent recorded a WIN). Bounded; never throws. */
    async refresh() {
      if (high === undefined) return;
      await Promise.race([forward().catch(() => undefined), sleep(3_000)]);
    },
    /** Immediate, partial-safe answer. */
    query(ids: readonly bigint[]): WinSnapshot {
      const counts: Record<string, WinEntry> = {};
      for (const value of ids) {
        const id = value.toString(), app = origin.get(id), byApp = uses.get(id);
        const relevant = app === undefined ? [...(byApp?.values() ?? [])] : [byApp?.get(app)].filter(entry => !!entry);
        const latest = relevant.reduce<bigint | null>((max, entry) => max === null || entry!.latest > max ? entry!.latest : max, null);
        counts[id] = { wins: relevant.reduce((sum, entry) => sum + entry!.wins, 0), final: app !== undefined, latestBlock: latest === null ? null : latest.toString() };
      }
      return { ready: low !== undefined && low <= floor, coveredFrom: low === undefined ? null : low.toString(), coveredTo: high === undefined ? null : high.toString(), counts };
    },
  } as const;
}
