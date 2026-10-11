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
| V-02 | Local Git usable | FAIL | `git status --short`: fatal not a git repository; `.git` berupa direktori yang dibatasi. Tidak ada init/config/commit |
| V-03 | Alamat testnet Identity/Reputation di upstream | DOC-CHECKED | Repository resmi mencantumkan alamat sama dengan handoff; bytecode/ABI runtime belum diperiksa |
| V-04 | ABI yang benar-benar terpasang | NOT RUN | Ambil ABI pada upstream commit, cocokkan proxy/implementation explorer, catat hash/revision dan eth_call probe |
| V-05 | RPC chain ID dan bytecode registry | NOT RUN | Target chain 10143/alamat dari handoff; butuh executable cast/RPC checks |
| V-06 | ValidationRegistry candidate | NOT RUN | Candidate handoff belum diuji; guide resmi menyebut coming soon; opsional/cut pertama |
| V-07 | P256 precompile live valid/invalid vector | NOT RUN | Dokumentasi mendukung interface; belum ada call/assertion nyata |
| V-08 | Third-party WebAuthn libs + local precompile | NOT RUN | Belum memilih/pin library atau menguji Anvil/Foundry support |
| V-09 | Browser WebAuthn ≥1 platform, target 3 | NOT RUN | Fixture belum direkam |
| V-10 | Royalty/hash/origin decisions final | NOT RUN | D-05/D-06/D-08 perlu dikunci sebelum ABI/deploy |
| V-11 | Rupa deploy, agent register, hosting | DEFERRED | Arahan pengguna: deployment nanti saja |
| V-12 | CI/unit/fuzz/integration/E2E | NOT RUN | Belum ada implementasi/toolchain proyek |
| V-13 | Deadline resmi dan remote repo access | NOT RUN | Tanggal handoff 13 Oktober 2026; jam/timezone dan visibility repo belum dibuktikan |
| V-14 | Struktur paket dokumentasi | PASS | 23 file Markdown baru; tautan lokal, cakupan indeks, penutup code fence, dan newline diperiksa dengan skrip read-only Python; tidak ada error |

## Sumber primer yang dibaca

Semua sumber berikut diakses pada 11 Oktober 2026 melalui pembacaan web. Tidak ada ABI artifact atau source revision yang dipin pada tahap dokumentasi ini.

1. [Monad precompiles](https://docs.monad.xyz/developer-essentials/precompiles): mendokumentasikan P256 `0x0100`, 160-byte input, valid return 32-byte one dan invalid empty return. Ini bukan hasil test vector Rupa.
2. [ERC-8004 contracts repository](https://github.com/erc-8004/erc-8004-contracts): bagian Monad Testnet mencantumkan Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e` dan Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713`; direktori `abis/` tersedia. Daftar alamat tidak membuktikan kecocokan bytecode/ABI proxy saat ini.
3. [Monad ERC-8004 guide](https://docs.monad.xyz/guides/erc-8004): Validation Registry disebut coming soon. Jangan menjadikan candidate address dependency MVP sebelum diverifikasi.
4. [ERC-8004 specification](https://eips.ethereum.org/EIPS/eip-8004): dibaca untuk wallet agent/feedback. Agent wallet dapat direset saat transfer; self-feedback oleh owner/operator dibatasi. Signature final tetap diambil dari ABI deployment, bukan perkiraan berdasarkan teks spec.
5. [WebAuthn verification](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion): origin, challenge, dan RP hash merupakan pemeriksaan terpisah; menjadi dasar usulan D-05. Implementasi parser belum dipilih/ditest.
6. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): referensi canonicalization JSON untuk content hash; library dan fixture JCS belum diimplementasikan.

## Prosedur M0 yang belum dijalankan

Perintah read-only berikut dilakukan nanti saat toolchain dan akses jaringan tersedia; jangan mencatatnya sebagai PASS sebelum output nyata ada:

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
