# Development

The SDK, mapping DSL, agent and all five web routes are implemented. Existing Monad contracts and the original WebAuthn helpers are unchanged. See [verification notes](verification-notes.md) for executed checks and environment blockers.

## Toolchain

Node 24.21.0, pnpm 10.20.0, Foundry 1.8.4, Solidity 0.8.24/Cancun, TypeScript 5.9.3, viem 2.57.4, OpenZeppelin 5.6.1, Ajv 8.20.0, Vite 8.3.4, Vitest 5.0.3 and Playwright 1.63.0 are pinned. Commit the lockfile; use `pnpm install --frozen-lockfile` on a clean checkout.

```bash
pnpm install --frozen-lockfile
pnpm demo
```

Open http://localhost:5173. WebAuthn needs localhost or HTTPS, not an IP hostname. The demo starts Anvil (8545), the Node agent (8787), and Vite (5173), creates disposable contracts/apps, and writes only public configuration to ignored `.local/deployment.json`. Stop with Ctrl-C. Restarting resets local chain state; use a fresh browser tab to discard stale burner credentials.

The local chain has ID 31337. It uses an identity fixture and the existing P256 Solidity verifier at 0x0100, which performs real signature math. `RUPA_LOCAL_FORK_RPC_URL` optionally forks upstream state, but all transactions still go to disposable Anvil. This is not evidence for Monad's native precompile.

## Commands

| Command | Purpose |
| --- | --- |
| pnpm dev | Build SDK dependencies, start web on localhost |
| pnpm dev:agent | Build SDK/agent, run configured service with root .env |
| pnpm demo | Start complete disposable local demo without provider keys |
| pnpm setup:demo | Register consumer apps and agent on existing Monad contracts; sends transactions |
| pnpm build | Build DSL, SDK, service and web |
| pnpm check | Package build, strict typecheck, Vitest, Foundry unit/fuzz/rehearsal, Solidity formatting |
| pnpm test:e2e | Build and run Chromium virtual-authenticator flow through local Anvil |
| pnpm test:fork | Read upstream registry state via MONAD_RPC_URL |
| pnpm verify:monad | Direct RPC chain/code and native P256 checks |
| pnpm generate:contracts | Regenerate SDK ABIs and manifest export from local build |
| pnpm check:secrets | Working-tree gitleaks scan; requires installed executable |

Before E2E, run `pnpm exec playwright install chromium` (or `--with-deps chromium` on CI Linux). Ports 5173, 8787 and 8545 must be free. Playwright launches its own local stack; do not run `pnpm demo` simultaneously. Tracing is disabled because browser storage contains a temporary private key. Failure screenshots contain only public UI.

CI enforces the lockfile, checks, builds, browser E2E, a separate fork job, and gitleaks. The workflow has been written but has not run on GitHub for this working tree. RPC availability is an external dependency of the fork job.

## Configuration and Git

Only `dev:agent` and `setup:demo` load root `.env` automatically. Export variables for the RPC/fork commands. Vite uses its normal app env files or build environment; `VITE_AGENT_URL` defaults to `/api`, proxied locally to localhost:8787. Production needs the public hosted agent URL.

All secret values remain server-side. The existing deployer's key is neither required for consumer registration nor requested. See [deployment](deployment.md) for separate demo/agent signers.

This task's author and committer must both be `Arya Aydin Margono <134766828+aryaayy@users.noreply.github.com>`; use focused Conventional Commits on a branch such as `feat/sdk-port`, no co-author trailer, and no push. Repository-wide contribution rules remain in [CONTRIBUTING](../CONTRIBUTING.md). This environment exposes Git metadata read-only, so branch creation and local commits are blocked; do not change permissions or create an alternate repository to bypass that restriction.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| WebAuthn origin/RP error | Use the exact manifest origin; Monad credentials cannot be used for local Anvil |
| Demo service unavailable | Register real app/agent IDs, set runtime manifest and VITE_AGENT_URL; inspect server health |
| Fork DNS failure | Retry in a network-enabled environment; do not substitute a mock result |
| Anvil Operation not permitted | Run outside an environment that forbids listening sockets |
| TX_STATUS_UNKNOWN | Inspect the returned hash before retry/restart |
| No gitleaks executable | Install gitleaks, then run the secret scan and hook |
| Very slow history scan | Record the verified deployment block and use an archive-capable RPC |

Do not weaken passkey, hash, schema, nonce or owner checks to make a demo pass.
