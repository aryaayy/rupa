import { canonicalize, contentHash } from "@rupa/mapping-dsl";
import { appRegistryAbi, RupaError } from "@rupa/sdk";
import { parseEventLogs, zeroAddress } from "viem";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import type { RupaDeployment } from "@rupa/sdk";
import { identityAbi } from "./chain.js";
import { ARENA_SCHEMA, displaySchema } from "./demo.js";
import type { Publisher } from "./provider.js";

type AppName = "arena" | "social" | "gallery";
export interface SetupCheckpoint {
  apps: Partial<Record<AppName, number>>; agentId?: string;
  pending?: { kind: AppName | "agent"; txHash: Hex };
}

/** Registers demo consumers/identity only. Never deploys or rewires protocol contracts. */
export async function registerDemo(options: {
  publicClient: PublicClient; admin: WalletClient; agent: WalletClient; deployment: RupaDeployment;
  identityRegistry: Address; publish: Publisher; agentUrl: string; agentId?: bigint;
  checkpoint?: (state: SetupCheckpoint) => Promise<void>;
  apps?: SetupCheckpoint["apps"]; pending?: SetupCheckpoint["pending"];
}) {
  const { publicClient: client, admin, agent, deployment: d } = options;
  if (!admin.account || !agent.account) throw new RupaError("NO_WALLET", "Configure separate demo admin and agent signers.");
  if (await client.getChainId() !== d.chainId || await admin.getChainId() !== d.chainId || await agent.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Setup chain mismatch.");
  const apps = { ...options.apps };
  let pending = options.pending, agentId = options.agentId;
  const url = new URL(options.agentUrl);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:"))) throw new RupaError("INVALID_REQUEST", "Agent endpoint must use HTTPS, or localhost for local development.");
  const save = () => options.checkpoint?.({ apps, ...(agentId ? { agentId: agentId.toString() } : {}), ...(pending ? { pending } : {}) });
  async function confirmed(kind: AppName | "agent", submit: () => Promise<Hex>) {
    if (pending && pending.kind !== kind) throw new RupaError("INVALID_REQUEST", "Reconcile the checkpoint's pending operation first.", { txHash: pending.txHash });
    const hash = pending?.txHash ?? await submit();
    pending = { kind, txHash: hash };
    try { await save(); }
    catch { throw new RupaError("TX_STATUS_UNKNOWN", "Submitted but checkpoint could not be saved. Reconcile this hash before retrying.", { txHash: hash }); }
    let receipt;
    try { receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 }); }
    catch { throw new RupaError("TX_STATUS_UNKNOWN", "Registration pending; the checkpoint will resume this transaction.", { txHash: hash }); }
    if (receipt.status !== "success") throw new RupaError("TX_REVERTED", "Registration reverted. Inspect the checkpoint before retrying.", { txHash: hash });
    return receipt;
  }
  const schemaByApp = { arena: ARENA_SCHEMA, social: displaySchema("profile_badge"), gallery: displaySchema("artwork") };
  for (const key of ["arena", "social", "gallery"] as const) {
    if (apps[key]) {
      const existing = await client.readContract({ address: d.contracts.AppRegistry, abi: appRegistryAbi, functionName: "getApp", args: [apps[key]!] });
      if (existing.admin.toLowerCase() !== admin.account.address.toLowerCase() || existing.minter.toLowerCase() !== admin.account.address.toLowerCase() || existing.schemaHash.toLowerCase() !== contentHash(schemaByApp[key]).toLowerCase()) throw new RupaError("INVALID_REQUEST", "Checkpoint app has a different admin, minter, or schema.");
      continue;
    }
    const receipt = await confirmed(key, async () => {
      const content = await options.publish(schemaByApp[key]);
      if (content.hash !== contentHash(schemaByApp[key])) throw new RupaError("CONTENT_HASH_MISMATCH", "Publisher returned a different schema hash.");
      const { request } = await client.simulateContract({ account: admin.account!, address: d.contracts.AppRegistry, abi: appRegistryAbi, functionName: "registerApp", args: [`Rupa ${key[0]!.toUpperCase()}${key.slice(1)}`, content.uri, content.hash, admin.account!.address, 100] });
      return admin.writeContract({ ...request, chain: admin.chain ?? null });
    });
    const event = parseEventLogs({ abi: appRegistryAbi, eventName: "AppRegistered", logs: receipt.logs.filter(log => log.address.toLowerCase() === d.contracts.AppRegistry.toLowerCase()), strict: true })[0];
    if (!event || event.args.admin.toLowerCase() !== admin.account.address.toLowerCase() || event.args.schemaHash !== contentHash(schemaByApp[key])) throw new RupaError("RPC_ERROR", "App registration receipt is missing its expected event.", { txHash: receipt.transactionHash });
    apps[key] = event.args.appId;
    pending = undefined; await save();
  }
  if (!agentId) {
    const card = { type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: "Rupa Translator", description: "Reusable mapping rules with deterministic validation", services: [{ name: "translation", endpoint: new URL("translate", `${options.agentUrl.replace(/\/$/, "")}/`).href }], active: true, supportedTrust: [] };
    const uri = `data:application/json;base64,${Buffer.from(canonicalize(card)).toString("base64")}`;
    const receipt = await confirmed("agent", async () => {
      const { request } = await client.simulateContract({ account: agent.account!, address: options.identityRegistry, abi: identityAbi, functionName: "register", args: [uri] });
      return agent.writeContract({ ...request, chain: agent.chain ?? null });
    });
    const event = parseEventLogs({ abi: identityAbi, eventName: "Registered", logs: receipt.logs.filter(log => log.address.toLowerCase() === options.identityRegistry.toLowerCase()), strict: true })[0];
    if (!event || event.args.owner.toLowerCase() !== agent.account.address.toLowerCase()) throw new RupaError("RPC_ERROR", "Agent registration receipt is missing its expected event.", { txHash: receipt.transactionHash });
    agentId = event.args.agentId;
    pending = undefined; await save();
  }
  const owner = await client.readContract({ address: options.identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [agentId] });
  const signer = await client.readContract({ address: options.identityRegistry, abi: identityAbi, functionName: "getAgentWallet", args: [agentId] });
  if ((signer === zeroAddress ? owner : signer).toLowerCase() !== agent.account.address.toLowerCase()) throw new RupaError("NO_WALLET", "Agent ID does not authorize the configured signer.");
  await save();
  return { apps: apps as Record<"arena" | "social" | "gallery", number>, agentId: agentId.toString() };
}
