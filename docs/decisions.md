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

Status: **diterapkan lokal, kompatibilitas browser belum terbukti**, gate M1. Ledger menghitung hash dari current nonce/live owner; approver hanya menerima ledger. Pemeriksaan UP, UV, RP ID, deadline, range/low-s, dan hasil precompile tersedia. Penguatan terhadap handoff: exact allowed origin tanpa setter; whole-byte JSON comparison hanya menerima urutan `type/challenge/origin` dengan `crossOrigin:false` opsional. Nested/duplicate fields, field tambahan, whitespace, escaping, atau urutan lain ditolak; `typeIndex=1`, `challengeIndex=23`. Ini pembatasan kompatibilitas yang disengaja sampai fixture browser tersedia, bukan parser WebAuthn umum. Rotation menaikkan nonce bahkan saat key yang sama dipilih untuk membatalkan approval tertunda. Unit tests memakai crypto P256 nyata melalui verifier Solidity lokal; dukungan native Monad belum terbukti. Lihat [security](security.md).

### D-06 — Hash provenance

Status: **diterapkan dan diuji lintas Solidity/TypeScript**, gate M2. `recordId = keccak256(abi.encode(record))` dengan `prevRecord` sekali di dalam tuple memperjelas rumus ambigu pada handoff §4.5. Fixture publik berada di `contracts/test/vectors/protocol.json`. Kontrak memakai `uint64(block.timestamp)`; SDK event reader nantinya mengambil timestamp block, sementara helper saat ini menerima records lengkap. `fromAppId` berarti target port sebelumnya, atau origin untuk port pertama; bukan lokasi custody. Helper menolak record hilang, perubahan asset/urutan/hash, timestamp mundur, dan head tidak cocok.

### D-07 — Runtime, UI, dan indexing

Status: **scaffold diterapkan sebagian**, gate M0/M6. Node 24.21.0 dan pnpm 10.20.0 dipin, menggantikan baseline Node 20 handoff untuk toolchain lokal ini; kompatibilitas hosting dan clean install belum dibuktikan. Solidity 0.8.24/Foundry 1.8.4, TypeScript 5.9.3, viem 2.57.4, dan OpenZeppelin 5.6.1 digunakan pada tests lokal. Web awal berupa alat capture TypeScript + Vite; React untuk consumer demo dan Fastify untuk agent menyusul. Event scan, pagination, cache, dan live owner check tetap target SDK; indexer khusus ditunda. Lockfile belum dihasilkan karena registry npm tidak terjangkau, sehingga reproducible install tetap gate M0.

### D-08 — Royalty

Status: **diterapkan dan diuji lokal**, gate M2/M3. Constructor menetapkan `PORT_FEE` dan `feeRecipient` immutable; tidak ada nilai fee deployment yang sudah dipilih. Fixture lokal memakai 0.001 MON. `msg.value` harus tepat fee; `royalty = floor(PORT_FEE * originApp.royaltyBps / 10_000)` dibayar ke payout origin, sisanya ke feeRecipient. Ini memperjelas ketidakselarasan fee tetap/bps pada handoff dengan tambahan getter dan `PortFeePaid`. Event pembayaran hanya terbit setelah transfer berhasil. Fee nol menonaktifkan pembayaran/event. Payout failure membatalkan nonce, approval count, activation, provenance, dan saldo secara atomik; reentrancy guard diuji. Nilai fee/penerima aktual dicatat saat deployment nanti.

### D-09 — DSL dan cache

Status: **baseline kerja**, gate M5. RFC 8785 + UTF-8 + keccak256 untuk mapping/schema/attrs; hash CID bukan contentHash. Limit awal dan ranking tier berada di [mapping spec](mapping-dsl.md). Runtime melakukan validasi setiap output. Gallery cache harus dipersiapkan untuk pasangan Gallery sendiri. Request baru boleh menggunakan proposal valid yang masih pending, tetapi tidak melabelinya `mapping:cached` aktif sebelum memenuhi policy yang ditentukan SDK.

### D-10 — Wiring dan emergency pause

Status: **diterapkan dan diuji lokal**, gate M2/M3. PasskeyApprover dan MappingRegistry menerima binder immutable pada constructor; `bindLedger` hanya sekali oleh binder, dengan target ber-code. PortLedger memakai Ownable untuk `setPaused`, hanya menghentikan port baru. Read provenance, recordUse, dan recovery key tetap tersedia. Admin pause tidak dapat mengganti pemilik aset, key, atau history melalui kewenangan pause. Alamat binder, ledger, pause owner, dan feeRecipient harus dicatat serta diverifikasi saat deployment. Tidak ada upgradeable Rupa proxy dalam scope MVP.

### D-11 — Agen dan reputasi

Status: **baseline kerja**, gate M4/M8. Satu agent wajib, dua target. Admin app pemberi feedback berbeda dari agent owner/operator. Ranking demo menggunakan evaluator app yang dikenal dan ditampilkan; registrasi permissionless sendiri tidak memberikan sybil resistance. No-feedback dipresentasikan sebagai belum dinilai, bukan skor nol kualitas.

### D-12 — Mode approval fallback

Status: **diizinkan handoff jika spike >3 jam terhambat**, gate M1. Target tetap WebAuthn. Fallback memakai key P256 non-extractable WebCrypto dan verifikasi onchain. Mode harus diberi label `raw-p256`, dengan keterbatasan recovery dan origin storage dijelaskan; tidak menerima signature raw pada jalur WebAuthn secara diam-diam.

### D-13 — Review mapping sebelum approval

Status: **usulan**, gate M6. Tambahkan hook async `onReview(preview): Promise<boolean>` atau tahap prepare/review ekuivalen agar consumer dapat meminta konfirmasi setelah mapping baru tersedia dan sebelum passkey prompt. `onStep` tetap callback progres. Bentuk final harus diuji untuk cancel dan perubahan nonce/schema; contoh quickstart diberi label usulan sampai API dikunci.

## Kebijakan kontribusi

### D-14 — Identitas kontributor manusia

Status: **ditetapkan pengguna, 11 Oktober 2026**. Kontribusi ke `github.com/aryaayy/rupa` terbuka bagi semua kontributor manusia yang melakukan push atau pull request sesuai hak akses repository. Setiap kontributor memakai identitas Git sendiri; author dan committer mengikuti peran manusia sebenarnya. Arya Aydin Margono (`aryaayy`) tidak menjadi identitas wajib untuk semua commit.

Agent AI seperti Codex, Cursor, Claude, dan sejenisnya tidak dicantumkan sebagai contributor, author, committer, atau co-author. Trailer `Co-authored-by` hanya diperbolehkan bagi kontributor manusia yang benar-benar ikut berkontribusi. Alat bantu tidak mengambil atribusi kontribusi manusia.

Keputusan ini menggantikan kewajiban identitas tunggal dan larangan menyeluruh co-author dalam handoff §13 sebelumnya. Handoff §13, CONTRIBUTING, AGENTS, README, backlog, dan checklist submission diselaraskan. Ini perubahan kebijakan dokumentasi; tidak mengubah permission repository atau history Git.

## Keputusan pengguna yang masih terbuka

Arahan pengguna pada 11 Oktober 2026: **deployment nanti saja**. Pekerjaan saat ini berfokus pada implementasi dan pengujian lokal. Pertanyaan infrastruktur ditunda; tidak menghambat implementasi yang memakai fixtures lokal. Tidak ada deployment atau pembuatan akun/remote dalam tahap ini.

| ID | Dibutuhkan | Menghambat | Status |
| --- | --- | --- | --- |
| Q-01 | Domain demo final dan RP ID | Konfigurasi produksi browser dan deploy approver M3 | TBD pengguna |
| Q-02 | Provider/model LLM dan anggaran request | Integrasi live agent M5 | TBD pengguna |
| Q-03 | Layanan pinning IPFS | Publikasi schema/mapping live M5 | TBD pengguna |
| Q-04 | Hosting agent: layanan Node/container atau serverless yang kompatibel | Deploy agent M7/M10 | TBD pengguna |
| Q-05 | Jam dan zona waktu deadline resmi | Batas freeze/submission | TBD — verifikasi penyelenggara |

API key/private key diberikan melalui secret environment platform, bukan dokumen atau chat. Tidak ada pilihan provider/domain yang dianggap disetujui karena belum ada jawaban.

## Format penambahan keputusan

Catat ID, tanggal, status, konteks, pilihan, konsekuensi, dokumen terdampak, serta test/evidence. Keputusan yang menyimpang dari handoff harus menyebut bagian handoff dan alasan perubahan secara eksplisit.
