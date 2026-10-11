# SDK and HTTP API

Implementation references: [SDK README](../packages/sdk/README.md), [types](../packages/sdk/src/types.ts), [typed errors](../packages/sdk/src/errors.ts), [agent README](../services/agent/README.md). The APIs below are implemented and tested with mocked clients; browser/chain E2E remains a separate gate.

## Public SDK

```ts
const rupa = createRupa({ publicClient, walletClient, agentUrl, appId });
const assets = await rupa.getAssetsFor(owner, appId);
const key = await rupa.passkey.register();
const result = await rupa.port(assetId, targetAppId, key, {
  onReview: async preview => showDialog(preview),
  onStep: (step, detail) => updateStatus(step, detail?.txHash),
});
const history = await rupa.getProvenance(assetId);
```

There is no chain string argument or admin facade. The deployment defaults to the exported Monad manifest; local tests explicitly pass their deployment. Admin operations use exported viem ABIs or the service's setup/demo adapters.

getAssetsFor returns active, portable or unsupported with a reason. Native origin assets use verified attrs. Target views require rule grammar, content hash, mapping metadata, current schema and tier invariants. Activation includes approver and approvedByPreviousOwner; historical activation survives transfer but live ownership determines discovery.

getProvenance reads Ported logs and their block timestamps, verifies every record against headOf and returns schema versions and transaction hashes. Missing, reordered, removed or tampered records fail closed. WIN counts use origin-app Used events, independent of the port hash chain.

The optional review hook runs after verified mapping resolution, before the passkey prompt. False cancels without submission. Nonce, deadline, ownership and schema/revocation are checked around the prompt, then the contract simulation/transaction enforces them again. TX_STATUS_UNKNOWN includes the submitted hash.

## Agent routes

POST /translate accepts only assetId (positive uint256 decimal string) and targetAppId (positive uint32 number). The server loads source/schema from its configured chain. It returns mappingId, contentURI, txHash (nullable for existing proposals), and reused after a confirmed proposal or verified reuse. Concurrent calls for one pair share generation; pending transaction outcomes require receipt reconciliation.

GET /config exposes public runtime configuration. GET /health reports process readiness, chain and mode. GET /.well-known/agent-card.json provides discovery metadata; setup stores an ERC-8004 registration card onchain. See the agent README for authenticated demo challenge/session/faucet/game routes.

Errors use `{ error: { code, message, requestId, txHash? } }`. Codes are stable; provider internals are redacted.

| Code category | HTTP behavior |
| --- | --- |
| Invalid JSON, IDs, body or demo session | 400 |
| Disallowed browser origin | 403 |
| Unknown route | 404 |
| Schema changed during generation | 409 |
| Mapping rejected / unsupported asset | 422 |
| Rate limited | 429 + Retry-After |
| RPC/provider/content/transaction uncertainty | 503 |

No retryable flag, job polling API, relayer, reputation selector or generic publisher/admin SDK is implemented. The owner wallet submits ports. Consumer cancellation and transaction-state errors remain typed SDK errors rather than fabricated HTTP success responses.

## Cache and trust

Key scope is chain + registry + asset type + target + schema version. Proposed is distinct from active: PortLedger activates on the first owner-approved port. Gallery requires its own mapping even after Social succeeds.

The SDK hashes content independently, including custom content adapters. The service signs only validated rules, but registry acceptance alone does not prove semantic validity; other agents are permissionless. Both agent and SDK validate actual output on every use. See [DSL](mapping-dsl.md) and [security](security.md).
