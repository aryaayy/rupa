# Rupa agent service

Node 24 HTTP service using viem and the same `@rupa/mapping-dsl` validator as the SDK. It reads the source asset and target schema from chain, generates a reusable JSON rule, validates it, publishes canonical content, signs EIP-712, and proposes it in MappingRegistry. PortLedger binds the active mapping only after owner approval; the agent never calls the ledger's privileged binding functions.

## Start

For the complete keyless local demo, use `pnpm demo` from the root. It runs this service with mock rules, disposable local contracts, and an identity fixture.

For the existing Monad contracts, first follow [setup and hosting](../../docs/deployment.md). `pnpm dev:agent` builds the packages and loads root `.env`. Configuration names are listed with empty values in [.env.example](../../.env.example).

| Variable | Purpose |
| --- | --- |
| RUPA_RUNTIME_FILE | Public manifest with real apps and agentId, normally deployments/demo-monad-testnet.json |
| MONAD_RPC_URL | Server RPC override; may contain credentials, never returned to browsers |
| AGENT_PRIVATE_KEY, AGENT_ID | Registered agent's signer and ID; AGENT_ID can come from the manifest |
| AGENT_HOST, AGENT_PORT | Defaults localhost and 8787; choose an external bind interface only on the host |
| LLM_PROVIDER | mock (default) or openai-compatible |
| LLM_BASE_URL, LLM_MODEL, LLM_API_KEY | HTTPS provider API base, explicit model, server credential |
| PINATA_JWT | Required by the live provider mode; optional in mock mode |
| IPFS_GATEWAY | Optional read gateway; default https://ipfs.io/ipfs/ |
| DEMO_ADMIN_PRIVATE_KEY | Optional app minter/admin for the demo game |
| FAUCET_PRIVATE_KEY | Optional limited-balance faucet; requires demo admin actions |

Mock mode returns rules with templates, enum maps and defaults, not a per-asset answer. It uses inline canonical JSON when no pinning credential is configured; this is explicitly a fixture storage mode. Live mode sends JSON-mode Chat Completions requests and pins the exact canonical file with Pinata. Neither paid-provider access nor pinning was exercised here. References: [Chat Completions](https://developers.openai.com/api/reference/resources/chat), [Pinata file upload](https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-file-to-ipfs).

The small immutable Fire Sword attributes remain an inline fixture in both demo modes. The 0.01 MON faucet grant has not been checked against live gas/fee costs; fund a test burner adequately during the live rehearsal.

## Routes

| Route | Behavior |
| --- | --- |
| GET /health | Process/config readiness, chain and mock/live mode; no paid provider probe |
| GET /config | Public deployment, registered apps/agent, provider mode and faucet availability |
| GET /.well-known/agent-card.json | Public service discovery; onchain registration stores the full ERC-8004 card |
| POST /translate | Body `{ "assetId": "42", "targetAppId": 2 }`; returns confirmed mappingId, contentURI, txHash (or null for reuse), reused |
| POST /demo/challenge | Body address; returns short-lived wallet-signature challenge |
| POST /demo/session | Body nonce/signature; returns peer-bound bearer session |
| POST /demo/fund | Authenticated, bounded faucet action |
| POST /demo/start, /demo/play | Authenticated server-side duel, with play body move |
| POST /demo/reward | Authenticated mint or WIN after a completed duel |

IDs above are illustrative. Request input cannot supply attributes, schema, RPC URLs or signer credentials. Source fields sent to the model are limited to public name/element, rarity and WIN count. Rules must pass actual-source plus three boundary fixtures; every SDK execution validates its actual output again. A maximum of three generation attempts is allowed. No rejected rule is signed.

Cache/deduplication key: chain + registry + assetType + target app + schema version. The registry's active pointer is checked on reuse; cached proposals are checked for revocation/schema changes too. Pending requests share one generation. Unknown proposal transaction outcomes block resubmission until their receipt is reconciled. The signer is checked against the registered agent wallet, falling back to the identity owner when that wallet is zero.

## Limits and operations

- JSON bodies and provider/content responses: 64 KiB. Requests: 90/IP/minute; translations: 12/IP/minute, 6 generated/type/minute, four concurrent pairs.
- CORS allows the exact deployment origin. CORS is not authentication.
- Login challenges expire in two minutes; sessions expire in one hour and are bound to the socket peer.
- Faucet: at most 0.01 MON per wallet per process, three wallets/IP/hour, twenty globally/hour, 1000 funded-wallet records per process. A wallet with at least 0.003 MON is rejected.
- Duels and rewards: ten/address/hour; rewards also capped at 100/hour globally. A victory is consumed before mint/use submission.
- Errors expose stable codes, request IDs and submitted transaction hashes, never provider exception text.

Caches, sessions, proposal reconciliation and rate limits are **in memory**. Run one process with a small faucet balance. Restarting loses these limits and pending records; inspect pending transactions before restarting. A public multi-instance deployment needs durable shared quotas and transaction tracking first. Forwarded-IP headers are deliberately ignored; behind a reverse proxy all callers may share one quota. Configure ingress limits separately rather than trusting arbitrary headers.

No live app/agent ID has been created by this implementation. `setup:demo` checkpoints each submitted registration hash and resumes it on retry. Keep its public checkpoint in `.local/`; never delete a pending record without inspecting the receipt.

The full local/browser path still needs execution in an environment that permits Anvil and browser processes. Unit tests validate translator behavior, injection rejection, signed sessions, faucet bounds, HTTP validation and transaction reconciliation.
