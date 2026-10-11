# @rupa/sdk

A viem client for asset discovery, passkey-approved ports, and verified provenance. The package is private to this workspace; it has not been published to npm.

## Read assets

Run `pnpm build:packages` at the repository root. A workspace consumer depends on `"@rupa/sdk": "workspace:*"`.

```ts
import { createPublicClient, http } from "viem";
import { createRupa, monadTestnetDeployment } from "@rupa/sdk";

const publicClient = createPublicClient({
  transport: http(monadTestnetDeployment.rpcUrl),
});
const rupa = createRupa({ publicClient });

// owner: viem Address; appId: a real registered uint32 app ID.
const assets = await rupa.getAssetsFor(owner, appId);
for (const asset of assets) {
  console.log(asset.assetId, asset.status, asset.view);
}
const history = assets.length
  ? await rupa.getProvenance(assets[0]!.assetId)
  : [];
```

The optional `appId` configuration is a default for `getAssetsFor(owner)`. Pass an explicit ID to override it. IDs for the three live demo apps are not yet registered; obtain them from the setup manifest instead of hardcoding 1/2/3.

Discovery scans incoming ERC-721 Transfer events, deduplicates candidates, then checks current ownership. It verifies content hashes and provenance before returning mapped views. A revoked or stale activation needs another port. `activation.approvedByPreviousOwner` identifies historical approvals retained after ownership changes. RPC failures throw; they do not return an empty list.

## Register and approve

Run browser approval code only at the deployment's exact origin. The existing Monad approver requires **https://rupa-mu.vercel.app**. Local Anvil uses a separate localhost approver.

```ts
import { createRupa, RupaError } from "@rupa/sdk";

const rupa = createRupa({
  publicClient,
  walletClient, // viem WalletClient with an account and matching chain
  agentUrl,     // public base URL, without /translate
});
const passkey = await rupa.passkey.register();

try {
  const result = await rupa.port(assetId, targetAppId, passkey, {
    onReview: async preview => {
      // Replace with your own dialog; false cancels before the passkey prompt.
      return window.confirm(
        `Approve app ${preview.targetAppId}, agent ${preview.agentId}, schema v${preview.schemaVersion}?`,
      );
    },
    onStep: (step, detail) => console.log(step, detail?.txHash),
  });
  console.log(result.txHash, result.recordId, result.mappingId);
} catch (error) {
  if (error instanceof RupaError) {
    if (error.code === "TX_STATUS_UNKNOWN") {
      // Check this receipt before submitting anything again.
      console.log(error.txHash);
    } else {
      console.log(error.code, error.message);
    }
  } else throw error;
}
```

Registration creates an ES256 credential and submits the owner's registration transaction. Save the returned **public** credential ID, qx/qy, and credential hash for subsequent approvals. Credential bytes are a Uint8Array and coordinates are bigint; encode them explicitly for browser storage. `rupa.passkey.rotate()` registers a replacement through the owner wallet and invalidates pending approvals. Biometrics and the authenticator's private key never enter the SDK.

The connected wallet must own the asset and pays the exact contract fee plus gas. The SDK resolves an active mapping or requests a confirmed agent proposal, independently verifies its rule/schema/hash, calls your review hook, refreshes nonce/ownership/schema, obtains the assertion, simulates the transaction, then submits. It refreshes critical state again after the prompt. A transaction race still reverts atomically onchain.

Progress: `mapping:cached` or `mapping:requesting`, then `passkey:prompt`, `tx:sent`, `tx:confirmed`. Observer errors cannot mask a sent transaction. Confirmation requires a successful receipt with the matching Ported event. This release uses the owner wallet as sender; no relayer adapter is included.

## API and content

| API/export | Result |
| --- | --- |
| `getAssetsFor(owner, appId?)` | Validated active/portable/unsupported asset views |
| `port(assetId, targetAppId, passkey, options?)` | txHash, recordId, mappingId |
| `getProvenance(assetId)` | Ordered Ported records with block time, schema version and transaction hash; verified against headOf |
| `getSourceAsset(assetId)` | Verified immutable attrs, live owner/base, origin WIN context |
| `getAppSchema(appId)` | App registry entry and content-verified schema |
| `applyMapping(mapping, context, schema)` | Pure deterministic view, validated on every call |
| `monadTestnetDeployment` | Exact public addresses/RP configuration from deployments/monad-testnet.json |
| `appRegistryAbi`, `rupaAssetAbi`, `mappingRegistryAbi`, `passkeyApproverAbi`, `portLedgerAbi` | Generated local contract ABIs |

See [types.ts](src/types.ts) and [errors.ts](src/errors.ts) for complete interfaces and stable error codes. Existing low-level helpers remain exported, including approval hashing, DER/COSE parsing, browser capture, and `verifyProvenance`.

Default content support: canonical `ipfs://` JSON through an HTTPS gateway, plus bounded canonical inline JSON for fixtures. Other HTTPS origins require `contentOrigins`; redirects and arbitrary URLs are rejected. Every response has a 64 KiB limit. A custom `content(uri, hash)` adapter must return a JSON object; the SDK still checks its canonical hash. Override `ipfsGateway` for your pinning provider.

`deployment.deploymentBlock` should be the first RupaAsset deployment block. The supplied live manifest has no verified receipt block, so the SDK discovers it with historical bytecode reads. An archive-capable RPC is required until that public block is recorded. Log reads use bounded chunks (`logRange`, default 100 to match the Monad public RPC `eth_getLogs` limit, fetched four chunks at a time), current snapshots and a block-hash consistency check. Large histories need an indexer in a future version; no indexer is silently trusted.

For tests, inject `fetch`, `content`, or `webauthn` adapters explicitly. Production uses the original browser helpers. The [E2E suite](../../tests/e2e/port.spec.ts) supplies a CDP authenticator, not a signature bypass.
