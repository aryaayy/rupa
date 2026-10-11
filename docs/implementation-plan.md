# Rencana implementasi

Status: development lokal M0–M2 berjalan. Lima kontrak, helper SDK passkey/provenance, dan capture app tersedia dengan tests lokal; milestone belum diklaim selesai sebelum lockfile, verifikasi live, browser matrix, serta seluruh acceptance terpenuhi. Pengguna meminta **deployment nanti**, jadi gate deployment/hosting tetap ditunda.

## Milestone dan gate

| Milestone | Scope | Dependency | Exit criteria | Estimasi aktif awal |
| --- | --- | --- | --- | --- |
| M0 | Bootstrap, toolchain, CI, ABI/RPC verification | Dokumen baseline | pnpm workspace/Foundry, empty env template, CI nyata, verification notes berisi hasil atau blocker | 2 jam |
| M1 | WebAuthn/P256 end-to-end spike | M0 tooling/vector | ≥1 browser fixture, valid onchain verify, negative suite; fallback dicatat bila diperlukan | 3 jam timebox |
| M2 | Lima core contracts | M1 auth + keputusan hashing/fee/wiring | Unit/revert paths lulus; ABI dan encoding fixture dikunci | 7 jam |
| M3 | Deploy testnet | M2, domain/RP ID final, tahap deployment dibuka | Lima kontrak verified; manifest nyata dan wiring diperiksa | 2 jam |
| M4 | ERC-8004 agents | ABI M0, funded signer, provider/card config | ≥1 agent registered; target 2; card/ID benar | 2 jam |
| M5 | DSL dan agent | Kontrak/types; M3/M4 untuk mode live | Sepuluh pair tests, injection tests, validated pinned proposal end-to-end | 7 jam |
| M6 | SDK | M2 ABI, M5 DSL/API | API utama, browser approval, hash verification, cache/errors, Vitest lulus | 6 jam |
| M7 | Consumer demo | M6; M3–M5 untuk live | Tiga route satu origin, admin flow aman, Social live + Gallery cached | 6 jam |
| M8 | Reputation dan royalty | Core flow stabil | Feedback/ranking nyata; fee/event sesuai keputusan atau cut dinyatakan | 2 jam |
| M9 | Docs dan README sesuai produk | API dan UI aktual | Quickstart diuji, status aktual, judge guide, limitations | 2 jam |
| M10 | E2E, release, submission readiness | M3–M9 dan deployment dibuka | Device checklist, live stability, rekaman/submission assets siap | 5 jam |

Total estimasi 44 jam aktif + 4 jam buffer untuk window ~48 jam dari handoff. Ini estimasi satu alur kerja, bukan komitmen kalender; deadline resmi hanya diketahui tanggal 13 Oktober 2026 dan perlu konfirmasi jam/timezone. Waktu menunggu provider, device, domain, atau pendanaan tidak tercakup. Penyelesaian dokumentasi saat ini tidak berarti M9 tervalidasi terhadap produk.

## Critical path

`M0 → M1 → M2 → deployment gate M3 → integrasi live M4/M5 → M6 → M7 → M10`.

Bagian pure DSL, fixture, SDK mock clients, UX shell, dan dokumentasi dapat dikerjakan setelah interfaces stabil tanpa menunggu deployment. Nomor milestone dipertahankan agar cocok handoff; bedakan kelulusan local/component dari kelulusan live. Jangan mengklaim M5 selesai hanya dengan provider stub.

## Langkah terdekat untuk development lokal

1. Selesaikan M0-01 sampai M0-03: scaffold pnpm/Foundry, `.gitignore`, `.env.example`, lockfiles, baseline checks.
2. Bekukan public data/encoding fixture dan persiapkan browser capture M1.
3. Implementasikan spike passkey; pada jam ke-3 evaluasi blocker dan fallback D-12 secara jujur.
4. Lengkapi kontrak dan DSL dengan dependency eksternal di-stub untuk unit tests; sisakan evidence testnet sebagai gate nyata.
5. Bangun SDK dan consumer flow lokal menggunakan interface yang sama dengan mode testnet.

Tidak perlu memilih domain/hosting atau meminta secrets untuk menyelesaikan langkah dokumentasi dan pure/local code. Pembuatan remote repo, npm publishing, dan deployment bukan bagian tahap ini.

## Pengurangan scope

Urutan sesuai handoff: ValidationRegistry → React SDK components → external NFT wrapper → royalty → agent kedua → Phaser → auto-invalidate transfer. Button duel sudah cukup untuk Arena. Jangan membangun fitur cuttable lebih dahulu sehingga menggeser core proof.

Jika royalty dipotong, hilangkan claim paid; mode event-indikatif harus berbeda dari RoyaltyPaid dan dicatat D-08. Auto-invalidate transfer memang bukan baseline; activation historis tetap ada, dengan label previous owner di SDK.

Tidak dipotong: P256 approval onchain dan deterministic mapping validation. Raw-P256 fallback boleh setelah timebox handoff, dengan mode dan batasan terbuka; tidak menyatakan WebAuthn acceptance lulus.

## Freeze dan bukti selesai

Sisakan buffer akhir untuk perbaikan integrasi, domain/browser compatibility, akses juri, dan video. Saat freeze, tidak menambah fitur opsional. Milestone selesai hanya jika acceptance pada [backlog](backlog.md) dan [test plan](test-plan.md) mempunyai evidence; setiap cut dan outstanding risk dicatat di README.
