/** Cost of one port: Monad charges the full gas limit. 700k covers the measured max (590k; avg 372k) with headroom. */
export const PORT_GAS_LIMIT = 700_000n;
export const PORT_COST_FALLBACK = 80_000_000_000_000_000n; // 0.08 MON
export const LOW_FUNDS_MESSAGE = "Saldo MON kurang — ambil demo MON lagi";

/** Max fee per gas the wallet will commit to (EIP-1559), falling back to gasPrice × 1.2. */
export async function maxFeePerGas(read: { estimateFees: () => Promise<{ maxFeePerGas?: bigint }>; gasPrice: () => Promise<bigint> }): Promise<bigint> {
  try { const fees = await read.estimateFees(); if (fees.maxFeePerGas) return fees.maxFeePerGas; } catch { /* fall through */ }
  return (await read.gasPrice()) * 12n / 10n;
}
export async function portCost(read: { gasPrice: () => Promise<bigint>; portFee: () => Promise<bigint> }): Promise<bigint> {
  try {
    const [price, fee] = await Promise.all([read.gasPrice(), read.portFee()]);
    const cost = price * PORT_GAS_LIMIT + fee;
    return cost > 0n ? cost : PORT_COST_FALLBACK;
  } catch { return PORT_COST_FALLBACK; }
}
export async function hasFundsForPort(balance: bigint, read: Parameters<typeof portCost>[0]): Promise<{ ok: boolean; needed: bigint }> {
  const needed = await portCost(read);
  return { ok: balance >= needed, needed };
}
/** Developer-facing failure line, including the RPC detail when present. */
export function failureText(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    const e = error as { code: string; message: string; txHash?: string; detail?: string };
    return `${e.code}: ${e.message}${e.detail ? ` (${e.detail})` : ""}${e.txHash ? ` Transaction: ${e.txHash}` : ""}`;
  }
  return error instanceof Error ? error.message : "Unable to complete the action.";
}
export const isLowFunds = (error: unknown) => !!error && typeof error === "object" && (error as { code?: unknown }).code === "INSUFFICIENT_FUNDS";
