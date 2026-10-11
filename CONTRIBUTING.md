# Kontribusi

Status awal: dokumentasi disiapkan pada 11 Oktober 2026; source code dan CI belum tersedia. Mulai dari [development](docs/development.md) dan [backlog](docs/backlog.md).

## Siapa yang dapat berkontribusi

Kontribusi ke repository `github.com/aryaayy/rupa` terbuka bagi semua kontributor manusia yang mengirim perubahan melalui push atau pull request sesuai hak akses repository. Kontributor tidak terbatas pada Arya Aydin Margono (`aryaayy`). Setiap orang menggunakan identitas Git miliknya sendiri dan mendapatkan atribusi atas kontribusinya.

Agent AI seperti Codex, Cursor, Claude, dan alat sejenis tidak dicantumkan sebagai contributor, author, committer, atau co-author. Alat tersebut dapat membantu pekerjaan; atribusi kontribusi tetap kepada manusia yang bertanggung jawab atas perubahan.

## Alur perubahan

1. Pilih task dengan dependency terpenuhi; catat task ID pada PR.
2. Gunakan branch `feat/...`, `fix/...`, `docs/...`, atau `chore/...`.
3. Buat perubahan kecil yang memenuhi acceptance criteria; perbarui dokumen terkait bila perilaku berubah.
4. Jalankan pemeriksaan sesuai [test plan](docs/test-plan.md); jelaskan pemeriksaan yang tidak dapat dijalankan.
5. Pastikan diff bebas secret dan tidak memasukkan `.env`, private key, atau browser credential storage.
6. Tulis PR yang menjelaskan masalah, perilaku akhir, bukti pengujian, serta keterbatasan yang tersisa.

## Identitas Git kontributor

Gunakan nama dan email Git milik kontributor yang sebenarnya, termasuk email noreply GitHub bila dipilih. Jangan mengganti identitas kontributor lain menjadi identitas Arya. Jika konfigurasi sudah benar, pertahankan. Contoh berikut memakai placeholder yang harus diganti dengan identitas sendiri; jalankan hanya setelah repository tersedia dan metadata Git dapat ditulis:

```bash
git config --local user.name "Nama Kontributor"
git config --local user.email "email-git-kontributor"
git log --format='%an <%ae> | %cn <%ce>'
```

Author dan committer mencerminkan manusia yang menjalankan peran masing-masing; keduanya dapat berbeda saat seseorang menerapkan atau menggabungkan kontribusi orang lain. Pertahankan author asli. `Co-authored-by` boleh digunakan untuk kontributor manusia yang benar-benar ikut berkontribusi, tetapi tidak untuk agent AI. Jangan menambahkan atribusi agent AI sebagai contributor di commit, PR, atau file proyek.

Gunakan Conventional Commits, misalnya `docs: define Rupa development specifications` atau `feat(contracts): add passkey approval verification`. Kebijakan ini mengikuti klarifikasi pengguna yang dicatat sebagai D-14 pada [decision log](docs/decisions.md).

Repository tujuan adalah `aryaayy/rupa`; pembuatan remote baru memerlukan instruksi pemilik proyek. Persyaratan repo publik untuk submission tidak berarti remote telah tersedia.

## Definition of ready

- Requirement dan acceptance criteria jelas.
- Dependency API, keputusan, dan fixture yang dibutuhkan tersedia atau dinyatakan sebagai spike.
- Task tidak bergantung pada alamat deployment atau provider yang dikarang.

## Definition of done untuk task

- Acceptance criteria terpenuhi dengan bukti yang dapat ditinjau.
- Pemeriksaan yang relevan lulus, atau keterbatasan ditulis secara eksplisit tanpa mengklaim selesai.
- Dokumen publik, ABI/types, dan error behavior sesuai implementasi.
- Tidak ada secret; status backlog diperbarui; keputusan baru dicatat di [decision log](docs/decisions.md).

## Format dokumentasi

Dokumen internal menggunakan Bahasa Indonesia dengan nama API dalam bahasa aslinya. Saat menyiapkan submission, materi publik dapat diterjemahkan ke bahasa Inggris. Gunakan tautan relatif untuk file repository dan status `TBD`, `PLANNED`, `PASS`, `FAIL`, atau `NOT RUN` secara konsisten. Jangan mengganti placeholder dengan data contoh yang tampak seperti hasil deployment nyata.
