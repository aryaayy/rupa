# Demo, pitch, dan submission

Status: core deployment dan Windows Hello dikonfirmasi pengguna. UI/agent baru sudah dibuat tetapi belum di-rollout; belum ada rekaman/submission dari pekerjaan ini. Deadline 13 Oktober 2026 berasal dari handoff; jam dan timezone resmi masih perlu dipastikan.

## Perilaku build saat ini

Demo lokal default memakai mock LLM dan inline canonical JSON. Social dan Gallery pada chain baru masing-masing meminta rule; Gallery tidak otomatis cache hit karena Social. Untuk rekaman live-AI/cached-Gallery di bawah, operator harus memilih provider dan mempersiapkan pasangan Gallery terlebih dahulu. Initial mint mencatat nol Used(WIN); victory berikutnya menambah WIN. Jangan mengklaim provider live saat mode mock.

## Prasyarat rekaman demo

Gunakan origin/domain final, wallet testnet khusus demo yang tidak dipublikasikan secret-nya, passkey perangkat sendiri, serta source asset yang jelas. Record block/tx/mapping IDs sebagai evidence. Operator telah menguji ulang script sebelum merekam.

Social harus menggunakan tuple type/app/version yang belum memiliki mapping active saat bagian live AI. Gunakan fixture atau app/schema baru yang didaftarkan secara sah; update schema juga akan menginvalidasi mapping lama dan harus dinyatakan. Jangan menghapus/rewrite sejarah chain untuk membuat cache tampak kosong.

Gallery memakai mapping untuk tuple Gallery yang sudah dibuat, divalidasi, dan diaktifkan pada rehearsal/seed sebelumnya. Proposal saja belum tentu active: lakukan approval sah pada aset sample jenis yang sama atau target admin setActive. Label developer panel dapat menyebut "Gallery mapping prepared earlier". Cache Social tidak dipakai sebagai bukti Gallery hit.

Jika contoh title menyebut 7 wins, persiapkan tujuh event WIN sah atau tampilkan angka aktual. Jangan hardcode jumlah kemenangan yang bertentangan dengan chain history.

## Demo teknis, maksimum 3 menit

| Waktu | Aksi produk live | Poin yang disampaikan |
| --- | --- | --- |
| 0:00–0:20 | Landing dan Arena | Aset dimiliki pengguna tetapi maknanya berbeda per aplikasi; Rupa menjadi primitive bersama |
| 0:20–0:50 | Menang, mint sword, register passkey | Aset canonical dan persetujuan milik owner |
| 0:50–1:40 | Social: mapping live, preview, passkey, tx confirmed | Agent menghasilkan rules; validasi deterministik; P256 diverifikasi onchain |
| 1:40–2:15 | Gallery: cached mapping, port, timeline | Bentuk lain dari aset sama, tanpa panggilan LLM baru untuk pasangan cached |
| 2:15–2:35 | WIN baru dan refresh title; payment bila aktif | History mengubah view; tunjukkan RoyaltyPaid hanya bila transfer terjadi |
| 2:35–2:55 | Developer panel dan quickstart | `getAssetsFor`, `port`, registry terbuka, agent/reputation bila tersedia |
| 2:55–3:00 | Produk dan tagline | One asset. Every form. Rupa. |

Target waktu bergantung latency nyata; ringkas penjelasan saat rehearsal. Jangan menyatakan transaksi berhasil sebelum receipt, menyebut raw-P256 sebagai passkey WebAuthn, atau mengganti live product dengan slides/code walkthrough. Bila provider lambat, perbaiki rehearsal/fixture flow; jangan menampilkan output rekaman sebagai live tanpa keterangan.

## Pitch, maksimum 2 menit

| Waktu | Materi |
| --- | --- |
| 0:00–0:20 | Tim: nama/peran aktual, lalu masalah integrasi makna aset lintas aplikasi |
| 0:20–0:50 | Solusi: schema aplikasi, AI rules, approval owner, provenance; ownership tetap |
| 0:50–1:15 | Pengguna awal: indie game dev, komunitas/badge, gallery Monad; manfaat dibanding adapter pasangan manual |
| 1:15–1:40 | Primitive/DX, model penggunaan agent, bukti integrasi/feedback yang benar-benar tersedia |
| 1:40–2:00 | Langkah berikutnya, ajakan mencoba SDK/waitlist, tagline |

Data traction yang belum ada harus menjadi target, bukan klaim. Jangan mengarang partner, jumlah integrator, audit, pengguna, biaya penghematan, atau revenue. Target satu tim eksternal menguji `getAssetsFor`; bukti dicatat bila benar-benar terjadi.

## Checklist deliverable

- [ ] Logo JPG/JPEG/PNG/WEBP ≤3 MB.
- [ ] Repository `aryaayy/rupa` publik dan akses juri diverifikasi.
- [ ] README menampilkan live URL/judge guide di bagian atas dan known limitations.
- [ ] Video teknis ≤3 menit menampilkan live working product.
- [ ] Pitch ≤2 menit dengan tim, masalah, solusi, dan alasan membangun.
- [ ] Live product link pada Monad testnet; instruksi/credential hanya bila benar-benar diperlukan.
- [ ] Alamat lima kontrak, agent IDs, approval mode dan test status nyata.
- [ ] Quickstart dan docs routes bekerja.
- [ ] Git author/committer sesuai identitas kontributor manusia masing-masing; co-author hanya manusia; tidak ada secrets atau atribusi contributor agent AI.
- [ ] Optional ad clip ≤30 detik hanya jika core deliverable selesai; tidak diprioritaskan.
- [ ] Deadline jam/timezone dan akses semua link diperiksa sebelum submission.

## Checklist rehearsal

Catat tanggal, revision, domain, browser/device, tx hashes, mapping IDs, translate count Social/Gallery, elapsed time, dan error. Simpan hanya bukti aman. Jangan mempublikasikan seed/private key, env, atau provider dashboard secret dalam video.
