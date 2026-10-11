# Decision log

Tanggal baseline: 11 Oktober 2026. **Tetap** berasal dari keputusan eksplisit handoff. **Baseline kerja** adalah rincian reversible untuk memandu implementasi. **Usulan** harus diselesaikan pada gate teknis yang disebut; tidak semuanya membutuhkan keputusan pengguna. **TBD pengguna** hanya untuk pilihan produk/infrastruktur yang belum diberikan.

## Keputusan tetap

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D-01 | Rupa; `One asset. Every form.`; `@rupa/sdk`; pnpm; repo `aryaayy/rupa` | Tidak mengganti branding atau membuat remote baru tanpa instruksi |
| D-02 | Ownership tetap; mapping berupa rules; eksekusi deterministik | Tidak ada bridge, burn/mint saat port, atau output LLM per aset |
| D-03 | Lima kontrak Rupa, existing ERC-8004, Monad testnet, P256 onchain | Tidak deploy registry ERC-8004 sendiri; M0 memverifikasi dependency |
| D-04 | Satu origin dengan route demo; RP ID fixed saat deploy | Pergantian domain setelah deploy memerlukan evaluasi/redeploy approver |

## Rincian implementasi

### D-05 — Verifikasi WebAuthn

Status: **M1 dikonfirmasi pengguna dengan Windows Hello di Monad**; perangkat/browser lain dan flow UI baru tetap perlu diuji. Ledger menghitung hash dari current nonce/live owner; approver hanya menerima ledger. Pemeriksaan UP, UV, RP ID, deadline, range/low-s, dan hasil precompile tersedia. Penguatan terhadap handoff: exact allowed origin tanpa setter; whole-byte JSON comparison hanya menerima urutan `type/challenge/origin` dengan `crossOrigin:false` opsional. Nested/duplicate fields, field tambahan, whitespace, escaping, atau urutan lain ditolak; `typeIndex=1`, `challengeIndex=23`. Ini pembatasan kompatibilitas yang disengaja sampai fixture browser tersedia, bukan parser WebAuthn umum. Rotation menaikkan nonce bahkan saat key yang sama dipilih untuk membatalkan approval tertunda. Unit tests memakai crypto P256 nyata melalui verifier Solidity lokal. Bukti Windows Hello pada Monad berasal dari konfirmasi pengguna; rerun RPC saat ini tertahan DNS. Lihat [security](security.md).

### D-06 — Hash provenance

Status: **diterapkan dan diuji lintas Solidity/TypeScript**, gate M2. `recordId = keccak256(abi.encode(record))` dengan `prevRecord` sekali di dalam tuple memperjelas rumus ambigu pada handoff §4.5. Fixture publik berada di `contracts/test/vectors/protocol.json`. Kontrak memakai `uint64(block.timestamp)`; SDK event reader sekarang mengambil timestamp block dan memverifikasi records terhadap headOf; helper pure tetap menerima records lengkap. `fromAppId` berarti target port sebelumnya, atau origin untuk port pertama; bukan lokasi custody. Helper menolak record hilang, perubahan asset/urutan/hash, timestamp mundur, dan head tidak cocok.

### D-07 — Runtime, UI, dan indexing

Status: **diterapkan**. Node 24.21.0/pnpm 10.20.0, Solidity 0.8.24/Foundry 1.8.4 dan dependency TypeScript dipin. Consumer meneruskan TypeScript + Vite yang sudah ada; agent memakai Node HTTP builtin. Ini menggantikan pilihan React/Fastify handoff §7 untuk mempertahankan aplikasi kecil dan jalur capture yang sudah ada. SDK membaca event dalam chunk, memeriksa snapshot/head/live owner, dan memverifikasi content. Indexer khusus ditunda. Lockfile telah diperbarui secara offline dari registry metadata cache; fresh install dan CI baru belum dibuktikan.

### D-08 — Royalty

Status: **diterapkan dan diuji lokal**, gate M2/M3. Constructor menetapkan `PORT_FEE` dan `feeRecipient` immutable; fee live dibaca SDK melalui PORT_FEE; nilai deployment belum dicatat dalam manifest. Fixture lokal memakai 0.001 MON. `msg.value` harus tepat fee; `royalty = floor(PORT_FEE * originApp.royaltyBps / 10_000)` dibayar ke payout origin, sisanya ke feeRecipient. Ini memperjelas ketidakselarasan fee tetap/bps pada handoff dengan tambahan getter dan `PortFeePaid`. Event pembayaran hanya terbit setelah transfer berhasil. Fee nol menonaktifkan pembayaran/event. Payout failure membatalkan nonce, approval count, activation, provenance, dan saldo secara atomik; reentrancy guard diuji. Nilai fee/penerima live perlu dicatat dari getter; tidak diubah oleh pekerjaan ini.

### D-09 — DSL dan cache

Status: **diterapkan dan diuji lokal**, integrasi hosted M5 masih gate. RFC 8785 + UTF-8 + keccak256 untuk mapping/schema/attrs; hash CID bukan contentHash. Limit awal dan ranking tier berada di [mapping spec](mapping-dsl.md). Runtime melakukan validasi setiap output. Gallery cache harus dipersiapkan untuk pasangan Gallery sendiri. Request baru boleh memakai proposal confirmed yang belum active; proposal dengan receipt unknown tidak dianggap sukses. SDK melabeli cached hanya untuk pointer active yang usable.

### D-10 — Wiring dan emergency pause

Status: **diterapkan dan diuji lokal**, gate M2/M3. PasskeyApprover dan MappingRegistry menerima binder immutable pada constructor; `bindLedger` hanya sekali oleh binder, dengan target ber-code. PortLedger memakai Ownable untuk `setPaused`, hanya menghentikan port baru. Read provenance, recordUse, dan recovery key tetap tersedia. Admin pause tidak dapat mengganti pemilik aset, key, atau history melalui kewenangan pause. Alamat binder, ledger, pause owner, dan feeRecipient harus dicatat serta diverifikasi saat deployment. Tidak ada upgradeable Rupa proxy dalam scope MVP.

### D-11 — Agen dan reputasi

Status: **baseline produk, belum diimplementasikan untuk reputasi**, gate M4/M8. Setup satu agent tersedia; ID live belum didaftarkan, agent kedua ditunda. Admin app pemberi feedback berbeda dari agent owner/operator. Ranking demo menggunakan evaluator app yang dikenal dan ditampilkan; registrasi permissionless sendiri tidak memberikan sybil resistance. No-feedback dipresentasikan sebagai belum dinilai, bukan skor nol kualitas.

### D-12 — Mode approval fallback

Status: **diizinkan handoff jika spike >3 jam terhambat**, gate M1. Target tetap WebAuthn. Fallback memakai key P256 non-extractable WebCrypto dan verifikasi onchain. Mode harus diberi label `raw-p256`, dengan keterbatasan recovery dan origin storage dijelaskan; tidak menerima signature raw pada jalur WebAuthn secara diam-diam.

### D-13 — Review mapping sebelum approval

Status: **diterapkan dan diuji**, gate browser M6 masih terbuka. port(assetId, targetAppId, passkey, options) mendukung async onReview(preview): Promise<boolean> sebelum prompt. False membatalkan tanpa tx; onStep tetap progres. Unit tests mencakup cancel, perubahan schema saat review, nonce saat prompt dan tx timeout.

## Kebijakan kontribusi

### D-14 — Identitas kontributor manusia

Status: **ditetapkan pengguna, 11 Oktober 2026**. Kontribusi ke `github.com/aryaayy/rupa` terbuka bagi semua kontributor manusia yang melakukan push atau pull request sesuai hak akses repository. Setiap kontributor memakai identitas Git sendiri; author dan committer mengikuti peran manusia sebenarnya. Arya Aydin Margono (`aryaayy`) tidak menjadi identitas wajib untuk semua commit.

Agent AI seperti Codex, Cursor, Claude, dan sejenisnya tidak dicantumkan sebagai contributor, author, committer, atau co-author. Trailer `Co-authored-by` hanya diperbolehkan bagi kontributor manusia yang benar-benar ikut berkontribusi. Alat bantu tidak mengambil atribusi kontribusi manusia.

Keputusan ini menggantikan kewajiban identitas tunggal dan larangan menyeluruh co-author dalam handoff §13 sebelumnya. Handoff §13, CONTRIBUTING, AGENTS, README, backlog, dan checklist submission diselaraskan. Ini perubahan kebijakan dokumentasi; tidak mengubah permission repository atau history Git.

Untuk task development saat ini pengguna menetapkan author dan committer Arya Aydin Margono <134766828+aryaayy@users.noreply.github.com>, tanpa trailer co-author, focused Conventional Commits dan tanpa push. Ini instruksi task, bukan pembatasan contributor manusia lain. Metadata Git read-only menghalangi branch/commit lokal dalam sandbox.

### D-15 — Demo lokal dan batas service

Status: **diterapkan, 11 Oktober 2026**. Default demo memakai disposable Anvil 31337, identity fixture, mock rule generator dan inline canonical JSON agar tidak membutuhkan provider/pinning key. P256 tetap diverifikasi secara matematis. Adapter live memakai Chat Completions JSON mode dan Pinata file pinning; pilihan provider/model/host belum dibuat. SDK/agent berbagi Ajv 2020-12 dengan profil bounded yang menolak semua refs/regex/formats dan JCS yang menolak integer tidak aman.

Arena memakai server-confirmed duel dan burner per-tab; mint pertama tidak mengemit WIN, kemenangan berikutnya mencatat Used(WIN). Faucet server dibatasi per wallet/IP/global dan authenticated session. Batas/cache/pending tracking berada di memori satu proses; multi-instance/dana lebih besar membutuhkan persistence. Setup app/identity menyimpan checkpoint publik untuk resume transaksi unknown. Reputation, waitlist dan generic SDK admin facade tidak termasuk release ini.

## Keputusan pengguna yang masih terbuka

Arahan awal deployment nanti telah dilengkapi pengguna dengan alamat kontrak yang sudah live dan domain final. Pekerjaan ini mempertahankan deployment tersebut; belum melakukan registrasi live atau hosting. Pengguna mengonfirmasi app IDs dan agent ID/service URL belum dibuat.

| ID | Dibutuhkan | Menghambat | Status |
| --- | --- | --- | --- |
| Q-01 | Domain dan RP ID | Browser approval | RESOLVED: rupa-mu.vercel.app, origin https://rupa-mu.vercel.app |
| Q-02 | Provider/model LLM dan anggaran request | Integrasi live agent M5 | TBD pengguna |
| Q-03 | Layanan pinning IPFS | Publikasi schema/mapping live M5 | TBD pengguna |
| Q-04 | Hosting agent: layanan Node/container atau serverless yang kompatibel | Deploy agent M7/M10 | TBD pengguna |
| Q-05 | Jam dan zona waktu deadline resmi | Batas freeze/submission | TBD — verifikasi penyelenggara |

API key/private key diberikan melalui secret environment platform, bukan dokumen atau chat. Provider/model/hosting belum dipilih; domain dan kontrak existing sudah eksplisit ditetapkan pengguna.

## Format penambahan keputusan

Catat ID, tanggal, status, konteks, pilihan, konsekuensi, dokumen terdampak, serta test/evidence. Keputusan yang menyimpang dari handoff harus menyebut bagian handoff dan alasan perubahan secara eksplisit.
