# Rupa

**One asset. Every form.**

Rupa makes an asset usable across apps without transferring ownership. An agent proposes reusable mapping rules, the owner approves with a passkey, and Monad records the provenance. Arena, Social, and Gallery demonstrate the protocol through a relic, a profile badge, and an artwork.

## Current state

The five contracts are deployed on **Monad testnet (10143)**. The project owner confirmed M0–M2, fork tests, and a real Windows Hello assertion verified through `PasskeyApprover.verifyApproval` on [rupa-mu.vercel.app](https://rupa-mu.vercel.app). The existing contracts and passkey serialization have been preserved.

The repository now includes the SDK integration, shared mapping interpreter, Node agent service, demo routes, and a Playwright flow with a virtual authenticator. **The new full demo has not been deployed or verified end to end here.** Arena/Social/Gallery app IDs and an ERC-8004 agent ID/service URL have not been registered on the live deployment. The setup command records real IDs; none are fabricated.

| Contract | Monad testnet address |
| --- | --- |
| AppRegistry | `0x5c4844D52fFC7C0da41E327bF5669B77cb794998` |
| RupaAsset | `0x158E35817C8a5331FB74dF6F469dAD1fF345E8fa` |
| MappingRegistry | `0xc76290e99f8F0CBCd3Fe4AC7c2F7FE5202B9d31D` |
| PasskeyApprover | `0x89D710fb3a50fc552c806F04E7cE977614b25aA3` |
| PortLedger | `0xcc42457f4Ae0B847fa84A7F5b8E1af4BaEF11C85` |

The [deployment manifest](deployments/monad-testnet.json) is exported as `monadTestnetDeployment` from `@rupa/sdk`. Both ledger bindings are already configured. RP ID is `rupa-mu.vercel.app`; origin is `https://rupa-mu.vercel.app`. Do not redeploy or rebind these contracts.

## Run locally

Requires Node 24, pnpm 10.20.0, Foundry 1.8.4, and Chromium for E2E.

```bash
pnpm install --frozen-lockfile
pnpm demo
```

Open **http://localhost:5173/arena**. Create a demo wallet, request local MON, win the three-move duel, mint the relic, and register a passkey. Bring it to Social and Gallery and approve each port. Another Arena victory records a WIN; Social's title then changes without another model request.

`pnpm demo` starts a disposable Anvil chain, deploys unchanged contract sources locally, uses an identity fixture and mock LLM, and runs real local transactions with a Solidity P256 verifier. It never writes to Monad. No provider key is required. The browser stores a temporary burner key in this tab's session storage; use only demo funds. Use **localhost**, because passkeys reject IP hosts.

`pnpm dev` starts only the web app. `pnpm dev:agent` runs the configured agent using `.env`. `/docs` and `/capture` remain accessible without the demo backend. For live app/agent registration and service configuration, follow the [deployment runbook](docs/deployment.md).

## Develop and verify

```bash
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
MONAD_RPC_URL=https://testnet-rpc.monad.xyz pnpm test:fork
pnpm check:secrets
```

Evidence and remaining gates are recorded in [verification notes](docs/verification-notes.md). This environment cannot bind Anvil's port or resolve the Monad RPC, and has no `gitleaks` executable. E2E, fork reruns, and secret scanning therefore remain unverified here. Dependency versions are locked; a fresh network install and GitHub CI still need to run.

Vercel: Node **24**, install `pnpm install`, build `pnpm --filter @rupa/web build`, output `apps/web/dist`. `vercel.json` includes SPA rewrites. Configure public `VITE_AGENT_URL` after the agent is hosted; server secrets never belong in frontend variables.

## Integration and structure

- [SDK README and examples](packages/sdk/README.md): asset discovery, port approval, and verified event provenance.
- [Agent README](services/agent/README.md): mock/live providers, validation, signing, cache, and HTTP endpoints.
- [Development guide](docs/development.md), [judge guide](docs/judge-guide.md), and [documentation index](docs/README.md).
- [Original handoff](RUPA-HANDOFF.md), [PRD](docs/prd.md), and [decisions](docs/decisions.md).

```text
contracts/             Five contracts, deploy rehearsal, unit/fuzz/fork tests
deployments/           Public live manifest; no keys
packages/mapping-dsl/  Bounded deterministic interpreter and schema validator
packages/sdk/          viem client, WebAuthn, content verification and provenance
services/agent/        Rule generation, publication, proposal and demo backend
apps/web/              Arena, Social, Gallery, Docs and original capture tool
tests/e2e/             Chromium CDP WebAuthn flow on disposable Anvil
```

Reputation ranking, a second agent, external NFT wrapping, and npm publication remain outside this implementation. Mock rules use canonical inline JSON; the live provider adapter requires IPFS pinning. See [operational boundaries](docs/security.md) before exposing the demo service publicly.

## Contributions

All human contributors may contribute through pushes or pull requests according to repository access. Tools are not listed as contributors, authors, committers, or co-authors. Follow [CONTRIBUTING](CONTRIBUTING.md) and Conventional Commits. This development task must remain local for review; no push is authorized.

Licensed under [MIT](LICENSE).
