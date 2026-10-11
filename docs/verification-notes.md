# Verification notes

Tanggal pencatatan awal: **11 Oktober 2026**. Tujuan: memisahkan klaim handoff, konfirmasi dokumentasi, dan bukti runtime. Deployment ditunda sesuai arahan pengguna.

## Status evidence

- `DOC-CHECKED`: isi sumber primer dibaca; belum membuktikan endpoint/deployment aktual bekerja.
- `PASS`: pemeriksaan executable dijalankan dan hasil/evidence tersedia.
- `FAIL`: pemeriksaan dijalankan dan gagal, dengan error dicatat.
- `NOT RUN`: belum dijalankan.
- `DEFERRED`: sengaja ditunda sesuai tahap kerja.

## Pemeriksaan awal

| ID | Pemeriksaan | Status | Hasil / langkah berikutnya |
| --- | --- | --- | --- |
| V-01 | Handoff dan isi workspace | PASS | Handoff §0–15 dibaca; sebelum inisialisasi hanya RUPA-HANDOFF.md sebagai file proyek yang terlihat; tidak ada package/source/test |
| V-02 | Local Git usable | PASS | Setelah diinisialisasi pengguna, `main` melacak `origin/main`; HEAD `fccb687 docs: initialize project documentation`. Development lokal belum di-commit/push. Kegagalan awal sebelum init sudah teratasi |
| V-03 | Alamat testnet Identity/Reputation di upstream | DOC-CHECKED | Repository resmi mencantumkan alamat sama dengan handoff; bytecode/ABI runtime belum diperiksa |
| V-04 | ABI yang benar-benar terpasang | NOT RUN | Ambil ABI pada upstream commit, cocokkan proxy/implementation explorer, catat hash/revision dan eth_call probe |
| V-05 | RPC chain ID dan bytecode registry | FAIL | Terminal tidak dapat resolve RPC; `MONAD_RPC_URL=https://testnet-rpc.monad.xyz node scripts/verify-monad.mjs` berhenti `FAIL: fetch failed` sebelum memperoleh chain/block. Tidak ada konfirmasi runtime |
| V-06 | ValidationRegistry candidate | NOT RUN | Candidate handoff belum diuji; guide resmi menyebut coming soon; opsional/cut pertama |
| V-07 | P256 precompile live valid/invalid vector | NOT RUN | Script berisi known-good/invalid vector; network check V-05 gagal sebelum native precompile dipanggil |
| V-08 | Crypto P256 lokal | PASS | OpenZeppelin 5.6.1 `verifySolidity` di-etch di `0x0100`; Foundry menggunakan P256 signatures nyata. Ini tidak membuktikan native precompile atau kompatibilitas perangkat |
| V-09 | Browser WebAuthn ≥1 platform, target 3 | NOT RUN | Capture app build lulus; sandbox menolak bind server `EPERM 127.0.0.1:5173`. Belum ada fixture authenticator/browser |
| V-10 | Royalty/hash/origin implementation | PASS | D-05/D-06/D-08/D-10 diterapkan dan diuji lokal; compatibility browser, domain, fee/penerima deployment belum final |
| V-11 | Rupa deploy, agent register, hosting | DEFERRED | Arahan pengguna: deployment nanti saja |
| V-12 | Unit/fuzz/integration lokal | PASS | 42 tests Foundry + 16 tests SDK, typecheck, SDK/web build, formatting lulus. CI GitHub, fork, E2E perangkat, dan gitleaks belum dijalankan |
| V-13 | Deadline resmi dan remote repo access | NOT RUN | Tanggal handoff 13 Oktober 2026; jam/timezone dan visibility repo belum dibuktikan |
| V-14 | Struktur paket dokumentasi | PASS | Pemeriksaan terbaru mencakup 25 file Markdown: tautan lokal, code fences, dan newline lulus. `git diff --check`, env template kosong, serta ignore dependency/build output juga lulus; bukan pengganti secret scan |
| V-15 | pnpm bootstrap dan lockfile | FAIL | pnpm tidak tersedia; registry npm gagal DNS (`EAI_AGAIN`), offline install tidak memiliki metadata lengkap (`ENOTCACHED`). Tidak ada lockfile atau bukti clean install |

## Evidence development lokal

Tanggal: 11 Oktober 2026. Revision: working tree di atas `fccb687`; perubahan belum di-commit. Runtime Node **24.21.0**, Foundry **1.8.4** (`50af4efe189dc64bad2b75ed6990b835de66c4ae`), Solidity **0.8.24**, EVM Cancun. Versi dependency terpasang diperiksa dari package metadata: TypeScript 5.9.3, viem 2.57.4, OpenZeppelin Contracts 5.6.1, Vite 8.3.4, Vitest 5.0.3, @types/node 26.6.5.

Karena pnpm/registry tidak terjangkau, executable dan dependency TypeScript memakai symlink ke cache proyek lokal yang sudah ada; OpenZeppelin disalin ke `node_modules` lokal agar compiler dapat mengaksesnya. Seluruh dependency/build output di-ignore. Ini menyediakan evidence source dan dependency versi tersebut bekerja bersama, **bukan** bukti `pnpm install --frozen-lockfile` atau supply-chain verification. pnpm 10.20.0 baru target yang dipin pada manifest.

| Command yang benar-benar dijalankan | Hasil |
| --- | --- |
| `forge build --root contracts --offline` | PASS; compiler 0.8.24; lint advisory Foundry bukan audit keamanan |
| `npm run test:contracts` | PASS; 23 approver + 17 core integration + 2 encoding = 42 tests; fuzz wrong challenge 256 runs |
| `npm run typecheck` | PASS; strict TypeScript |
| `npm test` | PASS; 16 tests pada 3 file |
| `node node_modules/typescript/bin/tsc -p packages/sdk/tsconfig.build.json` | PASS; SDK JavaScript + declarations |
| `node node_modules/vite/bin/vite.js build apps/web` | PASS; 431 modules; capture app bundle 21.74 kB JS / 9.00 kB gzip |
| `npm run check:format` | PASS; `forge fmt --root contracts --check` |
| `node scripts/run-fork-tests.mjs` tanpa RPC env | Exit 1, `NOT RUN`; suite fork tidak dijalankan |
| `node scripts/verify-monad.mjs` tanpa RPC env | Exit 1, `NOT RUN`; tidak ada fallback mock |
| `MONAD_RPC_URL=https://testnet-rpc.monad.xyz node scripts/verify-monad.mjs` | FAIL sebelum chain/block; fetch tidak berhasil |

`pnpm check` dan workspace `pnpm build` belum dapat dijalankan; command komponennya di atas dijalankan langsung. Workflow CI dan hook pre-commit sudah tersedia, tetapi CI GitHub/gitleaks belum dijalankan dan hook belum dipasang ke config Git. Jangan menyamakan pemeriksaan env template kosong dengan secret scan lengkap.

Bukti kontrak mencakup approval binding/replay/deadline/origin/flags, actual local P256 math, malformed precompile return, rotation nonce, ownership tetap setelah port, mapping schema/revoke, provenance chain, royalti dan sisa fee, atomic rollback, serta reentrancy. Identity registry masih mock; ERC-1271 tersedia melalui SignatureChecker tetapi belum diuji dalam suite khusus. Encoding fixture `contracts/test/vectors/protocol.json` dibaca Solidity dan TypeScript. SDK tests mencakup DER signatures OpenSSL nyata, malformed DER/COSE/client JSON, BOM rejection, approval domain fields, dan provenance tampering.

Gate berikutnya: lockfile + clean install, upstream ABI/revision verification, direct Monad `eth_call`, capture perangkat, lalu integrasi SDK/DSL/agent. Fork Foundry hanya membuktikan akses chain state dan perilaku EVM lokal; native precompile memerlukan direct RPC checks. Tidak ada deployment/registrasi agent/transfer testnet dalam pekerjaan ini.

## Sumber primer yang dibaca

Sumber berikut dibaca pada 11 Oktober 2026 melalui web. ABI artifact dan source revision ERC-8004 belum dipin terhadap deployment runtime.

1. [Monad precompiles](https://docs.monad.xyz/developer-essentials/precompiles): mendokumentasikan P256 `0x0100`, 160-byte input, valid return 32-byte one dan invalid empty return. Ini bukan hasil test vector Rupa.
2. [ERC-8004 contracts repository](https://github.com/erc-8004/erc-8004-contracts): bagian Monad Testnet mencantumkan Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e` dan Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713`; direktori `abis/` tersedia. Daftar alamat tidak membuktikan kecocokan bytecode/ABI proxy saat ini.
3. [Monad ERC-8004 guide](https://docs.monad.xyz/guides/erc-8004): Validation Registry disebut coming soon. Jangan menjadikan candidate address dependency MVP sebelum diverifikasi.
4. [ERC-8004 specification](https://eips.ethereum.org/EIPS/eip-8004): dibaca untuk wallet agent/feedback. Agent wallet dapat direset saat transfer; self-feedback oleh owner/operator dibatasi. Signature final tetap diambil dari ABI deployment, bukan perkiraan berdasarkan teks spec.
5. [WebAuthn verification](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion): origin, challenge, dan RP hash merupakan pemeriksaan terpisah. D-05 menerapkan exact serialization terbatas; dukungan browser harus dibuktikan, bukan disimpulkan dari spesifikasi.
6. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): referensi canonicalization JSON untuk content hash; library dan fixture JCS belum diimplementasikan.

## Prosedur live M0 yang masih perlu berhasil

Perintah read-only berikut memerlukan akses jaringan yang berfungsi; jangan mencatatnya sebagai PASS sebelum output nyata ada:

```bash
RUPA_RPC_URL=https://testnet-rpc.monad.xyz
cast chain-id --rpc-url "$RUPA_RPC_URL"
cast code 0x8004A818BFB912233c491871b3d84c89A494BD9e --rpc-url "$RUPA_RPC_URL"
cast code 0x8004B663056A597Dffe9eCcC1965A193B7388713 --rpc-url "$RUPA_RPC_URL"
cast code 0x8004Cb1BF31DAf7788923b405b754f57acEB4272 --rpc-url "$RUPA_RPC_URL"
```

Expected chain ID menurut handoff adalah 10143; registry utama harus memiliki code. Validation candidate boleh dilewati bila kosong/tidak tersedia. Code kosong di `0x0100` bukan pemeriksaan dukungan precompile.

Untuk P256, siapkan input valid dengan known public key/signature, lalu invalid vector yang terkontrol; kirim `eth_call`/cast call ke `0x0100` dan simpan raw return, block, RPC, tool version. Setelah itu jalankan fixture WebAuthn melalui verifier penuh untuk membuktikan challenge/flags/nonce, bukan hanya kurva P256.

Untuk ABI, catat upstream repository commit, path/file checksum, deployment address, implementation bila proxy, selectors yang digunakan, serta hasil calls nyata. Periksa register overload, getAgentWallet behavior, feedback/getSummary, dan self-feedback restriction. Jangan menganggap daftar fungsi handoff otomatis cocok deployment.

## Format record evidence

```text
ID / requirement:
Tanggal dan pelaksana:
Revision proyek / upstream:
Environment, tool version, browser/device:
Chain, block number/hash, RPC publik tanpa token:
Command atau prosedur:
Expected:
Observed:
Status: PASS | FAIL | NOT RUN | DEFERRED
Artefak aman / txHash:
Keterbatasan dan tindak lanjut:
```

Evidence tidak menyimpan secrets, private key, credential storage, atau prompt dengan data personal. Status milestone diperbarui setelah evidence diperiksa; dokumentasi resmi dan mock tests tetap diberi label yang sesuai.
