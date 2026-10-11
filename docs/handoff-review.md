# Telaah RUPA-HANDOFF

Tanggal: 11 Oktober 2026. Seluruh handoff §0–15 telah dibaca. Setelah telaah awal, §13 diperbarui sesuai klarifikasi pengguna bahwa semua kontributor manusia memakai identitas sendiri dan agent AI tidak mendapat atribusi contributor; lihat D-14 di [decision log](decisions.md). Rujukan `/workspace/monad-asset-port-plan.md` tidak tersedia dalam workspace yang diperiksa dan tidak digunakan sebagai sumber.

## Kesimpulan

Handoff cukup kuat untuk memulai spike dan bootstrap: produk, lima kontrak, API SDK, demo, risiko utama, urutan milestone, dan cut list sudah jelas. Handoff belum merupakan spesifikasi implementasi lengkap. Risiko terbesar adalah verifikasi WebAuthn, bukti kesesuaian ABI deployment ERC-8004, dan konsistensi data/hashing lintas Solidity–TypeScript.

Workspace hanya memiliki handoff sebelum inisialisasi ini. `git status` melaporkan bahwa direktori bukan repository Git yang dapat digunakan; `.git` terlihat sebagai direktori yang dibatasi. Tidak ada source code, deployment manifest, CI, atau hasil test yang dapat diaudit.

## Gap yang harus ditutup

| ID | Temuan | Dampak | Tindak lanjut / gate |
| --- | --- | --- | --- |
| G-01 | §6–7 menginginkan Gallery memakai cache sesudah Social, tetapi cache terikat target app | Port Social tidak membuat cache Gallery | Seed mapping Gallery yang benar-benar sudah diaktifkan sebelumnya; gunakan Social untuk demonstrasi AI live. [Demo](demo-script.md), M7 |
| G-02 | `royaltyBps` ada, tetapi contoh memakai fee tetap; jumlah, penerima sisa, refund belum ditetapkan | Perilaku pembayaran tidak dapat diuji dengan satu interpretasi | Pilih formula di D-08 sebelum M2 selesai; event pembayaran hanya sesudah transfer nyata |
| G-03 | `PortRecord` sudah memuat `prevRecord`, tetapi rumus meng-encode `headOf` lagi | SDK dan kontrak dapat menghasilkan hash berbeda | Bekukan encoding dan fixture lintas bahasa di D-06, M2 |
| G-04 | Event `Ported` tidak memuat `at`, padahal waktu ikut record | Rekonstruksi hash membutuhkan data tambahan | MVP membaca timestamp block event; penambahan event field hanya dengan keputusan ABI, M2/M6 |
| G-05 | `verifyApproval` menerima hash yang sudah jadi dan mengonsumsi nonce | Nonce saja tidak aman bila ledger tidak menghitung challenge dari state terkini | Ledger menyusun hash dari live owner dan nonce; verifikasi hanya dapat dipanggil ledger, M1 |
| G-06 | Substring `clientDataJSON` tidak menjelaskan origin, escaping, duplicate field, indeks byte | Parser yang longgar bisa menerima field yang salah | Definisikan parser/format yang didukung dan validasi origin sebagai usulan penguatan D-05; uji byte dan Unicode, M1 |
| G-07 | Pemindaian aset wallet dan indeks event belum dirinci | ERC-721 dasar tidak menyediakan enumerasi semua token wallet | MVP rekonstruksi event dari deployment block lalu cek live owner; pagination/caching, M6 |
| G-08 | `activeMapping` tidak memuat versi schema dan aktif baru sesudah approval | Pointer stale; request bersamaan bisa mengulang LLM | Periksa schema/revocation pada setiap konsumsi, dedupe proposal pending; pisahkan proposed dari active, M2/M5/M6 |
| G-09 | Title dinamis berdasarkan wins, sedangkan provenance hanya mencatat port | Pengguna bisa mengira provenance menyimpan setiap perubahan tampilan | Definisikan history dari `Used`, render ulang tanpa LLM; provenance port bukan snapshot view, M6 |
| G-10 | Tiga sample bukan bukti semua output mapping valid | Atribut baru dapat menghasilkan output tidak valid | Validasi output pada setiap eksekusi di agent/SDK, plus property testing, M5/M6 |
| G-11 | Invariant tier tidak mendefinisikan ranking seluruh enum | `tier <= rarity` belum dapat dihitung | Tabel ranking 0–4 dan batas DSL di [mapping spec](mapping-dsl.md), M5 |
| G-12 | `noteApproval` publik hanya untuk ledger, tetapi validasi DSL offchain | Registry permissionless tidak menjamin seluruh mapping telah divalidasi | SDK memverifikasi hash + DSL + schema; persetujuan pengguna bukan bukti keamanan semantik, M5/M6 |
| G-13 | "Registered app admins" dianggap anti-sybil, padahal registrasi permissionless | Penyerang dapat membuat banyak app/admin | Ini hanya filter reputasi; daftar evaluator tepercaya diperlukan untuk demo, [security](security.md), M8 |
| G-14 | Wrapped NFT memiliki live owner tetapi bentuk ERC-721 representasinya belum jelas | Dua sumber kepemilikan berpotensi bertentangan | Pertahankan sebagai fitur cuttable; desain transfer/metadata/royalty wrapper harus diputuskan sebelum diaktifkan |
| G-15 | `isActive` tetap true setelah transfer; semantik revoke/schema belum dijelaskan | UI bisa menyajikan mapping yang tidak lagi aman | Bedakan record aktivasi historis dan view yang saat ini usable, [SDK](sdk-and-api.md), M6 |
| G-16 | Circular reference ledger–approver; pause disebut tanpa cakupan | Salah wiring atau setter terbuka dapat mengubah otorisasi | One-time wiring terkunci dan test; tetapkan cakupan pause D-10 sebelum deploy |
| G-17 | Fallback raw P256 di M1 berbeda dari WebAuthn must-have | Demo berisiko melebihkan klaim | Catat keterbatasan perangkat/recovery dan nyatakan fallback dengan jelas; passkey penuh tetap target |
| G-18 | Tenggat hanya tanggal, build window perkiraan, Node/dependency belum dipin | Jadwal dan reproduksibilitas belum pasti | Verifikasi jam/timezone submission; M0 pilih versi yang tersedia dan kompatibel |

## Verifikasi yang sudah dan belum dilakukan

Pembacaan [dokumentasi precompile Monad](https://docs.monad.xyz/developer-essentials/precompiles) mendukung format input dan penanganan hasil yang disebut handoff. [Repository ERC-8004 resmi](https://github.com/erc-8004/erc-8004-contracts) memuat alamat Identity/Reputation testnet yang sama. Ini **bukti dokumentasi**, bukan pemeriksaan bytecode, ABI proxy yang terpasang, atau eksekusi precompile. Status rinci dan tautan sumber tersedia di [verification notes](verification-notes.md).

Tidak ada `cast call`, test fork, transaksi deployment, pemanggilan LLM, atau publikasi yang dijalankan dalam inisialisasi dokumentasi.

## Urutan tindak lanjut

1. M0 mem-pin toolchain, mengambil ABI, dan menguji RPC/precompile secara nyata.
2. M1 membuktikan challenge browser → onchain beserta negative cases; batasi spike sesuai handoff.
3. M2 mengunci encoding record, semantik activation, fee, dan wiring kontrak.
4. Implementasi DSL/SDK selalu memvalidasi data saat konsumsi, lalu bangun demo dengan fixture cache yang benar.

Keputusan domain dan provider dapat menyusul tanpa menghentikan dokumentasi atau pekerjaan lokal yang independen. Domain final wajib tersedia sebelum deployment PasskeyApprover.
