# Rencana pengujian

Status 11 Oktober 2026: original 42 tests kontrak tetap lulus, ditambah 3 deploy rehearsal tests. DSL/SDK/agent unit suite tersedia dan lulus pada hasil terbaru di verification notes. Pengguna mengonfirmasi fork dan Windows Hello pada Monad; rerun fork saat ini gagal DNS, E2E baru terhalang socket Anvil, gitleaks tidak tersedia. Hasil ada di [verification notes](verification-notes.md). Matriks berikut tetap target cakupan penuh, bukan daftar seluruh test yang sudah selesai.

## E2E yang diimplementasikan

pnpm test:e2e membangun packages/service/contracts, menyalakan disposable Anvil + mock LLM + web localhost, dan menjalankan tests/e2e/port.spec.ts. Chromium memakai [CDP WebAuthn](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/) melalui [Playwright CDP session](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session), resident credential dan user verification. Test menyelesaikan Arena mint, registration, dua port, memeriksa owner tetap, nonce +2, provenance dua target dan no retranslation setelah WIN. Test kedua memeriksa direct Docs/capture dan mobile overflow. Ini test nyata yang ditulis, belum hasil browser PASS; startup Anvil diblokir sandbox.

## Strategi

Gunakan Foundry untuk kontrak; Vitest untuk DSL, agent, dan SDK; property/fuzz test untuk batas input; fixture browser untuk WebAuthn; integration test terhadap anvil/mock RPC dan Monad testnet sebagai suite terpisah. Unit suite harus dapat berjalan tanpa API key LLM/pinning. Browser passkey penuh memerlukan perangkat yang mendukung dan origin yang konsisten.

## Matriks traceability

| Test ID | Requirement | Skenario dan hasil yang diharapkan |
| --- | --- | --- |
| T-AUTH-01 | FR-03/04 | Assertion browser nyata diverifikasi melalui actual precompile; digest SDK/contract sama |
| T-AUTH-02 | FR-04, NFR-03 | Replay/wrong nonce/dua tx bersamaan: hanya satu approval dapat sukses |
| T-AUTH-03 | FR-04 | Ubah chain, ledger, owner, asset, target, mapping, atau deadline: signature approval ditolak |
| T-AUTH-04 | FR-04 | Wrong RP hash, authData <37 bytes, UP=0, UV=0, wrong type/challenge: ditolak |
| T-AUTH-05 | FR-04 | Index out-of-bounds, offset Unicode, escaped/nested/duplicate field, wrong origin: parser menolak atau sesuai policy final yang diuji |
| T-AUTH-06 | FR-04 | High-s, r/s zero/out-of-range, invalid key/DER: ditolak; normalized valid signature diterima |
| T-AUTH-07 | FR-04 | Call fail, empty, short, long return, 32-byte zero: ditolak; hanya 32-byte one valid |
| T-AUTH-08 | FR-03 | Double registration, caller bukan ledger, unauthorized rotation: ditolak; key lama gagal setelah rotasi; nonce tidak reset |
| T-REG-01 | FR-01/02 | Register/mint/update/setMinter happy path; non-admin/minter, app invalid, rarity >4, bps >500 ditolak |
| T-REG-02 | FR-05/06 | Agent signature salah, domain salah, agent tidak ada, wallet berubah: ditolak; fallback hanya sesuai policy |
| T-REG-03 | FR-06 | Schema update, setActive pasangan salah, revoke active, unauthorized noteApproval: hasil sesuai registry policy |
| T-LEDGER-01 | FR-07 | Port valid mempertahankan owner, menambah nonce/approval tepat sekali, membentuk record/head benar |
| T-LEDGER-02 | FR-06/07/10 | Transfer sebelum submit, mapping revoked/stale/type-target mismatch: revert; recordUse non-admin/unrelated app: revert |
| T-LEDGER-03 | FR-13, NFR-03 | Exact fee, under/overpayment, payout fail dan reentrancy: tak ada partial state atau event paid palsu |
| T-LEDGER-04 | FR-07/10 | Port owner baru diperbolehkan; activation lama tetap tercatat; fromApp/prevRecord sesuai urutan |
| T-DSL-01 | FR-05, NFR-02 | Semua operator, missing optional+default, lookup miss, Unicode template, duplicate/unsafe path: output benar atau typed error |
| T-DSL-02 | FR-05 | Rarity 0–4, unknown tier, URL terlarang, caps payload/string: invariant ditegakkan |
| T-DSL-03 | FR-05, NFR-02 | Fuzz/property arbitrary input: tidak hang/execute code; output schema-valid dan invariant-valid atau typed error |
| T-DSL-04 | FR-05/07 | Fixture JCS/hash/type encoding sama di agent, SDK, Solidity; angka tidak presisi/duplicate key ditolak |
| T-AGENT-01 | FR-05 | Sepuluh pasangan assetType/schema valid; ≥3 sample per mapping termasuk extremes; retry ≤2 setelah initial |
| T-AGENT-02 | FR-05, NFR-01 | Tiga input injection mencoba menaikkan tier, menambah operator, mengeluarkan URL: hasil berbahaya ditolak sebelum signing |
| T-AGENT-03 | FR-05 | Schema/attrs hash mismatch, SSRF, remote ref, oversize, timeout, rate limit: fail dengan error terstruktur |
| T-AGENT-04 | FR-06 | Request concurrent pair sama, pending proposal, schema berubah, receipt timeout: tidak sign stale/duplikasi LLM tanpa batas |
| T-SDK-01 | FR-06/08 | Discovery transfer logs + live owner; active/portable/unsupported; revoke/schema invalidation; RPC failure bukan unsupported |
| T-SDK-02 | FR-07 | Chain hash lengkap diterima; record hilang/diubah/salah urut/head mismatch ditolak; timestamp block direkonstruksi |
| T-SDK-03 | FR-08/10 | Progress, async review/cancel sebelum prompt, perubahan nonce/schema selama review, receipt revert/unknown, WIN refresh; cache current tidak memanggil LLM |
| T-REP-01 | FR-12/14 | Evaluator filter, no-feedback, tie-break, self-feedback restriction, agent unavailable sesuai policy |
| T-OPS-01 | NFR-01/06 | Secret scan bersih; client bundle tanpa server env; build/dependency/ABI pinned; secret log disanitasi |
| T-DX-01 | FR-11 | Consumer bersih mengikuti quickstart dan menampilkan aset; waktu aktual dicatat |
| T-E2E-01 | FR-03–11 | Flow Arena → Social → Gallery → WIN refresh pada chain yang dituju dengan user wallet/passkey sendiri |
| T-E2E-02 | FR-06/09 | Cache Gallery yang disiapkan benar menghasilkan zero translate request; cache Social tidak dihitung sebagai cache Gallery |
| T-E2E-03 | NFR-05 | Keyboard, mobile layout, focus, error recovery, cancel tanpa loop prompt |

T-LEDGER-03 dapat berstatus `NOT APPLICABLE — payment cut` bila fee benar-benar dinonaktifkan dan keputusan dicatat. Suite keamanan lain tidak boleh dilewati untuk menyatakan MVP lengkap.

## Test vector dan fixture

Rencanakan `contracts/test/vectors/passkey-*.json` berisi public key, credential ID/hash, authenticatorData, clientDataJSON asli, DER dan normalized r/s, approval inputs, expected digest, browser/platform, origin/RP ID, serta hasil. Gunakan credential khusus test; tidak menyimpan private key atau biometric data.

Fixture challenge terikat chain, ledger, owner, nonce, deadline. Harness harus mereproduksi context tersebut atau merekam fixture baru; jangan mengubah signed clientData agar tampak cocok. Mock return precompile hanya untuk jalur handling return; P256 validasi kriptografis perlu verifier nyata atau testnet call terpisah.

Sepuluh pasangan mapping dapat memakai fixture jenis aset/schema berbeda tanpa membangun sepuluh aplikasi UI. Property suite menetapkan seed dan batas waktu; simpan counterexample yang menemukan bug.

## Device checklist

| Perangkat | Register | Approve onchain | Cancel/retry | Cached port | Rotate/recover | Status awal |
| --- | --- | --- | --- | --- | --- | --- |
| Windows Hello / origin live | Owner confirmed | Owner confirmed | Approval verifier confirmed | [ ] | [ ] | Browser version/fixture not supplied; full new flow pending |
| Chromium CDP / local | [ ] | [ ] | [ ] | [ ] | [ ] | Harness startup blocked by socket policy |
| iOS Safari | [ ] | [ ] | [ ] | [ ] | [ ] | NOT RUN |
| Android browser | [ ] | [ ] | [ ] | [ ] | [ ] | NOT RUN |

Isi versi OS/browser, perangkat, origin, chain/block, txHash, mode approval, dan tanggal uji. Target tiga platform; bukti minimal satu platform untuk M1 tidak otomatis memenuhi M10.

## CI yang dituju

PR: install dari lockfile, formatting/lint/typecheck, unit tests TypeScript, `forge fmt --check`, contract unit/fuzz tests, build, gitleaks. Fork tests dijalankan sebagai job terpisah saat RPC tersedia; `NOT RUN`/skip karena akses tidak boleh ditampilkan sebagai PASS. Tidak membagikan secrets ke untrusted fork PR.

Pre-release: semua test inti, fork nyata, manual device checklist, quickstart consumer, demo rehearsal, dan deployment manifest consistency. Security-critical failure memblokir release. Performance diukur dengan network/provider context dicatat, bukan assertion waktu ketat pada CI yang fluktuatif.

## Pencatatan hasil

Setiap hasil memuat test ID, revision, command, environment/tool versions, status, artefak/log yang aman, dan follow-up. Gunakan [verification notes](verification-notes.md). Sebuah test yang belum dibuat atau dijalankan tidak boleh dicentang hanya karena prosedurnya sudah ditulis.
