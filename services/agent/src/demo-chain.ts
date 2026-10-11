import { createRupa, inlineContent, portLedgerAbi, rupaAssetAbi, RupaError } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";
import { keccak256, parseEther, parseEventLogs, toBytes } from "viem";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { RELIC_ATTRS, RELIC_TYPE_HASH } from "./demo.js";
import type { DemoActions } from "./demo.js";
import { serialQueue } from "./limits.js";

export function createDemoActions(options: { publicClient: PublicClient; admin: WalletClient; funder?: WalletClient; deployment: RupaDeployment; arena: number }): DemoActions {
  const { publicClient: client, admin, deployment: d } = options;
  const queue = serialQueue(), sdk = createRupa({ publicClient: client, deployment: d });
  const uncertain = new Map<string, Hex>();
  async function receipt(hash: Hex, action: string) {
    uncertain.set(action, hash);
    let result;
    try { result = await client.waitForTransactionReceipt({ hash, timeout: 45_000 }); }
    catch { throw new RupaError("TX_STATUS_UNKNOWN", "Demo transaction is pending; check its hash before retrying.", { txHash: hash }); }
    uncertain.delete(action);
    if (result.status !== "success") throw new RupaError("TX_REVERTED", "Demo transaction reverted.", { txHash: hash });
    return result;
  }
  function ready(action: string, wallet: WalletClient) {
    if (!wallet.account) throw new RupaError("NO_WALLET", "Demo signer is not configured.");
    const hash = uncertain.get(action);
    if (hash) throw new RupaError("TX_STATUS_UNKNOWN", "A previous transaction needs reconciliation.", { txHash: hash });
    return wallet.account;
  }
  return {
    ...(options.funder ? { fund: (address: Address) => queue(async () => {
      const wallet = options.funder!, account = ready(`fund:${address}`, wallet);
      if (await client.getChainId() !== d.chainId || await wallet.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Faucet chain mismatch.");
      if (await client.getBalance({ address }) >= parseEther("0.003")) throw new RupaError("INVALID_REQUEST", "This wallet already has enough demo gas.");
      const hash = await wallet.sendTransaction({ account, chain: wallet.chain ?? null, to: address, value: parseEther("0.01") });
      await receipt(hash, `fund:${address}`); return { txHash: hash };
    }) } : {}),
    reward: address => queue(async () => {
      const account = ready(`reward:${address}`, admin);
      if (await client.getChainId() !== d.chainId || await admin.getChainId() !== d.chainId) throw new RupaError("WRONG_CHAIN", "Demo admin chain mismatch.");
      const owned = (await sdk.getAssetsFor(address, options.arena)).find(asset => asset.base.originAppId === options.arena && asset.base.assetType === RELIC_TYPE_HASH);
      if (owned) {
        const { request } = await client.simulateContract({ account, address: d.contracts.PortLedger, abi: portLedgerAbi, functionName: "recordUse", args: [owned.assetId, options.arena, keccak256(toBytes("WIN"))] });
        const hash = await admin.writeContract({ ...request, chain: admin.chain ?? null }); await receipt(hash, `reward:${address}`);
        return { assetId: owned.assetId.toString(), txHash: hash, minted: false };
      }
      const attrs = inlineContent(RELIC_ATTRS);
      const { request } = await client.simulateContract({ account, address: d.contracts.RupaAsset, abi: rupaAssetAbi, functionName: "mint", args: [address, RELIC_TYPE_HASH, 3, options.arena, attrs.hash, attrs.uri] });
      const hash = await admin.writeContract({ ...request, chain: admin.chain ?? null });
      const result = await receipt(hash, `reward:${address}`);
      const mint = parseEventLogs({ abi: rupaAssetAbi, eventName: "AssetMinted", logs: result.logs.filter(log => log.address.toLowerCase() === d.contracts.RupaAsset.toLowerCase()), strict: true })[0];
      if (!mint) throw new RupaError("RPC_ERROR", "Mint receipt has no asset event.", { txHash: hash });
      // The mint is already confirmed. Subsequent victories record WIN independently.
      return { assetId: mint.args.id.toString(), txHash: hash, minted: true };
    }),
  };
}
