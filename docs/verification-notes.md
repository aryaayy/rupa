# Verification notes

Updated **11 October 2026**, working tree above `508c88d`. These notes distinguish owner-provided live evidence from checks run during this implementation. No live transaction, deployment, push or local commit was made here.

## Owner-confirmed baseline

The project owner reported M0–M2 complete: all original 42 Foundry tests, fork tests, and a real Windows Hello credential from **https://rupa-mu.vercel.app** verified by `PasskeyApprover.verifyApproval` on Monad testnet. The five deployed addresses, admin/binder, chain 10143 and both completed ledger bindings were supplied explicitly.

The [manifest](../deployments/monad-testnet.json) records that provenance of the deployment information. Deployment transaction hashes, RupaAsset creation block, browser version and a public Windows Hello fixture were not supplied; none have been invented. The owner also confirmed that demo app IDs and an ERC-8004 agent ID/service URL have **not** been created.

## Executed checks for this working tree

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| `pnpm check` | PASS | Package compilation, strict typecheck, **57 TypeScript tests in 9 files**, **45 Foundry tests**, Solidity formatting |
| Original contract suite | PASS | Original 42 tests unchanged, including 256 challenge fuzz runs |
| Deploy script rehearsal | PASS | Three new tests: both bindings/configuration, protected existing testnet, unsupported chain |
| `pnpm build` | PASS | DSL, SDK JS/declarations, Node service, web production bundle; Vite transformed 970 modules |
| Required filtered Vercel build | PASS | `pnpm --filter @rupa/web build` rerun after the final UI/E2E timing fix; strict typecheck also passes |
| `pnpm exec playwright test --list` | PASS | Two tests discovered; this does not execute a browser |
| `pnpm test:e2e` | BLOCKED / failed startup | Package/service/contract build succeeds; webServer exits 1 before browser assertions |
| Direct Anvil startup | BLOCKED | `anvil --port 8545 --chain-id 31337 --hardfork cancun --silent` returns `Operation not permitted (os error 1)` |
| `MONAD_RPC_URL=https://testnet-rpc.monad.xyz pnpm test:fork` | BLOCKED / failed RPC | Could not retrieve chain ID: DNS lookup temporary failure; no fork test passed in this rerun |
| `pnpm check:secrets` | BLOCKED | `gitleaks: not found`; no substitute scan is claimed as gitleaks |
| New script syntax | PASS | node --check for local-demo, setup-demo and ABI generator |
| Markdown/env checks | PASS | All 27 Markdown files: local links, balanced fences, newline; all .env.example values empty |
| `git diff --check` | PASS | No whitespace errors |
| Contract/passkey preservation | PASS | No diff in contracts/src, SDK passkey/approval/provenance helpers, or original handoff |
| Local branch/commits | BLOCKED | git switch -c feat/sdk-port cannot write .git/refs; metadata is read-only |
| Fresh install / GitHub CI | NOT RUN | Lockfile updated from cached registry metadata; no clean online install or remote CI result |
| Live agent/IPFS/provider and new UI rollout | NOT RUN | Configuration and real registration are still outstanding |

Foundry build emits existing lint advisories; successful tests are not an audit. The web build warns about its 504.88 kB main chunk (149.57 kB gzip); code splitting remains a performance follow-up. No blocking bug was found in the frozen core contracts.

## New coverage

- SDK: ownership-filtered discovery, deduplicated events, current mapping/schema/revocation checks, previous-owner labels, hash-chain verification, cache/request paths, cancellation, nonce/schema races, exact fees, transaction and agent-proposal unknown outcomes with hashes.
- Content: canonical byte/hash verification, immutable cached reads, bounded streams, unsafe origin/redirect/duplicate JSON rejection.
- DSL: canonical sorting/number rules, operator/path restrictions, required/default fields, output caps, URI/tier invariants, Ajv profile, all rarity levels and deterministic 300-case fuzzing.
- Agent: ten type/schema pairs, reusable rules, deduplication/cache, three injection classes rejected before signing, schema-change handling, registration/proposal transaction reconciliation.
- Access: signed challenge expiry/replay/wrong signer, peer-bound sessions, one-use duel rewards, faucet per-wallet/per-IP/global limits, CORS, malformed/oversized input, forwarded-header spoof resistance, redacted errors.

Mock-client tests do not prove the live ERC-8004 registration interface or provider account settings work. The browser suite uses an actual CDP virtual authenticator, a local identity fixture and a Solidity verifier performing real P256 math; it has not yet reached browser execution here.

## Dependencies and reproducibility

Runtime: Node 24.21.0, pnpm 10.20.0, Foundry 1.8.4, solc 0.8.24/Cancun. Dependency manifests pin TypeScript 5.9.3, viem 2.57.4, OpenZeppelin 5.6.1, Vite 8.3.4, Vitest 5.0.3, Ajv 8.20.0 and Playwright 1.63.0.

The sandbox cannot resolve external npm hosts. Existing installed dependencies came from matching local cached packages; Ajv/Playwright were installed offline into temporary directories and linked for validation. The lockfile was generated by pnpm using copied cache metadata, contains normal registry integrities/workspace links, and contains no temporary machine paths. This is evidence of component compatibility, not a clean-install proof. CI now requires frozen installation.

## Next evidence to collect

1. Install normally, run checks/build, Chromium E2E, fork and gitleaks in a network/socket-capable environment.
2. Review and create focused local commits with the required human author/committer. Do not push in this task.
3. Record the existing deployment's public receipt hashes and creation block; verify getter configuration without changing contracts.
4. Choose agent host/provider/pinning settings, register actual apps/identity with separate demo wallets, then run a live proposal and both ports.
5. Preserve the original Windows Hello proof and add the new UI flow, cancellation/recovery and additional device evidence.
6. Measure the clean consumer quickstart and hosted latency. Complete submission material separately.

## Primary references

- [Monad precompiles](https://docs.monad.xyz/developer-essentials/precompiles): native P256 behavior; a Solidity verifier or fork does not independently prove native RPC execution.
- [ERC-8004 repository](https://github.com/erc-8004/erc-8004-contracts) and [specification](https://eips.ethereum.org/EIPS/eip-8004): identity/wallet/registration interfaces. Upstream addresses agree with the supplied manifest; a source revision and new registration smoke remain to be recorded.
- [WebAuthn verification](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion): RP, origin, challenge and signature checks. Rupa intentionally supports a restricted clientDataJSON serialization.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): canonical JSON; the implemented bounded profile further rejects unsafe integers and unsafe object keys.
- [Ajv JSON Schema](https://ajv.js.org/json-schema.html), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat), [Pinata file upload](https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-file-to-ipfs), [CDP WebAuthn](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/): adapter/interpreter/test references, not evidence of live service success.

## Historical context

Before the owner's deployment update, the scaffold had 42 local Foundry and 16 SDK tests, no live browser evidence available in this workspace, and earlier pnpm/network bootstrap failures. Those initial limitations are superseded only where the current evidence above says so. In particular, the owner's successful fork/Windows Hello report is retained separately from this environment's failed rerun.
