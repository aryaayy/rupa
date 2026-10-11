export type RewardResult = { assetId: string; minted: boolean };
type Owned = { assetId: bigint };
type WinStatus = { final: boolean; latestBlock: string | null } | undefined;

/**
 * The reward request can outlive the browser's fetch timeout while the server still lands the transaction.
 * Before reporting an error, check for the request's effect:
 * - first victory: an owned asset id that was not owned before the request;
 * - later victories: the relic's latest WIN block moved past a baseline that came from a FINAL index entry.
 *   A non-final baseline (index still warming) is never used, so backfill cannot fake a new win.
 */
export async function claimReward(request: () => Promise<RewardResult>, options: {
  existing?: bigint; loadOwned: () => Promise<readonly Owned[]>; winStatus: (id: bigint) => Promise<WinStatus>;
  attempts?: number; wait?: (ms: number) => Promise<void>;
}): Promise<RewardResult> {
  const wait = options.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const id = options.existing;
  const before = id === undefined
    ? await options.loadOwned().then(list => new Set(list.map(asset => asset.assetId)), () => undefined)
    : await options.winStatus(id).then(status => status?.final ? status : undefined, () => undefined);
  try { return await request(); }
  catch (error) {
    if (!before) throw error;
    // The agent's win index refreshes about every 10 s, so poll a few times before giving up.
    for (let attempt = 0; attempt < (options.attempts ?? 4); attempt++) {
      if (attempt) await wait(5_000);
      if (before instanceof Set) {
        const fresh = await options.loadOwned().then(list => list.find(asset => !before.has(asset.assetId)), () => undefined);
        if (fresh) return { assetId: fresh.assetId.toString(), minted: true };
      } else {
        const after = await options.winStatus(id!).catch(() => undefined);
        const baseline = before.latestBlock === null ? -1n : BigInt(before.latestBlock);
        if (after?.final && after.latestBlock !== null && BigInt(after.latestBlock) > baseline) return { assetId: id!.toString(), minted: false };
      }
    }
    throw error;
  }
}
