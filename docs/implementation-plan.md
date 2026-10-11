# Implementation plan

M0–M2 are complete according to the project owner's handoff: 42 original contract tests, fork tests and a real Windows Hello approval on Monad. Existing protocol contracts are frozen. This task extends the SDK, agent and demo without replacing them.

## Current milestones

| Milestone | Current state | Remaining evidence |
| --- | --- | --- |
| M0 Bootstrap | Owner-confirmed baseline; lockfile/toolchain/CI configured | Fresh install and updated CI run |
| M1 WebAuthn | Owner-confirmed Windows Hello; original helpers preserved | Other devices and new UI flow |
| M2 Contracts | Original 42 tests pass; three new deploy-rehearsal tests pass | No protocol changes required |
| M3 Deployment | Existing addresses and bindings supplied; manifest/SDK export added | Public receipt hashes and creation block |
| M4 Agent identity | Registration/checkpoint script implemented | Real app IDs, agent ID and service URL; none exist yet |
| M5 DSL/agent | Shared interpreter, mock/live adapters, signing and cache implemented; unit tested | Hosted provider/IPFS/chain smoke |
| M6 SDK | Discovery, port, register/rotate, provenance and typed errors implemented; unit tested | Browser/chain E2E and clean consumer |
| M7 Consumers | Arena, Social, Gallery, Docs, capture, burner and bounded server actions implemented | Local browser execution and live rollout |
| M8 Reputation/royalty | Original real royalty contracts retained; no reputation UI/selector | Reputation is outside this implementation; payment live smoke |
| M9 Documentation | API examples and operating docs updated | Timed external quickstart |
| M10 Release | CDP WebAuthn E2E and CI configured | Execute E2E, fork rerun, gitleaks, live rehearsal, submission assets |

The current sandbox blocks Anvil socket binding and external DNS; gitleaks is absent and Git metadata is read-only. [Verification notes](verification-notes.md) distinguish successful component checks from blocked gates. Do not claim M5–M10 fully complete based on mock tests.

## Next sequence

1. Run the committed-intent working tree through checks, E2E, fork and gitleaks in an unrestricted development environment.
2. Review focused local commits using the user-specified human identity; do not push in this task.
3. Choose the agent host and optional paid provider/model/pinning settings.
4. Run the registration setup against existing Monad contracts with separate funded demo/agent wallets; record actual public IDs.
5. Host the agent, build Vercel with Node 24 and the public agent URL, preserving the same domain/RP binding.
6. Rehearse the full flow and additional devices; record public transaction evidence before advertising the new demo as live.

## Scope decisions

Vanilla TypeScript/Vite and Node's HTTP server continue the existing lightweight application, replacing the handoff's optional React/Fastify choices (D-07). The default local demo uses reusable mock rules and inline canonical content; live rule generation uses a configured provider and Pinata adapter (D-15). Gallery has an independent cache pair; fresh local E2E requests one rule per target.

No agent ranking, second agent, NFT wrapper, waitlist, React SDK components or production indexer is included. The ownership, onchain P256 approval and deterministic mapping requirements remain mandatory. No raw-P256 fallback was added.
