# Panduan juri

**Status: demo belum dideploy; deployment ditunda.** Panduan ini disiapkan untuk diisi dan diuji pada M9/M10. Tidak ada akun bersama atau test credential yang dapat digunakan saat ini.

| Informasi | Nilai |
| --- | --- |
| Live URL | TBD setelah domain/hosting dipilih |
| Network tujuan | Monad testnet, chain ID 10143 menurut handoff |
| App routes | `/arena`, `/social`, `/gallery`, `/docs` pada origin yang sama |
| Contract addresses | [Daftar kontrak](contracts.md); Rupa belum deploy |
| Agent IDs | TBD, belum registered |
| Approval mode aktual | TBD; target WebAuthn, fallback hanya bila dinyatakan |
| Repository | `aryaayy/rupa`, akses publik belum diverifikasi |

## Sebelum mulai

Gunakan wallet testnet sendiri dan perangkat yang mendukung passkey. Siapkan MON testnet dari [faucet Monad](https://faucet.monad.xyz). Demo wallet button hanya dapat dipakai bila nantinya benar-benar tersedia; tidak ada shared private key dalam client.

Passkey dibuat di perangkat juri. Aplikasi meminta pendaftaran key melalui wallet sekali, kemudian port memakai passkey. Aplikasi tidak memperoleh biometrik. Perangkat/browser yang telah diuji dan limitation aktual harus ditulis sebelum panduan ini dipublikasikan sebagai instruksi live.

## Langkah evaluasi produk setelah live

1. Buka Arena, connect wallet, periksa network, lalu menangkan duel sederhana untuk memperoleh Fire Sword.
2. Register passkey pada perangkat sendiri. Konfirmasi transaksi pengikatan key bila diminta wallet.
3. Buka Social. Pilih Bring here pada aset portable; tinjau mapping, agent, tujuan, dan fee. Setujui dengan passkey dan tunggu konfirmasi port.
4. Periksa frame/profile title, transaksi port, serta mapping content. Tampilan harus berasal dari rules tervalidasi.
5. Buka Gallery dan port aset yang sama menggunakan mapping Gallery yang telah disiapkan. Developer panel/network evidence menunjukkan cache hit tanpa translate baru.
6. Periksa timeline provenance dan indikator verifikasi hash. Nama/approver/version harus sesuai record nyata.
7. Kembali ke Arena dan catat WIN lagi. Refresh Social; title berubah tanpa pemanggilan LLM baru.
8. Buka developer view dan `/docs` untuk API integrasi serta alamat kontrak.

Flow live-AI Social membutuhkan pasangan yang belum mempunyai active mapping pada demo rekaman. Pada kunjungan publik sesudah mapping tercache, Social juga boleh hit cache. Jangan mereset state diam-diam atau menjanjikan AI call baru untuk setiap juri. Mekanisme demonstrasi pasangan baru disiapkan operator sesuai [demo script](demo-script.md).

## Yang dapat diverifikasi

- Owner token tetap sama setelah port.
- Approval diperiksa onchain dan terikat transaksi/nonce.
- Mapping yang dipublikasikan cocok content hash registry.
- Cache terikat pasangan dan schema version, bukan sekadar berpindah halaman.
- Provenance chain sesuai `headOf`.
- Royalty hanya diklaim paid bila mode pembayaran aktif dan transfer terbukti.

## Troubleshooting

| Masalah | Langkah |
| --- | --- |
| Network wallet salah | Pindah ke jaringan yang ditampilkan aplikasi |
| Saldo gas tidak cukup | Gunakan faucet; tunggu receipt pendanaan sebelum retry |
| Passkey dibatalkan | Klik ulang aksi saat siap; tidak ada perubahan port |
| Passkey tidak ditemukan | Pastikan domain/perangkat sesuai; recovery melalui wallet owner bila perlu |
| Mapping sedang dibuat | Tunggu status; jangan melakukan klik berulang yang membuat request baru |
| Approval kedaluwarsa/schema berubah | Refresh preview dan buat approval baru |
| Transaksi belum pasti | Buka txHash di explorer; jangan mengasumsikan gagal lalu double-submit |
| Agent/IPFS/RPC gagal | Tampilkan dependency error; retry sesuai instruksi aplikasi |

## Diisi sebelum submission

- [ ] Live URL, alamat, agent/app IDs, approval mode, dan browser matrix nyata.
- [ ] Instruksi dapat dijalankan tanpa akun internal tim.
- [ ] Known limitations dan fitur yang dipotong sesuai produk.
- [ ] Repo publik dan akses `metropolis@hackathon.monad.xyz` diverifikasi.
- [ ] Demo video memperlihatkan produk bekerja, tidak diganti slides/code walkthrough.
