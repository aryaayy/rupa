# Spesifikasi UX

Status: rancangan pengalaman MVP; tidak ada UI yang telah dibangun. Prioritasnya menunjukkan primitive Rupa bekerja melalui tiga consumer yang mudah dipahami.

## Route dan isi

| Route | Konten utama | Aksi |
| --- | --- | --- |
| `/` | Tagline, manfaat untuk developer, status network, alur singkat, dev waitlist | Buka Arena, buka docs, daftar opt-in |
| `/arena` | Wallet, aset milik user, duel tombol, wins | Connect, mint setelah menang, register passkey, record WIN |
| `/social` | Profil, portable assets, frame aktif, title dinamis | Preview mapping, Bring here, lihat provenance |
| `/gallery` | Card koleksi, provenance timeline, mapping/agent | Bring here, lihat cache evidence, buka explorer |
| `/docs` | Quickstart, concepts, kontrak, security, judge guide | Copy snippet, navigasi docs |

App ID diperoleh dari deployment manifest; jangan mengunci asumsi bahwa Social selalu app 2 dalam production code. Contoh handoff tetap ilustratif.

## State pengguna

| State | Tampilan dan aksi |
| --- | --- |
| Wallet belum terhubung | CTA connect; baca penjelasan/demo publik tetap tersedia |
| Network salah | Instruksi pindah ke Monad testnet; tombol transaksi disabled |
| Wallet tidak punya MON | Link faucet atau demo faucet jika benar-benar tersedia |
| Belum ada asset | CTA ke Arena; tidak menampilkan aset sample sebagai milik wallet |
| Belum ada passkey | Register dengan penjelasan bahwa wallet mengikat key |
| Portable | Preview jika mapping ada; Bring here meminta mapping bila perlu |
| Active current | View aplikasi + label mapping/schema/agent yang dapat diperiksa |
| Approval pemilik sebelumnya | Label jelas dan aksi re-port bagi current owner |
| Schema stale / mapping revoked | Alasan spesifik; refresh/pilih mapping baru; view stale tidak dilabel valid |
| Unsupported | Jelaskan jenis aset belum didukung; jangan menyamakan dengan RPC timeout |

## State port

`idle → mapping:requesting atau mapping:cached → preview → passkey:prompt → tx:sent → tx:confirmed → active`.

Step preview adalah tampilan UI sebelum persetujuan, bukan nama event wajib SDK tambahan. Saat mapping baru selesai, tampilkan aset, target app, agent, mapping/version, perubahan bentuk, dan fee bila aktif. Pengguna harus dapat membatalkan sebelum assertion dibuat. Callback `tx:confirmed` hanya sesudah receipt sukses dan event sesuai.

| Kegagalan | Pesan yang dibutuhkan | Recovery |
| --- | --- | --- |
| User cancel passkey | Persetujuan dibatalkan; belum ada transaksi | Coba lagi tanpa auto-prompt |
| LLM gagal validasi | Mapping belum memenuhi aturan aplikasi | Coba ulang terbatas/pilih agent lain bila ada |
| Schema berubah | Aplikasi memperbarui schema | Refresh mapping dan minta approval baru |
| Owner berubah | Wallet ini bukan pemilik saat ini | Muat ulang daftar aset |
| Deadline lewat | Persetujuan kedaluwarsa | Susun challenge baru, prompt baru |
| RPC timeout sesudah submit | Status transaksi belum diketahui | Simpan txHash; periksa receipt sebelum resubmit |
| IPFS tidak tersedia/hash beda | Data mapping tidak dapat diverifikasi | Retry gateway tepercaya; tidak render output tak tervalidasi |

## Presentasi data

Developer panel memperlihatkan snippet singkat, chain, contract/mapping ID, sumber agent, score beserta evaluator, serta indikator cached/live. Istilah keamanan hanya muncul bila membantu keputusan approval. Default UI menggunakan bahasa sederhana, sementara detail tersedia lewat expand/panel.

Timeline mengurutkan port dan menampilkan origin, target, approver, waktu, agent, mapping version, serta status verifikasi hash. Tanda verifikasi hanya muncul setelah SDK benar-benar menyelesaikan verifikasi. WIN adalah usage event terpisah. Royalty ditandai paid hanya dengan receipt/event pembayaran nyata.

## Aksesibilitas dan perangkat

- Alur lengkap dapat dioperasikan keyboard; focus kembali ke pemicu saat modal tutup.
- Status tidak hanya dibedakan warna; loading dan error mempunyai teks yang terbaca.
- Layout desktop/mobile menjaga CTA dan detail approval dapat dibaca tanpa scroll horizontal.
- Passkey dipicu tindakan user, tidak loop otomatis setelah cancel.
- Uji browser dan perangkat sesuai [test plan](test-plan.md); dukungan yang belum diuji diberi status jelas.

Waitlist meminta data minimum dengan persetujuan dan tujuan kontak. Data waitlist tidak masuk prompt LLM, chain, atau IPFS publik. Backend/form dan mekanisme penyimpanan diputuskan kemudian; sampai tersedia, jangan menampilkan pesan sukses pendaftaran.
