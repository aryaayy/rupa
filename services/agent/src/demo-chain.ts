import { createRupa, inlineContent, portLedgerAbi, rupaAssetAbi, RupaError } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";
import { BaseError, encodeFunctionData, HttpRequestError, RpcRequestError, TimeoutError, TransactionExecutionError, keccak256, parseEther, parseEventLogs, toBytes } from "viem";
import type { Address, Hex, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { RELIC_ATTRS, RELIC_TYPE_HASH } from "./demo.js";
import type { DemoActions } from "./demo.js";
import { serialQueue } from "./limits.js";

export function createDemoActions(options: { publicClient: PublicClient; admin: WalletClient; funder?: WalletClient; deployment: RupaDeployment; arena: number; afterReward?: () => Promise<void>; faucetAmount?: bigint; faucetMinBalance?: bigint }): DemoActions {
  const { publicClient: client, admin, deployment: d } = options;
  const faucetAmount = options.faucetAmount ?? parseEther("0.2"), faucetMin = options.faucetMinBalance ?? parseEther("0.15");
  const queue = serialQueue(), sdk = createRupa({ publicClient: client, deployment: d });
  // Transactions whose outcome is not yet known, keyed by action. Recorded BEFORE broadcast so a send error
  // that hides an accepted transaction can never lead to a second mint. While any transaction of a signer is
  // unresolved, no new transaction is signed for it: the same signed bytes are rebroadcast instead, because a
  // load-balanced public RPC can report "unknown" from one node while another node already has the tx.
  type Pending = { hash: Hex; nonce: number; from: Address; raw?: Hex };
  const uncertain = new Map<string, Pending>();
  async function receipt(hash: Hex, action: string) {
    let result;
    try { result = await client.waitForTransactionReceipt({ hash, timeout: 45_000 }); }
    catch { throw new RupaError("TX_STATUS_UNKNOWN", "Demo transaction is pending; check its hash before retrying.", { txHash: hash }); }
    uncertain.delete(action);
    if (result.status !== "success") throw new RupaError("TX_REVERTED", "Demo transaction reverted.", { txHash: hash });
    return result;
  }
  // Only an explicit node rejection of the request proves the tx was not accepted; transport errors prove nothing.
  const rejected = (error: unknown) => error instanceof BaseError && !error.walk(e => e instanceof HttpRequestError || e instanceof TimeoutError) && !!error.walk(e => e instanceof RpcRequestError || e instanceof TransactionExecutionError || /insufficient funds|intrinsic gas|invalid/i.test((e as Error).message ?? ""));
  async function send(wallet: WalletClient, request: Parameters<WalletClient["prepareTransactionRequest"]>[0], action: string): Promise<Hex> {
    const from = wallet.account!.address;
    for (const [key, pending] of uncertain) if (pending.from.toLowerCase() === from.toLowerCase() && key !== action) await reconcile(key);
    if (wallet.account?.type !== "local") {
      // JSON-RPC (node-managed) signers cannot pre-sign; used only by the local Anvil demo.
      const sent = await wallet.sendTransaction(request as never);
      uncertain.set(action, { hash: sent, nonce: Number.MAX_SAFE_INTEGER, from });
      return sent;
    }
    const prepared = await wallet.prepareTransactionRequest(request);
    const raw = await wallet.signTransaction(prepared as never);
    const hash = keccak256(raw);
    uncertain.set(action, { hash, nonce: prepared.nonce!, from, raw });
    try { await client.sendRawTransaction({ serializedTransaction: raw }); }
    catch (error) {
      if (!rejected(error) || await known(hash)) throw new RupaError("TX_STATUS_UNKNOWN", "Demo transaction may have been submitted; it will be reconciled before retrying.", { txHash: hash });
      uncertain.delete(action);
      throw error;
    }
    return hash;
  }
  async function known(hash: Hex) { try { return !!await client.getTransaction({ hash }); } catch { return false; } }
  /**
   * Re-check a previously uncertain transaction. Returns its receipt if it confirmed; clears it if it reverted or
   * its nonce was definitively consumed by another transaction. Otherwise rebroadcasts the same signed bytes.
   */
  async function reconcile(action: string) {
    const pending = uncertain.get(action);
    if (!pending) return undefined;
    const result = await client.getTransactionReceipt({ hash: pending.hash }).catch(() => undefined);
    if (result) { uncertain.delete(action); return result.status === "success" ? result : undefined; }
    if (pending.raw) {
      const mined = await client.getTransactionCount({ address: pending.from, blockTag: "latest" }).catch(() => undefined);
      if (mined !== undefined && mined > pending.nonce) {
        // Nonce is used. Re-check our hash once more (another node may lag) before declaring it replaced.
        const again = await client.getTransactionReceipt({ hash: pending.hash }).catch(() => undefined);
        if (again) { uncertain.delete(action); return again.status === "success" ? again : undefined; }
        uncertain.delete(action); return undefined;
      }
      await client.sendRawTransaction({ serializedTransaction: pending.raw }).catch(() => undefined);
    }
    throw new RupaError("TX_STATUS_UNKNOWN", "A previous transaction is still pending.", { txHash: pending.hash });
  }
  function ready(wallet: WalletClient) {
    if (!wallet.account) throw new RupaError("NO_WALLET", "Demo signer is not configured.");
    return wallet.account;
  }
  function rewardResult(result: TransactionReceipt) {
    const mint = parseEventLogs({ abi: rupaAssetAbi, eventName: "AssetMinted", logs: result.logs.filter(log => log.address.toLowerCase() === d.contracts.RupaAsset.toLowerCase()), strict: true })[0];
    if (mint) return { assetId: mint.args.id.toString(), txHash: result.transactionHash, minted: true };
    const use = parseEventLogs({ abi: portLedgerAbi, eventName: "Used", logs: result.logs.filter(log => log.address.toLowerCase() === d.contracts.PortLedger.toLowerCase()), strict: true })[0];
    if (use) return { assetId: use.args.assetId.toString(), txHash: result.transactionHash, minted: false };
    return undefined;
  }
  return {
    ...(options.funder ? { balanceLow: async (address: Address) => await client.getBalance({ address }) < faucetMin, fund: (address: Address) => queue(async () => {
      const wallet = options.funder!, account = ready(wallet), action = `fund:${address}`;
      const done = await reconcile(action);
      if (done) return { txHash: done.transactionHash };
      if (await client.getChainId() !== d.chainId || await wallet.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Faucet chain mismatch.");
      if (await client.getBalance({ address }) >= faucetMin) throw new RupaError("INVALID_REQUEST", "This wallet already has enough demo gas.");
      const hash = await send(wallet, { account, chain: wallet.chain ?? null, to: address, value: faucetAmount }, action);
      await receipt(hash, action); return { txHash: hash };
    }) } : {}),
    reward: address => queue(async () => { const result = await rewardOnce(address); await options.afterReward?.().catch(() => undefined); return result; }),
  };
  async function rewardOnce(address: Address) {
      const account = ready(admin), action = `reward:${address}`;
      // A reward whose transaction confirmed after an earlier timeout counts as delivered.
      const done = await reconcile(action);
      if (done) { const result = rewardResult(done); if (result) return result; }
      if (await client.getChainId() !== d.chainId || await admin.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Demo admin chain mismatch.");
      // Contract state only (totalMinted/ownerOf/getBase): no log scans and no win index on the reward path.
      const owned = (await sdk.getOwnedAssets(address)).find(asset => asset.base.originAppId === options.arena && asset.base.assetType === RELIC_TYPE_HASH);
      if (owned) {
        const { request } = await client.simulateContract({ account, address: d.contracts.PortLedger, abi: portLedgerAbi, functionName: "recordUse", args: [owned.assetId, options.arena, keccak256(toBytes("WIN"))] });
        const hash = await send(admin, { account, chain: admin.chain ?? null, to: request.address, data: encodeFunctionData(request) } as never, action); await receipt(hash, action);
        return { assetId: owned.assetId.toString(), txHash: hash, minted: false };
      }
      const attrs = inlineContent(RELIC_ATTRS);
      const { request } = await client.simulateContract({ account, address: d.contracts.RupaAsset, abi: rupaAssetAbi, functionName: "mint", args: [address, RELIC_TYPE_HASH, 3, options.arena, attrs.hash, attrs.uri] });
      const hash = await send(admin, { account, chain: admin.chain ?? null, to: request.address, data: encodeFunctionData(request) } as never, action);
      const result = await receipt(hash, action);
      const mint = parseEventLogs({ abi: rupaAssetAbi, eventName: "AssetMinted", logs: result.logs.filter(log => log.address.toLowerCase() === d.contracts.RupaAsset.toLowerCase()), strict: true })[0];
      if (!mint) throw new RupaError("RPC_ERROR", "Mint receipt has no asset event.", { txHash: hash });
      // The mint is already confirmed. Subsequent victories record WIN independently.
      return { assetId: mint.args.id.toString(), txHash: hash, minted: true };
  }
}
