# Development backlog

Current state and milestone gates: [implementation plan](implementation-plan.md). Verification evidence: [verification notes](verification-notes.md). DONE below means the indicated component work is implemented and locally verified, not that hosted end-to-end acceptance is complete.

| ID | Status | Work and evidence |
| --- | --- | --- |
| M0–M2 baseline | OWNER-CONFIRMED | Tooling, five contracts, fork and Windows Hello; original 42 contract tests also rerun locally |
| M3 manifest | DONE | Exact supplied deployment exported from SDK; no guessed app/agent IDs |
| M3 rehearsal | DONE | No forge-std deploy script; both bindLedger calls; three passing guard/wiring tests |
| M4 setup | IMPLEMENTED | Real app/identity registration, pending-hash checkpoints, signer/schema checks; no live broadcast |
| M5-01 DSL | DONE | Shared operator whitelist, bounded JSON/JCS profile, Ajv schema validation, tier/URL invariants and fuzz tests |
| M5-02 service | DONE | Mock generator, cache/dedupe/retry, signing adapter, HTTP/auth/faucet unit tests |
| M5-03 live provider | IMPLEMENTED | OpenAI-compatible and Pinata adapters; external smoke pending |
| M6-01 reads | DONE | Event discovery, owner checks, content verification, dynamic WIN context and verified provenance |
| M6-02 approval | DONE | Register/rotate/port, review, progress and typed errors with unit tests |
| M6-03 admin | IMPLEMENTED | Service setup/demo adapters and exported ABIs; no generic SDK admin facade |
| M7-01 routes | IMPLEMENTED | Arena/Social/Gallery/Docs/capture, responsive UI and passkey flow; browser run pending |
| M7-02 demo access | DONE | Signed peer-bound sessions, server duel, capped faucet and one-use rewards; unit tests |
| M7-03 cache demo | IMPLEMENTED | Independent Social/Gallery rules; E2E checks no retranslation after WIN |
| M8 reputation | DEFERRED | No scoring/feedback selector or second agent claimed |
| M8 royalty | BASELINE | Original fee/payment behavior retained; live payment smoke pending |
| M9-01 docs | DONE | API, runbooks, examples and known limitations synchronized |
| M9-02 quickstart | TODO | Fresh external consumer and timed integration |
| M10-01 E2E | BLOCKED HERE | CDP authenticator suite implemented; Anvil cannot open port in sandbox |
| M10-02 fork | BLOCKED HERE | Rerun fails RPC DNS; previous success confirmed by owner |
| M10-03 secrets | BLOCKED HERE | gitleaks executable missing |
| M10-04 local commits | BLOCKED HERE | .git read-only; no branch/commit/push created |
| M10-05 live rollout | TODO | Choose service settings, register apps/agent, host and verify on the existing domain |
| M10-06 release material | TODO | Device matrix, video, pitch, deadline verification and submission assets |

The owner explicitly confirmed missing app IDs and agent identity/service URL. Do not invent them. Do not request the protocol deployer's key; consumer registration uses separate wallets and permissionless contracts. Do not redeploy protocol contracts.
