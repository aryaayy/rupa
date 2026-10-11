import { randomBytes, randomUUID } from "node:crypto";
import { isAddress, keccak256, toBytes, verifyMessage } from "viem";
import type { Address, Hex } from "viem";
import type { JsonObject } from "@rupa/mapping-dsl";
import { RupaError } from "@rupa/sdk";
import { RateLimiter } from "./limits.js";

export const RELIC_TYPE = "rupa.weapon.sword";
export const RELIC_TYPE_HASH = keccak256(toBytes(RELIC_TYPE));
export const RELIC_ATTRS: JsonObject = { name: "Fire Sword", element: "fire" };
export const ARENA_SCHEMA: JsonObject = { type: "object", properties: { name: { type: "string", maxLength: 128 }, element: { type: "string", maxLength: 32 } }, required: ["name", "element"], additionalProperties: false };
export function displaySchema(kind: "profile_badge" | "artwork"): JsonObject {
  return { type: "object", properties: { kind: { const: kind }, title: { type: "string", maxLength: 256 }, color: { type: "string", enum: ["#F2673B", "#4FC3F7", "#A49AFF"] }, tier: { type: "string", enum: ["bronze", "silver", "steel", "gold", "legend"] } }, required: ["kind", "title", "color", "tier"], additionalProperties: false };
}
export interface DemoActions {
  fund?: (address: Address) => Promise<{ txHash: Hex }>;
  balanceLow?: (address: Address) => Promise<boolean>;
  reward: (address: Address) => Promise<{ assetId: string; txHash: Hex; minted: boolean }>;
}
type Session = { address: Address; ip: string; expires: number; round: number; won: boolean };

/** Faucet limits. Per wallet (not per IP) so many judges on one Wi-Fi are not blocked; balance is checked by the action. */
export type FaucetLimits = { perWallet: number; walletWindowMs: number; perIp: number; globalPerHour: number };
// Note: counters are in memory and reset when the agent restarts (e.g. Render free-tier sleep).
export const DEFAULT_FAUCET_LIMITS: FaucetLimits = { perWallet: 2, walletWindowMs: 30 * 60_000, perIp: 6, globalPerHour: 10 };
export function createDemoAccess(options: { origin: string; chainId: number; actions: DemoActions; now?: () => number; faucet?: Partial<FaucetLimits> }) {
  const limits = { ...DEFAULT_FAUCET_LIMITS, ...options.faucet };
  const now = options.now ?? Date.now, rate = new RateLimiter(now);
  const challenges = new Map<string, { address: Address; ip: string; message: string; expires: number }>();
  const sessions = new Map<string, Session>();
  // Keep submitted operations, including unknown outcomes, so retrying cannot spend twice.
  const funding = new Map<string, Promise<{ txHash: Hex }>>();
  function prune() {
    for (const [key, value] of challenges) if (value.expires <= now()) challenges.delete(key);
    for (const [key, value] of sessions) if (value.expires <= now()) sessions.delete(key);
  }
  function session(token: string, ip: string): Session {
    prune(); const value = sessions.get(token);
    if (!value || value.ip !== ip) throw new RupaError("INVALID_REQUEST", "Demo session expired. Sign in with the demo wallet again.");
    return value;
  }
  return {
    challenge(address: unknown, ip: string) {
      prune(); rate.take(`challenge:${ip}`, 10, 60_000);
      if (typeof address !== "string" || !isAddress(address) || challenges.size >= 1000) throw new RupaError("INVALID_REQUEST", "Invalid wallet or challenge capacity reached.");
      const nonce = randomUUID(), expires = now() + 120_000;
      const message = `Rupa demo access\nOrigin: ${options.origin}\nChain: ${options.chainId}\nWallet: ${address}\nNonce: ${nonce}\nExpires: ${expires}`;
      challenges.set(nonce, { address, ip, message, expires });
      return { nonce, message };
    },
    async authenticate(nonce: unknown, signature: unknown, ip: string) {
      prune(); rate.take(`login:${ip}`, 10, 60_000);
      const pending = typeof nonce === "string" ? challenges.get(nonce) : undefined;
      if (!pending || pending.ip !== ip || typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new RupaError("INVALID_REQUEST", "Invalid or expired wallet challenge.");
      challenges.delete(String(nonce));
      if (!await verifyMessage({ address: pending.address, message: pending.message, signature: signature as Hex })) throw new RupaError("INVALID_REQUEST", "Wallet signature does not match the challenge.");
      if (sessions.size >= 1000) throw new RupaError("RATE_LIMITED", "Demo session capacity reached.");
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, { address: pending.address, ip, expires: now() + 3_600_000, round: -1, won: false });
      return { token, address: pending.address, expiresAt: now() + 3_600_000 };
    },
    async fund(token: string, ip: string) {
      const s = session(token, ip), address = s.address.toLowerCase();
      if (!options.actions.fund) throw new RupaError("DEPENDENCY_UNAVAILABLE", "Demo faucet is disabled. Use the official Monad faucet.");
      const previous = funding.get(address); if (previous) return previous;
      // Balance first: a refused request (wallet already funded) must not consume any slot.
      if (options.actions.balanceLow && !await options.actions.balanceLow(s.address)) throw new RupaError("INVALID_REQUEST", "This wallet already has enough demo gas.");
      // The per-wallet limit always applies, so a wallet cannot drain the faucet by moving its MON out.
      rate.takeAll([[`fund:wallet:${address}`, limits.perWallet, limits.walletWindowMs], [`fund:ip:${ip}`, limits.perIp, 3_600_000], ["fund:global", limits.globalPerHour, 3_600_000]]);
      const task = options.actions.fund(s.address); funding.set(address, task);
      // Only an unknown outcome stays pinned (retrying could spend twice); settled requests free the slot.
      task.then(() => funding.delete(address), error => { if (!(error instanceof RupaError && error.code === "TX_STATUS_UNKNOWN")) funding.delete(address); });
      return task;
    },
    start(token: string, ip: string) {
      const s = session(token, ip); rate.take(`duel:${s.address.toLowerCase()}`, 10, 3_600_000);
      s.round = 0; s.won = false; return { round: 0, move: "strike", won: false };
    },
    play(token: string, ip: string, move: unknown) {
      const s = session(token, ip), pattern = ["strike", "guard", "strike"];
      if (s.round < 0 || s.round >= pattern.length || s.won) throw new RupaError("INVALID_REQUEST", "Start a new duel first.");
      if (move !== pattern[s.round]) { s.round = -1; return { round: -1, move: null, won: false }; }
      s.round++; s.won = s.round === pattern.length;
      return { round: s.round, move: pattern[s.round] ?? null, won: s.won };
    },
    async reward(token: string, ip: string) {
      const s = session(token, ip);
      if (!s.won) throw new RupaError("INVALID_REQUEST", "Win the server-confirmed duel first.");
      rate.take(`reward:${s.address.toLowerCase()}`, 10, 3_600_000); rate.take("reward:global", 100, 3_600_000);
      // Hold the win while the mint is in flight; give it back if the reward did not land.
      s.won = false;
      try { return await options.actions.reward(s.address); }
      catch (error) { s.won = true; throw error; }
    },
  };
}
