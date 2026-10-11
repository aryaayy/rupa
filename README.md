# Rupa

**One asset. Every form.**

Rupa membuat makna aset dapat digunakan lintas aplikasi: agent menyusun aturan mapping, pemilik menyetujui aktivasi dengan passkey, dan Monad menyimpan provenance. Kepemilikan aset tetap pada pemiliknya.

## Akses juri

**Status 11 Oktober 2026: development lokal berjalan.** Lima kontrak inti, helper SDK passkey/provenance, dan halaman capture passkey tersedia. Produk lengkap dan deployment belum tersedia.

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
3. Lanjutkan [backlog M0–M2](docs/backlog.md): lockfile/CI, bukti browser/testnet, dan kelengkapan negative tests masih perlu ditutup.
4. Ikuti [panduan development](docs/development.md), [kontribusi](CONTRIBUTING.md), dan [rencana pengujian](docs/test-plan.md).

[Indeks dokumentasi](docs/README.md) memuat seluruh spesifikasi. Helper SDK yang tersedia mencakup approval hash, DER/COSE parsing, browser credential capture, dan verifikasi provenance. API `createRupa/getAssetsFor/port`, mapping DSL, agent service, serta consumer demo masih dalam backlog.

Dengan akses registry npm dan Foundry tersedia:

```bash
corepack enable
pnpm install
pnpm check
pnpm build
pnpm dev
```

`pnpm dev` membuka alat capture passkey pada `http://localhost:5173`; belum merupakan demo Arena/Social/Gallery. Instalasi pertama perlu menghasilkan dan meninjau `pnpm-lock.yaml`: pnpm/registry tidak dapat diakses dari sandbox saat bootstrap, sehingga lockfile belum dibuat. Pengujian lokal memakai dependency dari cache dengan versi yang dicatat di [verification notes](docs/verification-notes.md).

Hasil lokal: **42 test Foundry**, termasuk fuzz 256 kasus, **16 test SDK**, typecheck, build SDK, dan build web lulus. Testnet, perangkat browser, clean install pnpm, CI GitHub, dan gitleaks belum tervalidasi. Sandbox menolak DNS eksternal serta bind port server browser.

## Kontribusi

Semua kontributor manusia dapat berkontribusi ke `github.com/aryaayy/rupa` melalui push atau pull request sesuai hak akses repository, memakai identitas Git masing-masing. Agent AI seperti Codex, Cursor, Claude, dan sejenisnya tidak dicantumkan sebagai contributor, author, committer, atau co-author. Lihat [panduan kontribusi](CONTRIBUTING.md).

## Struktur saat ini

```text
contracts/            Lima kontrak Rupa, unit/integration tests, suite fork terpisah
packages/sdk/         Helper @rupa/sdk: approval, passkey, provenance
apps/web/             Vite: alat capture passkey lokal
scripts/              Vector generation, fork runner, direct RPC verification
docs/                 Spesifikasi, runbook, bukti verifikasi
```

Toolchain awal: Node 24.21.0, pnpm 10.20.0 (target instalasi), TypeScript 5.9.3, Solidity 0.8.24, Foundry 1.8.4, dan OpenZeppelin 5.6.1. Package DSL, service agent Fastify, consumer React, serta deployment script/manifest menyusul sesuai milestone.

## Batasan dan status

- Hasil test lokal tersedia; alamat deployment, live URL, publikasi npm, dan integrasi pihak ketiga belum tersedia.
- M0 harus membuktikan ABI registry dan perilaku precompile pada RPC; pembacaan dokumentasi resmi dicatat terpisah di [verification notes](docs/verification-notes.md).
- RP ID/domain, provider/model LLM, pinning IPFS, dan hosting agent menunggu keputusan pemilik proyek.
- Fallback raw P256 hanya boleh dipresentasikan sebagai raw P256, bukan WebAuthn passkey; lihat [security](docs/security.md).
- BTX hanya roadmap sesuai handoff. Wrapper NFT, agent kedua, dan royalty mengikuti urutan pengurangan scope.

Lisensi [MIT](LICENSE). Target submission menurut handoff adalah **13 Oktober 2026**; jam dan zona waktu penutupan belum diketahui.
