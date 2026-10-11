# Panduan development lokal

Status: scaffold, lima kontrak, helper SDK, dan alat capture passkey tersedia. DSL, agent service, serta demo Arena/Social/Gallery belum dibangun. Deployment tetap ditunda. Hasil pengujian dan batasan environment ada di [verification notes](verification-notes.md).

## Toolchain dan instalasi

- Node 24.21.0 (`.nvmrc`), pnpm 10.20.0 (`packageManager`).
- Foundry 1.8.4, compiler Solidity 0.8.24, EVM target Cancun.
- TypeScript 5.9.3, viem 2.57.4, OpenZeppelin Contracts 5.6.1, Vite 8.3.4, Vitest 5.0.3; versi dipin pada manifest.
- Browser secure context dengan WebAuthn ES256, user verification, dan `getAuthenticatorData()` untuk capture.

Dengan jaringan npm tersedia, jalankan dari root:

```bash
corepack enable
pnpm install
pnpm check
pnpm build
pnpm dev
```

`pnpm-lock.yaml` belum tersedia karena bootstrap di sandbox tidak dapat mengakses registry npm. Instalasi pertama harus menghasilkan lockfile, kemudian review dan commit lockfile tersebut. Setelah itu gunakan `pnpm install --frozen-lockfile`, termasuk pada clean checkout. Jangan menganggap install dari cache lokal membuktikan reproduksibilitas clean install.

Halaman lokal adalah **alat capture passkey**. Buka `http://localhost:5173` secara konsisten; server mendengarkan `127.0.0.1:5173` dengan port tetap. Membuat credential pada halaman ini belum mendaftarkan key onchain dan belum melakukan port. Gunakan credential uji dan review JSON publik sebelum menyimpannya di `contracts/test/vectors/`.

## Struktur implementasi

```text
contracts/src/          AppRegistry, RupaAsset, MappingRegistry, PasskeyApprover, PortLedger
contracts/test/         Unit, fuzz, integration, encoding vectors
contracts/test/fork/    Suite dependency fork yang memerlukan RPC
packages/sdk/src/       Approval hash, DER/COSE, browser capture, provenance
apps/web/src/           Antarmuka capture passkey
scripts/               Encoding fixture, fork runner, direct RPC checks
.github/workflows/     CI checks/build dan secret scan
```

Package DSL dan service agent akan ditambahkan pada M5. ABI lokal berasal dari `forge build --root contracts`; adapter SDK lengkap belum tersedia. Jangan menulis adapter produksi dari ABI upstream yang belum diverifikasi terhadap deployment.

## Command yang tersedia

| Command dari root | Tujuan |
| --- | --- |
| `pnpm dev` | Server alat capture passkey, port 5173 |
| `pnpm build` | Build package SDK dan web melalui workspace |
| `pnpm typecheck` | Strict TypeScript checks |
| `pnpm test` | Tests SDK non-network dengan Vitest |
| `pnpm test:contracts` | Foundry unit/fuzz/integration, mengecualikan suite fork |
| `pnpm check:format` | Foundry formatting check |
| `pnpm check` | Typecheck, SDK tests, contract tests, formatting |
| `pnpm test:fork` | Dependency fork; memerlukan `MONAD_RPC_URL` |
| `pnpm verify:monad` | Direct RPC chain/code dan native P256 valid/invalid vectors |
| `pnpm check:secrets` | Scan working tree; memerlukan executable gitleaks |

Belum ada script lint TypeScript. CI telah ditulis tetapi belum dijalankan di GitHub; sementara lockfile belum ada, workflow melakukan bootstrap install, lalu menegakkan frozen install ketika lockfile tersedia.

Unit crypto tests memakai verifier P256 OpenZeppelin yang di-etch di `0x0100`. Fork Foundry juga menjalankan EVM lokal; keberhasilan fork tidak membuktikan native precompile Monad. Gunakan direct `eth_call` untuk pemeriksaan native:

```bash
MONAD_RPC_URL=https://testnet-rpc.monad.xyz pnpm verify:monad
MONAD_RPC_URL=https://testnet-rpc.monad.xyz pnpm test:fork
```

Argumen path JSON pada `pnpm verify:monad <fixture>` menambahkan pemeriksaan signature dari capture publik. Itu masih bukan bukti lengkap registration/nonce/port pada testnet. Kedua script gagal eksplisit bila RPC belum dikonfigurasi; tidak ada hasil mock yang dilabeli PASS testnet.

## Environment dan Git

`.env.example` berisi nilai kosong. `.gitignore` mengabaikan env lokal, dependency, credential storage, output build, dan cache. Script RPC membaca environment proses; file `.env` tidak dimuat otomatis olehnya. Frontend tidak membutuhkan secret untuk capture. Konfigurasi live nanti mengikuti [deployment runbook](deployment.md).

Repository Git sekarang tersedia, `main` melacak `origin/main` pada `https://github.com/aryaayy/rupa.git`. Ikuti [CONTRIBUTING](../CONTRIBUTING.md) untuk identitas kontributor manusia dan Conventional Commits. Development ini belum di-commit/push.

Hook `.githooks/pre-commit` memindai staged changes dengan gitleaks dan menolak commit jika scanner tidak tersedia. Setelah menginstal gitleaks, aktifkan hook pada clone lokal:

```bash
git config core.hooksPath .githooks
pnpm check:secrets
```

Hook belum diaktifkan oleh proses bootstrap ini; gitleaks juga belum tersedia dalam sandbox. Sebelum commit: jalankan checks relevan, scan secret, review diff, dan perbarui evidence. Perubahan prose cukup diperiksa tautan dan konsistensinya.

## Troubleshooting

| Gejala | Langkah |
| --- | --- |
| pnpm tidak tersedia atau npm `EAI_AGAIN` | Gunakan environment yang dapat mengunduh package manager/dependency; lockfile tetap gate M0 |
| Server gagal bind dengan `EPERM` | Jalankan `pnpm dev` di terminal lokal yang mengizinkan port; sandbox saat bootstrap melarang bind |
| `cast code 0x0100` kosong | Uji known-good P256 melalui `eth_call`; code check bukan bukti precompile |
| Passkey ditolak | Periksa origin, RP ID, secure context, UV, credential ID, dan serialization yang didukung |
| `UNSUPPORTED_CLIENT_DATA` | Simpan capture publik untuk evaluasi kompatibilitas; jangan melewati pemeriksaan origin/challenge |
| Provenance gagal | Periksa kelengkapan/urutan records, timestamp block, asset ID, ABI encoding, dan head |

Jangan mengubah security check untuk melewati masalah demo. Rekam input aman dan failure reason, lalu tambah test yang menangkap kegagalan sebenarnya.
