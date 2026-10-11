# Runbook deployment

**Status: DITUNDA sesuai arahan pengguna pada 11 Oktober 2026.** Dokumen ini adalah persiapan tahap berikutnya. Tidak ada domain, hosting, akun provider, agent ID, atau kontrak Rupa yang telah dibuat/dipilih melalui pekerjaan ini.

## Prasyarat saat tahap deployment dibuka

1. M1/M2 dan security-critical tests lulus; ABI, hash encoding, fee, origin policy, dan wiring dibekukan.
2. Domain final satu origin dan RP ID ditetapkan. RP ID adalah hostname, tanpa scheme/port/path; allowed origin mencakup scheme dan port bila ada.
3. Provider/model LLM, pinning IPFS, hosting agent dipilih; credential dimasukkan melalui secret environment platform.
4. Deployer/agent/admin/faucet wallets dipisahkan dan didanai secukupnya untuk testnet. Faucet wallet hanya diperlukan bila fitur faucet dibangun.
5. Existing ERC-8004 dan precompile telah diuji pada RPC dengan evidence di [verification notes](verification-notes.md).

## Environment

`.env.example` dibuat saat M0 dengan **semua nilai kosong**. Nilai publik di bawah adalah petunjuk konfigurasi, bukan isi file secret. Tambahan variabel di luar handoff adalah usulan untuk memenuhi rancangan keamanan/UX, belum interface konfigurasi final.

| Variabel | Lokasi | Secret? | Kegunaan |
| --- | --- | --- | --- |
| `MONAD_RPC_URL` | Server/tools | Tidak, kecuali URL berisi provider token | RPC chain tujuan; URL dari handoff ada di verification notes |
| `MONAD_RPC_FALLBACK_URL` | Server/tools | Bergantung URL | Fallback berquota; jangan expose credential query param |
| `CHAIN_ID` | Server/tools | Tidak | Target `10143`; assert cocok RPC |
| `DEPLOYER_PRIVATE_KEY` | Local deploy secret | Ya | Deploy; tidak dimuat service/browser |
| `RP_ID` | Deploy/server | Tidak | Hostname final; sha256 ditanam pada approver |
| `ALLOWED_ORIGIN` | Deploy/server, D-05 | Tidak | Exact HTTPS origin untuk assertion policy |
| `AGENT_PRIVATE_KEY` | Agent server | Ya | EIP-712 dan submit proposal |
| `AGENT_ID` | Agent server | Tidak | ID nyata dari ERC-8004 registration |
| `LLM_API_KEY` | Agent server | Ya | Provider credential |
| `LLM_MODEL` | Agent server | Tidak | Model yang dipilih dan diuji |
| `PINATA_JWT` | Agent server bila Pinata dipilih | Ya | Pinning; ganti nama adapter bila provider lain |
| `FAUCET_PRIVATE_KEY` | Faucet server opsional | Ya | Dana terbatas, rate-limited |
| `DEMO_ADMIN_PRIVATE_KEY` | Backend demo, usulan | Ya | Mint/use dengan auth dan batas; tidak ada pada client |
| `VITE_AGENT_URL` | Browser build | Tidak | URL layanan public |
| `VITE_RP_ID` | Browser build | Tidak | Harus cocok RP_ID deploy |
| `VITE_MONAD_RPC_URL` | Browser build, usulan | Tidak boleh memuat secret | Public transport SDK atau endpoint proxy aman |

Menggunakan `NEXT_PUBLIC_` hanya bila D-07 berubah ke Next. Jangan membuat server env public hanya demi kemudahan debug. Agent kedua membutuhkan identity/key/config terpisah, bukan menyalin satu ID menjadi dua label.

## Urutan pelaksanaan nanti

1. Jalankan test dan deployment rehearsal lokal; simulasikan constructor/one-time wiring dan final admin permissions.
2. Pilih domain final, validasi HTTPS/RP ID, dan sinkronkan allowed origin policy browser/kontrak.
3. Deploy lima kontrak menurut dependency final; lakukan finalisasi ledger bindings secara terlindungi, lalu pastikan tidak dapat diubah.
4. Catat transaction receipt, deployment block, chain, compiler settings, dan alamat. Verifikasi source di explorer.
5. Bentuk `deployments/10143.json`; export ABI dari build yang sama. Bandingkan SDK/frontend config dengan manifest.
6. Pin schema/attrs canonical; register Arena, Social, Gallery; simpan app IDs nyata. Set minter yang benar.
7. Daftarkan minimal satu agent dan card; record agent ID, registry, wallet, endpoint. Pastikan feedback admin bukan agent owner/operator.
8. Deploy agent dengan secret env, health check, limits, CORS, logging redaction, dan pinning adapter. Jalankan satu live translation smoke.
9. Deploy satu web app dengan route paths; verifikasi refresh direct URL SPA, HTTPS, config publik, dan docs.
10. Siapkan cache Gallery dan fixture Social sesuai [demo script](demo-script.md); jalankan E2E pada perangkat yang tersedia.
11. Perbarui README, judge guide, addresses/agent IDs, known limitations, dan status test memakai data nyata.

Tidak ada broadcast command siap pakai sebelum script, domain, chain guard, dan key handling tersedia. Jangan deploy hanya karena runbook ini ada.

## Bentuk manifest target

Manifest perlu memuat `chainId`, `network`, `rpc/explorer` publik, `revision`, `compiler`, `deployedAt`, per-contract `address/deploymentBlock/transactionHash/abiVersion`, `rpId`, `allowedOrigin` bila digunakan, `approvalMode`, `apps`, `agents`, serta konfigurasi fee/pause final. Desain schema final dilakukan di M3; dokumen ini tidak membuat alamat placeholder yang bisa salah dibaca tooling sebagai deployment valid.

## Smoke check sesudah deployment

- Chain ID cocok; kelima runtime code ada; semua contract reference menunjuk deployment yang sama.
- Ledger-only verification/noteApproval benar; binding tidak terbuka; admin/minter/pause owner sesuai.
- RP hash cocok final hostname; assertion nyata melalui browser origin final diterima.
- Proposal agent, port, receipt, provenance, cache, dan view history berfungsi.
- Revoke/schema update menolak port stale; failure tidak meninggalkan nonce/head parsial.
- IPFS content cocok hash; frontend bundle/log tidak mengandung secrets.
- Live routes dapat diakses tanpa akun internal; faucet/judge instructions dapat diikuti.

## Observability dan recovery

Log publik yang aman: request ID, chain, asset type hash, target/schema version, mapping ID, durasi langkah, cache hit, retry count, txHash, error code. Jangan log assertion lengkap user, wallet session token, provider key, atau prompt dengan data personal. Metrik error/latency/cache dipakai menguji target PRD.

Kegagalan hosting dapat ditangani rollback build dengan ABI/deployment yang sama. Contract redeploy memerlukan manifest baru dan mungkin registrasi passkey ulang; bukan rollback data chain. Domain berubah dapat memutus credential lama dan RP binding; jangan mengganti domain final tanpa rencana migrasi. Jika pembayaran gagal, periksa receipt sebelum retry dan jangan klaim RoyaltyPaid dari event dummy.

Saat secret bocor atau bug ditemukan, ikuti [security response](security.md). Pertahankan bukti tx dan data historis yang aman untuk diagnosis; jangan menghapus limitation dari README untuk membuat demo terlihat sehat.
