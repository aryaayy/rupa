# Deployment and setup runbook

## Existing Monad deployment

Use [deployments/monad-testnet.json](../deployments/monad-testnet.json), exported from the SDK. Chain **10143**, public RPC **https://testnet-rpc.monad.xyz**, RP ID **rupa-mu.vercel.app**, allowed origin **https://rupa-mu.vercel.app**.

All five addresses and both ledger bindings were supplied as already live. Admin/binder is `0x91b066AAaD3787518350E3b98d365080935c5fC8`. Its key is not in the repo and is not needed for the setup below. **Do not change, redeploy or rebind the protocol.** If a blocking contract bug is found, stop and report it.

The owner confirmed a Windows Hello approval on this deployment. Deployment receipt hashes and the RupaAsset creation block were not supplied; they remain null/empty in the manifest. The SDK discovers the creation block through historical bytecode reads when it is absent. Record a verified public receipt block to remove that archive lookup.

## Register the missing demo apps and identity

The owner confirmed that Arena/Social/Gallery app IDs and an ERC-8004 agent ID/service URL do not exist yet. The following is operator setup; it has not been broadcast here.

1. Choose a public HTTPS agent endpoint. Use separate, funded testnet demo-admin and agent wallets. App registration is permissionless; do not use the original protocol deployer's key.
2. Put only local/server values in ignored `.env`: `MONAD_RPC_URL`, `DEMO_ADMIN_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`, `AGENT_PUBLIC_URL`. Optionally add `PINATA_JWT` to publish schemas through IPFS. All names appear empty in [.env.example](../.env.example).
3. Run `pnpm setup:demo`. It registers Arena, Social and Gallery schemas, with the demo admin as minter/payout and 100 bps origin royalty, then registers the agent. It records IDs from confirmed events. It does not deploy or rewire contracts.
4. Keep `.local/setup-10143-<demo-admin-address>.json`. It checkpoints public submitted hashes before waiting and resumes those hashes on retry. Checkpoint app admin/minter/schema and agent signer are checked on reuse. Inspect reverted transactions before editing a checkpoint.
5. The public result is `deployments/demo-monad-testnet.json` (or `RUPA_RUNTIME_FILE`). Review it before committing. Set `RUPA_RUNTIME_FILE` to this file for the agent service.

An already-registered identity can be supplied with `AGENT_ID`; the configured wallet must match its registered agent wallet, or the identity owner if the agent wallet is zero. The adapter uses the upstream register(string)/Registered interface. A live registration smoke test remains required.

## Agent hosting

`pnpm dev:agent` builds and runs the service locally. On a host, build packages and `@rupa/agent`, then run `node services/agent/dist/main.js` with secret environment settings.

- `LLM_PROVIDER=mock` requires no paid provider. Without PINATA_JWT, canonical JSON is stored inline; label this fixture mode.
- `LLM_PROVIDER=openai-compatible` requires `LLM_BASE_URL` (HTTPS API base), `LLM_MODEL`, `LLM_API_KEY`, and `PINATA_JWT`. No model or account has been chosen automatically.
- Configure `AGENT_HOST` for the hosting network and `AGENT_PORT` as needed; local defaults are localhost:8787.
- Optional `DEMO_ADMIN_PRIVATE_KEY` enables game actions. Optional `FAUCET_PRIVATE_KEY` enables the server faucet with a small spending balance.
- `IPFS_GATEWAY` is an optional read gateway. A credentialed server RPC override is not returned by /config.

Use one process for this demo. Quotas, sessions and uncertain transaction records are in memory. Restarts reset limits; multiple replicas do not share them. Forwarded IP headers are ignored, so a reverse proxy may aggregate users under one peer quota. Add durable quotas/transaction storage before scaling or increasing the faucet balance. See [agent operations](../services/agent/README.md).

Health returns process readiness; it does not prove LLM/IPFS/RPC availability at every request. Smoke-test a new rule, confirmed proposal, owner port, provenance and repeat read before announcing readiness.

## Web / Vercel

Keep the same domain and origin. Configure:

| Setting | Value |
| --- | --- |
| Node | 24 |
| Install | pnpm install |
| Build | pnpm --filter @rupa/web build |
| Output | apps/web/dist |
| Public env | VITE_AGENT_URL = hosted HTTPS agent base URL |
| Optional public RPC | VITE_MONAD_RPC_URL, with no embedded secret |

`vercel.json` provides SPA rewrites for /arena, /social, /gallery, /docs and /capture. The filtered build builds the SDK/DSL first. Server signers, LLM keys and pinning tokens must never use the VITE_ prefix.

The verified capture UI remains at /capture. New UI/service deployment has not been performed in this task. Check direct-route refresh, WebAuthn on the exact origin, burner creation/funding, owner-preserving ports and timeline before advertising the full demo as live.

## Reproduction script

[contracts/script/Deploy.s.sol](../contracts/script/Deploy.s.sol) reproduces constructor order and both protected bindLedger calls without forge-std. It accepts chain 31337 or 10143; Monad requires explicit ALLOW_NEW_DEPLOYMENT and is blocked by default. **Do not enable this guard for the existing deployment.**

The script reads DEPLOYER_ADDRESS, IDENTITY_REGISTRY, RP_ID, ALLOWED_ORIGIN, PORT_FEE_WEI, FEE_RECIPIENT and PAUSE_ADMIN. Use a Foundry keystore/wallet option for signing, never a key argument in committed scripts. Local rehearsal tests verify wiring, immutable fee/RP configuration, repeat-binding rejection and chain guards. `pnpm demo` separately deploys the same sources on disposable Anvil.

## Release checks

Run pnpm check, build, test:e2e, test:fork, verify:monad and check:secrets in a network/socket-capable environment. Record real receipt hashes, deployment block, browser/device, app IDs and agent ID. Preserve the original Windows Hello path. No mock result is evidence of a live provider, native precompile, or hosted integration.
