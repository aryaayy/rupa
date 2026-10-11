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

Status: **baseline handoff + usulan penguatan**, gate M1. Ledger menghitung hash dari current nonce/live owner; approver hanya menerima ledger. Pemeriksaan UP, UV, RP ID, deadline, low-s, dan hasil precompile wajib. Tambahkan verifikasi exact allowed origin serta penolakan embedded/cross-origin flow yang tidak didukung. Pemilihan parser dan perubahan struct assertion harus menghasilkan fixture browser dan negative tests sebelum ABI dibekukan. `typeIndex`/`challengeIndex` adalah offset byte UTF-8; substring tidak boleh menjadi pengganti parsing field top-level yang benar. Lihat [security](security.md).

### D-06 — Hash provenance

Status: **usulan**, gate M2. Pilih `recordId = keccak256(abi.encode(record))` dengan `prevRecord` sekali di dalam tuple; ini menyederhanakan rumus ambigu pada §4.5. SDK memperoleh `at` dari timestamp block event, sementara kontrak memakai `uint64(block.timestamp)`. Jika memilih formula literal handoff dengan head tambahan, ubah spesifikasi dan fixture sebelum ada deployment. `fromAppId` berarti target dari port sebelumnya, atau origin untuk port pertama; bukan lokasi custody.

### D-07 — Runtime, UI, dan indexing

Status: **baseline kerja**, gate M0/M6. Gunakan React + TypeScript + Vite untuk satu SPA agar hosting web terpisah dari agent Fastify. Handoff mengizinkan Vite/Next; keputusan ini dapat direvisi sebelum scaffold jika hosting mengharuskannya. Pin runtime Node dan package manager setelah cek dukungan dependency/hosting; Node 20 dalam handoff belum merupakan lock versi final. MVP menggunakan scan event dari deployment block, pagination, caching, lalu live ownership check. Indexer khusus ditunda.

### D-08 — Royalty

Status: **usulan**, gate M2 sebelum kode pembayaran. Default yang diusulkan: `portFee = 0.001 MON`, `royalty = floor(portFee * originApp.royaltyBps / 10_000)`, sisa menuju penerima fee immutable yang tercatat di deployment; `msg.value` harus sama dengan fee. Ini membutuhkan getter fee dan konfigurasi penerima yang belum ada dalam handoff. Alternatif fee penuh ke origin harus secara eksplisit menjelaskan bahwa `royaltyBps` tidak dipakai pada MVP. Pilih satu; jangan mencampur keduanya. Jika pembayaran dipotong dari scope, nonaktifkan fee dan jangan emit `RoyaltyPaid` yang menyatakan pembayaran fiktif. Tambahan event indikatif harus dinamai berbeda serta didokumentasikan sebagai perubahan terhadap cut list handoff.

### D-09 — DSL dan cache

Status: **baseline kerja**, gate M5. RFC 8785 + UTF-8 + keccak256 untuk mapping/schema/attrs; hash CID bukan contentHash. Limit awal dan ranking tier berada di [mapping spec](mapping-dsl.md). Runtime melakukan validasi setiap output. Gallery cache harus dipersiapkan untuk pasangan Gallery sendiri. Request baru boleh menggunakan proposal valid yang masih pending, tetapi tidak melabelinya `mapping:cached` aktif sebelum memenuhi policy yang ditentukan SDK.

### D-10 — Wiring dan emergency pause

Status: **usulan**, gate M2/M3. Gunakan wiring ledger satu kali yang hanya dapat dilakukan deployer/admin awal, lalu tidak dapat diganti. Pause, jika diimplementasikan, hanya menghentikan port baru; read provenance dan recovery key tetap tersedia. Admin pause tidak boleh mengganti pemilik, key, atau historical record. Catat pemegang kewenangan pause di deployment. Tidak ada upgradeable Rupa proxy dalam scope MVP.

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

Arahan pengguna pada 11 Oktober 2026: **deployment nanti saja**. Pekerjaan saat ini berfokus pada dokumentasi dan kesiapan development lokal. Pertanyaan infrastruktur ditunda; tidak menghambat penyelesaian paket dokumen ini. Tidak ada deployment atau pembuatan akun/remote dalam tahap ini.

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
