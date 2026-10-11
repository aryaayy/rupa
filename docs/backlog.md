# Backlog development

Tanggal baseline: 11 Oktober 2026. Status: `DONE` hanya untuk dokumentasi awal; `TODO` belum dikerjakan; `DEFERRED` menunggu tahap deployment sesuai arahan pengguna. Owner implementasi belum dibagi. Estimasi dan urutan milestone ada di [implementation plan](implementation-plan.md).

## Bootstrap dan risiko utama

| ID | Status | Task | Dependency | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| M0-00 | DONE | Telaah handoff dan siapkan dokumen development | Handoff | PRD, spesifikasi, decision log, backlog, runbook; pemeriksaan tautan lokal |
| M0-01 | TODO | Scaffold pnpm monorepo, TS, Foundry, app shell | M0-00 | Package boundaries sesuai arsitektur; versi runtime/deps pinned; install/build dasar berfungsi |
| M0-02 | TODO | Git hygiene, MIT license, ignore, empty env template | M0-00 | Tidak ada secret; identitas setiap kontributor manusia sesuai D-14, tanpa atribusi contributor agent AI; remote tidak dibuat otomatis |
| M0-03 | TODO | CI dan pre-commit secret scan | M0-01/02 | Workflow menjalankan command nyata; unit/build/scan dapat direproduksi |
| M0-04 | TODO | Verifikasi RPC, bytecode/ABI registry, P256 vectors, local support | M0-01 | V-04–V-08 di verification notes mempunyai hasil, source revision/block |
| M1-01 | TODO | Browser registration/assertion capture + DER/COSE parsing | M0-01 | Fixture ≥1 platform; format public key/challenge benar |
| M1-02 | TODO | Approver, WebAuthnLib, Base64Url, ledger harness | M0-04, M1-01 | T-AUTH-01–08; parser/origin policy D-05 dikunci |
| M1-03 | TODO | Evaluasi spike 3 jam dan catat mode approval | M1-02 telah dimulai | Evaluasi saat timebox berakhir meskipun spike terhambat; WebAuthn evidence atau fallback D-12 eksplisit |

## Core, DSL, dan SDK

| ID | Status | Task | Dependency | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| M2-01 | TODO | AppRegistry + RupaAsset | M0-01 | FR-01/02; permissions, rarity/bps boundaries; native asset discovery events |
| M2-02 | TODO | MappingRegistry + ERC-8004 adapter | M0-04, M2-01 | EIP-712 validation, cache/schema/revoke behavior; T-REG-02/03 |
| M2-03 | TODO | PortLedger + provenance encoding | M1-02, M2-01/02 | D-06 locked; byte-identical TS/Solidity fixtures; T-LEDGER-01/02/04 |
| M2-04 | TODO | Wiring, fee/pause decision dan revert atomicity | M2-03 | D-08/D-10 locked; protected one-time bind; T-LEDGER-03 bila payment enabled |
| M5-01 | TODO | DSL schema/interpreter/validator shared | M0-01, spesifikasi DSL | Operator/paths/caps/invariants; T-DSL-01–04 |
| M5-02 | TODO | Agent pipeline dan HTTP errors | M5-01, M2-02 interface | Stub provider suite, retry/rate limit/dedupe; sepuluh pair dan tiga injection cases |
| M5-03 | DEFERRED | Live provider/pinning/signer/proposal | M3-01, M4-01, Q-02/03 | Confirmed proposal dari output valid; content hash cocok; no keys in prompts |
| M6-01 | TODO | SDK read/discovery/cache/provenance | M2-03, M5-01 | T-SDK-01/02 dengan mocks/local chain; typed result/errors |
| M6-02 | TODO | SDK passkey register/rotate/port/progress | M1-02, M6-01 | T-SDK-03, cancel/deadline/nonce handling; true receipt success |
| M6-03 | TODO | Admin helpers, content adapter, SDK build | M6-01/02 | Server secrets terisolasi, declarations/build; clean consumer local import |

## Demo dan integrasi

| ID | Status | Task | Dependency | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| M7-01 | TODO | Satu web app, route, wallet, passkey UX | M6 interfaces | UX state dan error sesuai spesifikasi; keyboard/mobile smoke |
| M7-02 | TODO | Arena mint/use, Social frame, Gallery card | M6-03, M7-01 | Full local flow dan dynamic WIN title tanpa LLM baru |
| M7-03 | TODO | Demo admin access dan fixture cache per target | M7-02 | Admin auth/rate limit; Gallery mapping benar-benar active, Social pair fresh untuk live script |
| M7-04 | TODO | Landing, dev panel, docs routes, waitlist | M7-01, dokumen baseline M0-00 | Snippet cocok API; status cache/score jujur; waitlist memakai penyimpanan nyata bila diaktifkan |
| M8-01 | TODO | Reputation adapter dan pilihan agent | M0-04, M6-01 | T-REP-01; evaluator policy/no-score handling |
| M8-02 | DEFERRED | Feedback dan royalty live | M3/4, M8-01 | Bukti tx feedback; payment claim sesuai transfer nyata atau feature cut tercatat |
| M9-01 | TODO | Sinkronisasi docs ke API aktual | M6/M7 | Tidak ada command/field drift; ABI/address status nyata |
| M9-02 | TODO | Uji quickstart dari consumer bersih | M6-03, M9-01 | T-DX-01; waktu dan hasil dicatat |

## Deployment dan submission, dikerjakan nanti

| ID | Status | Task | Dependency | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| M3-01 | DEFERRED | Domain final, Deploy.s.sol, testnet deploy/verify | M2, Q-01 | Lima alamat, block, tx, binding, RP hash, ABI pada manifest |
| M4-01 | DEFERRED | Registrasi agent pertama dan card | M0-04, provider/endpoint final | ID dan wallet/card sesuai; sumber ABI tercatat |
| M4-02 | DEFERRED | Agent kedua | M4-01, core stabil | Identitas berbeda dan endpoint/model jelas; cuttable |
| M10-01 | DEFERRED | Hosting web/agent dan env produksi | Q-01–04, M3–M7 | Satu HTTPS origin; service health; tidak ada secrets client |
| M10-02 | DEFERRED | Fork/live tests dan tiga device checklist | M10-01 | T-E2E-01–03, browser matrix, limitation aktual |
| M10-03 | DEFERRED | Logo, demo/pitch video, README final | M10-02 | Format/ukuran/durasi sesuai handoff; live flow nyata |
| M10-04 | DEFERRED | Repo access dan submission readiness | M10-03, Q-05 | Repo publik/akses juri diverifikasi; history identity sesuai; checklist lengkap |

## Cuttable, jangan mendahului critical path

ValidationRegistry, wrapper external NFT, React SDK components, Phaser, auto-invalidate transfer, serta demo burner/faucet jika wallet + faucet standar sudah cukup. Ikuti urutan pengurangan scope handoff; jangan menghapus validasi atau persetujuan onchain untuk mengejar UI.

## Saat memperbarui status

Cantumkan revision/artefak/hasil test pada task yang DONE. Jika sebuah task terhambat, tulis penyebab spesifik dan pekerjaan lokal yang masih bisa dilanjutkan. Status DEFERRED deployment mencerminkan arahan pengguna, bukan kegagalan dokumentasi atau hasil test.
