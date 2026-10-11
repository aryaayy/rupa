# Rupa

**One asset. Every form.**

Rupa membuat makna aset dapat digunakan lintas aplikasi: agent menyusun aturan mapping, pemilik menyetujui aktivasi dengan passkey, dan Monad menyimpan provenance. Kepemilikan aset tetap pada pemiliknya.

## Akses juri

**Status 11 Oktober 2026: inisialisasi dokumentasi. Produk, SDK, dan kontrak belum diimplementasikan atau dideploy.**

Sesuai arahan pengguna, deployment dikerjakan nanti; tahap ini menyiapkan dasar development lokal.

| Kebutuhan | Status |
| --- | --- |
| Live demo, satu origin untuk `/arena`, `/social`, `/gallery`, `/docs` | TBD — domain final diperlukan |
| Network tujuan | Monad testnet, chain ID `10143` menurut handoff; pemeriksaan RPC menunggu M0 |
| Kontrak Rupa dan agent ID | Belum tersedia; lihat [kontrak](docs/contracts.md) |
| Wallet juri | Wallet milik juri; passkey dibuat pada perangkat sendiri |
| Pendanaan testnet | [Faucet Monad](https://faucet.monad.xyz); demo faucet masih rencana |
| Instruksi demo dan troubleshooting | [Judge guide](docs/judge-guide.md) |
| Repository tujuan | `aryaayy/rupa`; keberadaan dan akses publik belum diverifikasi |

## Produk

Target pengguna awal adalah developer game web3 indie di Monad, aplikasi komunitas/badge, dan galeri NFT. Integrasi manual membutuhkan aturan untuk banyak pasangan aplikasi. Rupa menawarkan registry terbuka, mapping yang dapat dipakai ulang, dan SDK `@rupa/sdk` agar aplikasi dapat membaca serta mengaktifkan aset melalui API yang kecil.

Demo yang direncanakan: Fire Sword dari Arena menjadi frame profil di Social dan kartu koleksi di Gallery. LLM menghasilkan **aturan**, bukan hasil per aset. Aturan dieksekusi deterministik terhadap atribut dan riwayat aset.

## Mulai development

1. Baca [handoff asli](RUPA-HANDOFF.md) dan [hasil telaah](docs/handoff-review.md).
2. Gunakan [PRD](docs/prd.md), [arsitektur](docs/architecture.md), dan [keputusan](docs/decisions.md) sebagai dasar implementasi.
3. Kerjakan [backlog M0](docs/backlog.md), kemudian spike verifikasi passkey M1 sebelum memperluas UI.
4. Ikuti [panduan development](docs/development.md), [kontribusi](CONTRIBUTING.md), dan [rencana pengujian](docs/test-plan.md).

[Indeks dokumentasi](docs/README.md) memuat seluruh spesifikasi. Perintah build/test dan contoh SDK di dokumentasi adalah kontrak implementasi yang direncanakan; belum dapat dijalankan dari workspace ini.

## Kontribusi

Semua kontributor manusia dapat berkontribusi ke `github.com/aryaayy/rupa` melalui push atau pull request sesuai hak akses repository, memakai identitas Git masing-masing. Agent AI seperti Codex, Cursor, Claude, dan sejenisnya tidak dicantumkan sebagai contributor, author, committer, atau co-author. Lihat [panduan kontribusi](CONTRIBUTING.md).

## Struktur yang dituju

```text
contracts/            Solidity + Foundry: lima kontrak Rupa, tests, deploy script
packages/mapping-dsl/ Interpreter dan validator mapping bersama
packages/sdk/         @rupa/sdk
services/agent/       HTTP service, LLM, IPFS, signer terisolasi
apps/web/             Satu aplikasi web, empat route utama
deployments/          Manifest hasil deployment per chain
docs/                 Spesifikasi, runbook, bukti verifikasi
```

Direktori implementasi di atas belum dibuat. Stack dasar mengikuti handoff: pnpm monorepo, TypeScript, viem, Fastify, ajv, Solidity `^0.8.24`, dan OpenZeppelin. Versi dependency dipin pada M0 setelah pemeriksaan kompatibilitas.

## Batasan dan status

- Belum ada hasil test, alamat deployment, live URL, publikasi npm, atau integrasi pihak ketiga yang dapat diklaim.
- M0 harus membuktikan ABI registry dan perilaku precompile pada RPC; pembacaan dokumentasi resmi dicatat terpisah di [verification notes](docs/verification-notes.md).
- RP ID/domain, provider/model LLM, pinning IPFS, dan hosting agent menunggu keputusan pemilik proyek.
- Fallback raw P256 hanya boleh dipresentasikan sebagai raw P256, bukan WebAuthn passkey; lihat [security](docs/security.md).
- BTX hanya roadmap sesuai handoff. Wrapper NFT, agent kedua, dan royalty mengikuti urutan pengurangan scope.

Target lisensi adalah MIT sesuai handoff; file lisensi akan ditambahkan pada bootstrap M0. Target submission menurut handoff adalah **13 Oktober 2026**; jam dan zona waktu penutupan belum diketahui.
