# Pedoman development Rupa

## Konteks dan prioritas

Baca `RUPA-HANDOFF.md`, `docs/handoff-review.md`, `docs/prd.md`, dan `docs/decisions.md` sebelum implementasi. Handoff adalah baseline; perubahan atau penjelasannya harus tercatat di decision log. Instruksi eksplisit pemilik proyek mengungguli pedoman ini.

- Nama Rupa; tagline `One asset. Every form.`; paket `@rupa/sdk`; pnpm monorepo.
- Produk utama adalah primitive/infrastruktur interoperabilitas. Tiga aplikasi adalah consumer demo.
- Port tidak memindahkan kepemilikan, melakukan bridge, atau burn/mint ulang.
- LLM hanya menghasilkan mapping DSL. Semua output harus divalidasi dan dieksekusi deterministik.
- Pertahankan verifikasi persetujuan P256 onchain dan validasi mapping. Ikuti fallback serta cut list yang tercatat, jangan menurunkan keamanan diam-diam.
- Demo menggunakan satu origin; domain dan RP ID harus final sebelum deployment PasskeyApprover.

## Urutan kerja

Ikuti M0–M10 di `docs/implementation-plan.md`. Mulai dari verifikasi dependency dan passkey, lalu kontrak, agent, SDK, aplikasi. Jangan menandai milestone selesai tanpa evidence di `docs/verification-notes.md` atau artefak pengujian yang relevan.

Saat ini workspace baru memiliki dokumentasi. Periksa keberadaan manifest/script sebelum menjalankan perintah yang masih berstatus rencana. Jangan membuat hasil test, alamat kontrak, agent ID, atau live link fiktif.

## Implementasi

- Shared interpreter/validator berada di `packages/mapping-dsl`; agent dan SDK menggunakan implementasi yang sama.
- Pin versi dependency dan ABI upstream; ABI deployment harus diverifikasi sebelum menulis adapter produksi.
- Gunakan format hashing/encoding yang sama pada Solidity dan TypeScript, dengan fixture lintas implementasi.
- Fail closed pada assertion, schema, hash, nonce, owner, dan mapping yang invalid. Jangan menyamarkan kegagalan RPC sebagai sukses atau aset tidak didukung.
- Server env menyimpan signer agent, deployer, faucet, dan kredensial provider. Tidak ada secret di bundle frontend, fixture, log, atau commit.
- Jangan mengubah file handoff asli untuk menghapus ketidakpastian; catat keputusan dan bukti secara eksplisit.

## Pemeriksaan dan dokumentasi

Jalankan pemeriksaan yang relevan untuk perubahan: Foundry untuk kontrak, Vitest untuk SDK/DSL/agent, build/typecheck untuk TypeScript, dan scan secret sebelum commit. Test fork harus jelas berstatus berhasil, gagal, atau tidak dijalankan; mock bukan bukti precompile Monad hidup.

Perubahan API, event, hashing, cache, atau trust boundary harus memperbarui spesifikasi dan test terkait. Perubahan dokumentasi cukup diperiksa tautan lokal, konsistensi, dan kelengkapan; tidak perlu membuat unit test untuk prose.

## Git dan publikasi

- Repository tujuan `aryaayy/rupa`. Jangan membuat remote repository yang belum ada tanpa instruksi pemilik proyek.
- Semua kontributor manusia dapat berkontribusi sesuai hak akses repository; tidak terbatas pada Arya Aydin Margono (`aryaayy`). Gunakan identitas author dan committer manusia yang sesuai peran masing-masing; pertahankan author asli.
- Agent AI seperti Codex, Cursor, Claude, dan sejenisnya tidak boleh dicantumkan sebagai contributor, author, committer, atau co-author. Saat membantu membuat commit, gunakan identitas manusia yang sudah dikonfigurasi atau ditetapkan pengguna; jangan menebak identitas atau mengganti semua kontribusi menjadi milik Arya.
- Conventional Commits; branch `feat/...`, `fix/...`, `docs/...`, atau `chore/...`.
- Jangan gunakan prefix branch `cursor/` atau `codex/`, atau atribusi agent AI sebagai contributor di file, PR, dan commit. Trailer `Co-authored-by` hanya untuk kontributor manusia yang benar-benar ikut berkontribusi.
- Jangan menganggap permintaan dokumentasi sebagai instruksi deploy, publish npm, mengirim pesan, atau membuat remote repository.
- Jika metadata Git tidak dapat ditulis, laporkan kondisinya; jangan mengubah permission atau membuat repository tersembunyi pengganti.
