import { expect, it, vi } from "vitest";
import { claimReward } from "../src/reward.js";

const owned = (...ids: bigint[]) => ids.map(assetId => ({ assetId }));
const base = { wait: async () => {}, loadOwned: async () => owned(), winStatus: async () => undefined };
const fail = async (): Promise<never> => { throw new Error("timeout"); };

it("returns the server result when the request succeeds", async () => {
  expect(await claimReward(async () => ({ assetId: "4", minted: true }), base)).toEqual({ assetId: "4", minted: true });
});
it("first claim: a newly owned id counts as success, independent of clocks", async () => {
  const loadOwned = vi.fn().mockResolvedValueOnce(owned(2n)).mockResolvedValueOnce(owned(2n)).mockResolvedValueOnce(owned(2n, 9n));
  expect(await claimReward(fail, { ...base, loadOwned })).toEqual({ assetId: "9", minted: true });
});
it("first claim: reports the error when no new id appears or the baseline is unknown", async () => {
  await expect(claimReward(fail, { ...base, loadOwned: async () => owned(2n) })).rejects.toThrow("timeout");
  await expect(claimReward(fail, { ...base, loadOwned: async () => { throw new Error("rpc"); } })).rejects.toThrow("timeout");
});
it("victory: success when the latest WIN moves past a final baseline (including 0 wins)", async () => {
  const winStatus = vi.fn().mockResolvedValueOnce({ final: true, latestBlock: null }).mockResolvedValueOnce({ final: true, latestBlock: null }).mockResolvedValueOnce({ final: true, latestBlock: "140" });
  expect(await claimReward(fail, { ...base, existing: 3n, winStatus })).toEqual({ assetId: "3", minted: false });
});
it("victory: never reconciles from a non-final baseline (index warming)", async () => {
  const winStatus = vi.fn().mockResolvedValueOnce({ final: false, latestBlock: null }).mockResolvedValue({ final: true, latestBlock: "140" });
  await expect(claimReward(fail, { ...base, existing: 3n, winStatus })).rejects.toThrow("timeout");
  expect(winStatus).toHaveBeenCalledOnce();
});
it("victory: reports the error when the WIN record never moves", async () => {
  await expect(claimReward(fail, { ...base, existing: 3n, winStatus: async () => ({ final: true, latestBlock: "100" }) })).rejects.toThrow("timeout");
});
