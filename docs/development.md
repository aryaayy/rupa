# Panduan development lokal

Status: prosedur target. Workspace saat ini berisi dokumen; manifest, dependency, command scripts, source code, serta CI **belum dibuat**. Jangan menjalankan contoh seolah bootstrap telah selesai.

## Prasyarat M0

- Node dan pnpm versi yang dipin setelah kompatibilitas dependency/hosting diperiksa. Handoff menyebut Node 20; jangan membiarkan versi runtime implisit.
- Foundry (`forge`, `cast`, `anvil`) dan compiler Solidity `^0.8.24` dengan versi compiler konkret yang dipin.
- Dependency TypeScript, viem, tsup, Fastify, ajv, OpenZeppelin dengan lockfile/revision yang dapat direproduksi.
- Browser WebAuthn dan perangkat authenticator untuk fixture; chain/RPC diperlukan untuk fork, bukan untuk pure DSL tests.

## Scaffold yang harus dibuat

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
.gitignore
.env.example
contracts/foundry.toml
contracts/src/, test/, script/
packages/mapping-dsl/src/, test/
packages/sdk/src/, test/
services/agent/src/, test/
apps/web/src/
.github/workflows/ci.yml
```

`contracts/test/vectors/` menampung assertion publik untuk test. Export ABI terotomasi dari hasil build kontrak; hindari copy manual berbeda versi. SDK dan agent bergantung pada package DSL workspace yang sama. Web app memakai SDK seperti consumer eksternal.

## Script contract yang dituju

Nama berikut harus didefinisikan pada M0 sebelum dipakai CI:

| Command dari root | Tujuan |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install dependency yang sudah dikunci setelah lockfile tersedia |
| `pnpm dev` | Menjalankan app/service lokal sesuai kebutuhan |
| `pnpm build` | Build workspace dalam urutan dependency |
| `pnpm lint` | Lint sumber TypeScript |
| `pnpm typecheck` | TypeScript checks seluruh package |
| `pnpm test` | Unit/integration non-network TypeScript |
| `pnpm test:contracts` | Wrapper Foundry unit/fuzz yang tidak membutuhkan RPC |
| `pnpm test:fork` | Suite fork eksplisit; memerlukan MONAD_RPC_URL |
| `pnpm check:secrets` | Gitleaks atau scanner yang dipin |

Perintah Foundry target dari direktori `contracts/`:

```bash
forge fmt --check
forge build
forge test
forge test --fork-url "$MONAD_RPC_URL"
```

Pisahkan file/suite fork agar `forge test` offline tidak gagal karena RPC belum disediakan. Dukungan precompile lokal dibuktikan saat M0; gunakan verifier pure-Solidity yang terverifikasi/di-etch untuk local crypto tests bila perlu. Mock `return 1` hanya untuk isolasi control flow.

## Environment lokal

Pada M0 buat `.env.example` dengan nilai kosong dan komentar per variabel. `.gitignore` mengabaikan `.env*` kecuali `.env.example`, output build, cache, private key, dan local credential storage. Jangan menulis kunci nyata pada contoh.

Pilih satu localhost origin dan port stabil untuk flow passkey; konfigurasi RP ID lokal terpisah dari target deployment. Tentukan mekanisme pemuatan env server/Foundry; frontend hanya mengambil public-prefixed config yang diperlukan. Detail environment ada di [deployment runbook](deployment.md), yang belum dijalankan.

Mode lokal memakai fixtures dan adapter stub yang diberi label jelas. Unit tests tidak membutuhkan API key provider. Manual provider smoke dan RPC/fork masuk suite eksplisit sehingga tidak menyebabkan pengeluaran/ketergantungan jaringan tersembunyi saat `pnpm test`.

## Git dan workflow

Pada pemeriksaan awal `git status` tidak mengenali repo yang dapat digunakan. Direktori metadata `.git` dibatasi. Dokumentasi dibuat tanpa menginisialisasi atau memodifikasi Git. Ketika workspace Git tersedia, ikuti [CONTRIBUTING](../CONTRIBUTING.md) untuk author/committer, branch, dan commit convention.

Sebelum sebuah fitur dianggap selesai: jalankan test relevan, scan secret, tinjau diff, perbarui dokumen API/behavior, dan catat evidence. Tidak perlu mengulang semua suite untuk perubahan prose saja; pemeriksaan tautan dan konsistensi memadai.

## Troubleshooting awal

| Gejala | Langkah |
| --- | --- |
| `pnpm` tidak menemukan workspace | Selesaikan M0 scaffold; README saat ini bukan klaim proyek runnable |
| `cast code 0x0100` kosong | Uji known-good P256 call, bukan code check precompile |
| Passkey tidak dapat digunakan | Periksa origin, RP ID, mode secure context, UV support, dan credential ID |
| Hash mapping berbeda | Bandingkan raw bytes, JCS, encoding UTF-8, dan keccak; jangan hash CID |
| Provenance gagal setelah event fetch | Periksa deployment block, log pagination/order, timestamp, block hash, dan ABI encoding |
| Agent mencoba request model berulang | Periksa dedupe key, proposal pending, schema version, dan retry cap |

Jangan mengubah security check untuk melewati masalah demo. Rekam input aman dan failure reason, lalu tambah test yang menangkap kegagalan sebenarnya.
