# Concepts

## Asset dan port

Asset adalah identitas canonical yang mempunyai owner, asset type, rarity, origin app, dan hash atribut. **Port** berarti mengaktifkan aset pada aplikasi tujuan dengan mapping tertentu. Port tidak memindahkan token atau mencabut aktivasi aplikasi sebelumnya.

`assetType` adalah pengenal jenis seperti `rupa.weapon.sword`, direpresentasikan di kontrak sebagai keccak256 UTF-8 pengenal tersebut. Nama aset individual berada di `attrs.name`.

## App, schema, dan mapping

App mendaftarkan schema output yang dipahami UI-nya. Versi schema bertambah saat schema diubah. Mapping adalah rules yang menerjemahkan data `base`, `attrs`, dan `history` menjadi bentuk output schema.

Mapping digunakan untuk tuple `(assetType, targetAppId, schemaVersion)`. Mapping Social tidak otomatis berlaku di Gallery. Isi mapping dipublikasikan di IPFS, diverifikasi menggunakan content hash, lalu dieksekusi deterministik oleh SDK.

Proposal adalah mapping yang telah dicatat registry. Active mapping adalah pilihan default untuk pasangan jenis aset dan app; registry dapat mengaktifkannya setelah approval pertama jika belum ada yang aktif. Active tidak berarti aturan telah dibuktikan aman onchain: SDK tetap memvalidasi DSL, schema, dan invariant.

## Agent dan persetujuan

Agent memiliki identitas ERC-8004 dan menandatangani proposal. Signature membuktikan signer yang terkait identitas, bukan kebenaran semantik hasil AI. Deterministic validation membatasi bentuk dan invariant output. Passkey owner memberikan otorisasi port tertentu, bukan izin umum mengendalikan aset.

Owner berbeda dari transaction sender: relayer dapat membayar gas dan mengirim calldata, tetapi persetujuan tetap harus berasal dari key milik owner saat transaksi dieksekusi.

## Provenance dan history

Provenance mencatat urutan port dalam hash chain per asset. `prevRecord` menghubungkan record baru dengan sebelumnya; `headOf` adalah hash record terakhir. SDK menyusun ulang chain untuk mendeteksi record hilang, berubah, atau salah urut.

History penggunaan, misalnya jumlah WIN, berasal dari event `Used` oleh admin aplikasi yang berwenang. History dapat berubah setelah sebuah port. View ikut berubah ketika mapping yang sama dieksekusi terhadap history terbaru; port lama tidak ditulis ulang.

Provenance membuktikan data yang direkam kontrak. Provenance tidak membuktikan duel benar-benar terjadi di luar chain, kualitas artistik mapping, atau ketersediaan IPFS selamanya.

## Pemilik baru dan mapping stale

Aktivasi historis tetap ada setelah token ditransfer. SDK menampilkan bahwa approval dibuat pemilik sebelumnya dan memungkinkan owner baru re-port. Mapping yang revoked atau schema-nya sudah berubah tidak boleh dipakai untuk membuat port baru atau dirender sebagai view current yang valid tanpa validasi ulang.

Implementasi operasional ada di [kontrak](contracts.md), [mapping DSL](mapping-dsl.md), dan [SDK/API](sdk-and-api.md).
