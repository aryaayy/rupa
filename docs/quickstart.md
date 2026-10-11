# Developer quickstart

The SDK APIs are implemented; the ten-minute integration target has not been measured on a clean external consumer. The package is private to the workspace.

## Local product

```bash
pnpm install --frozen-lockfile
pnpm demo
```

Open http://localhost:5173/arena. Use the local judge flow in [judge guide](judge-guide.md). This environment could compile and test components but could not start Anvil's listening socket.

## Consumer integration

Add `"@rupa/sdk": "workspace:*"` to a workspace consumer and build with `pnpm build:packages`. Supply a viem PublicClient and WalletClient, a real target app ID and the agent's public base URL:

```ts
import { createRupa } from "@rupa/sdk";

const rupa = createRupa({ publicClient, walletClient, agentUrl, appId });
const assets = await rupa.getAssetsFor(connectedAddress);
const key = await rupa.passkey.register();
const result = await rupa.port(selectedAssetId, appId, key, {
  onReview: preview => showApprovalDialog(preview),
  onStep: (step, detail) => updateStatus(step, detail?.txHash),
});
const history = await rupa.getProvenance(selectedAssetId);
```

The dialog returns Promise<boolean>. The public key descriptor returned by register must be retained for subsequent ports; its Uint8Array/bigint fields need explicit serialization. Read methods can run anywhere. Approval must run at the deployment's exact origin: https://rupa-mu.vercel.app for Monad, or http://localhost:5173 for the separate local fixture.

Use active views only after validation. Show portable assets with a review/approval action, and unsupported reasons explicitly. Catch RupaError codes; preserve txHash on TX_STATUS_UNKNOWN and inspect the receipt before retrying.

Complete examples, content adapters, ownership checks, log scanning limits and exports are in the [SDK README](../packages/sdk/README.md). The [agent README](../services/agent/README.md) documents configuration and endpoints.

## Origin integration

Use the exported contract ABIs with an authorized viem server/admin wallet for registerApp, mint and recordUse. The three-app setup helper and demo actions provide examples in services/agent. There is no public rupa.admin facade in this release. Keep signers and pinning credentials server-side.

The live app IDs and agent ID remain unregistered. Follow [deployment setup](deployment.md) to record actual IDs without replacing the deployed contracts. Validate a clean consumer, revoke/schema-change handling, provider failure and device compatibility before calling the quickstart fully verified.
