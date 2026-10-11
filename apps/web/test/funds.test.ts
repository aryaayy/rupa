import { expect, it } from "vitest";
import { failureText, hasFundsForPort, isLowFunds, maxFeePerGas, PORT_COST_FALLBACK, portCost } from "../src/funds.js";
import { RupaError } from "@rupa/sdk";

it("prices a port at the full gas limit plus the protocol fee", async () => {
  expect(await portCost({ gasPrice: async () => 100n, portFee: async () => 7n })).toBe(70_000_007n);
});
it("falls back to 0.08 MON when the estimate fails", async () => {
  expect(await portCost({ gasPrice: async () => { throw new Error("rpc"); }, portFee: async () => 1n })).toBe(PORT_COST_FALLBACK);
});
it("does not block a second port after passkey + first port (~0.10 MON left at 102 gwei)", async () => {
  const read = { gasPrice: async () => 102_000_000_000n, portFee: async () => 1_000_000_000_000_000n };
  expect(await portCost(read)).toBe(72_400_000_000_000_000n); // 0.0724 MON
  expect((await hasFundsForPort(103_000_000_000_000_000n, read)).ok).toBe(true);
});
it("flags a balance below the estimated cost", async () => {
  const read = { gasPrice: async () => 50_000_000_000n, portFee: async () => 1_000_000_000_000_000n };
  expect((await hasFundsForPort(10n ** 16n, read)).ok).toBe(false);
  expect((await hasFundsForPort(10n ** 17n, read)).ok).toBe(true);
});
it("maps INSUFFICIENT_FUNDS and shows error detail", () => {
  const error = new RupaError("INSUFFICIENT_FUNDS", "Not enough MON for gas. Get demo MON and try again.", { detail: "insufficient funds for gas * price + value" });
  expect(isLowFunds(error)).toBe(true);
  expect(failureText(error)).toBe("INSUFFICIENT_FUNDS: Not enough MON for gas. Get demo MON and try again. (insufficient funds for gas * price + value)");
  expect(isLowFunds(new RupaError("RPC_ERROR", "x"))).toBe(false);
});
it("uses maxFeePerGas, falling back to gasPrice x 1.2", async () => {
  expect(await maxFeePerGas({ estimateFees: async () => ({ maxFeePerGas: 150n }), gasPrice: async () => 100n })).toBe(150n);
  expect(await maxFeePerGas({ estimateFees: async () => { throw new Error("no 1559"); }, gasPrice: async () => 100n })).toBe(120n);
  expect(await maxFeePerGas({ estimateFees: async () => ({}), gasPrice: async () => 100n })).toBe(120n);
});
