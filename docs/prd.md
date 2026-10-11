# Product Requirements Document

Versi 0.1 · 11 Oktober 2026 · Status: baseline MVP; fondasi kontrak/helper SDK diimplementasikan dan diuji lokal, integrasi produk belum lengkap. Lihat [backlog](backlog.md).

Sumber: [handoff](../RUPA-HANDOFF.md). Ambiguitas: [telaah](handoff-review.md). Keputusan teknis tambahan: [decision log](decisions.md). Deployment ditunda sesuai arahan pengguna; requirement deployment di bawah adalah target tahap berikutnya.

## Masalah dan proposisi nilai

Kepemilikan NFT dapat dibaca banyak aplikasi, tetapi makna atributnya tidak otomatis dapat digunakan. Sebuah pedang game belum mempunyai bentuk yang dipahami aplikasi profil atau galeri. Developer harus membangun dan memelihara integrasi pasangan demi pasangan.

Rupa menyediakan primitive portabilitas makna: aplikasi mendeklarasikan schema, agent menghasilkan rules yang dapat dipakai ulang, pemilik menyetujui port, dan aplikasi membaca bentuk aset melalui SDK. AI dipanggil untuk pasangan jenis aset, aplikasi tujuan, dan versi schema baru; port berikutnya menggunakan mapping yang sama selama valid.

## Pengguna dan kebutuhan

| Persona | Kebutuhan | Hasil yang diharapkan |
| --- | --- | --- |
| Developer game indie Monad | Membawa utilitas aset ke aplikasi lain tanpa adapter manual berulang | Integrasi `getAssetsFor` dan `port` dengan schema aplikasi sendiri |
| Developer komunitas/badge | Menampilkan aset sebagai identitas atau status | Output tervalidasi tanpa mengerti internal game asal |
| Developer galeri NFT | Menampilkan koleksi beserta asal-usulnya | View sesuai schema dan provenance yang dapat diverifikasi |
| Pemilik aset | Mengaktifkan aset di aplikasi lain dengan persetujuan yang jelas | Passkey pada perangkat sendiri; kepemilikan tetap |
| Operator agent | Menawarkan mapping yang teridentifikasi dan dinilai | Identitas ERC-8004, signature, feedback publik |
| Juri hackathon | Memverifikasi implementasi nyata dengan cepat | Live flow, transaksi, mapping, cache, dan dokumentasi developer |

## Tujuan dan batas scope

MVP membuktikan lima kontrak Rupa, persetujuan P256 onchain, minimal satu agent ERC-8004, mapping deterministik, SDK, tiga demo consumer, dan provenance. Track positioning tetap infrastruktur yang dapat digunakan aplikasi lain.

Di luar MVP: bridge/cross-chain transfer, marketplace perdagangan, mainnet, general-purpose autonomous execution, training model, game kompleks, dukungan semua jenis NFT, bukti kriptografis kualitas semantik LLM, encrypted mempool BTX, dan jaminan anti-sybil menyeluruh.

## Requirement fungsional

| ID | Prioritas | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-01 | P0 | Registry app permissionless dengan schema versioned | Admin dapat register/update schema/set minter; non-admin ditolak; royalty bps maksimal 500 |
| FR-02 | P0 | Aset canonical ERC-721 | Minter origin yang sah dapat mint; owner terbaca; atribut memiliki hash; rarity 0–4; port tidak mengubah owner |
| FR-03 | P0 | Registrasi dan recovery passkey | EOA owner mengikat P256 key sekali; rotation hanya owner; signature lama tidak berlaku setelah key berubah |
| FR-04 | P0 | Persetujuan port onchain | Assertion terikat chain, ledger, owner, aset, tujuan, mapping, nonce, deadline; real precompile menerima valid dan menolak negative cases |
| FR-05 | P0 | Mapping rules oleh agent teridentifikasi | Minimal satu agent ERC-8004; validasi DSL/schema/invariant sebelum signing; invalid output berhenti setelah retry terbatas |
| FR-06 | P0 | Proposal, activation, revoke, cache | Mapping sesuai schema current; agent signature diperiksa; reuse pasangan yang sama tidak memanggil LLM; revoke/stale tidak dapat digunakan untuk port baru |
| FR-07 | P0 | Port dan provenance | Setiap port valid menghasilkan record berantai; SDK memverifikasi terhadap head; live owner menyetujui, sender boleh relayer |
| FR-08 | P0 | SDK kecil dan typed errors | `createRupa`, `getAssetsFor`, `port`, `getProvenance`, passkey register, interpreter dan admin helpers mempunyai types dan tests |
| FR-09 | P0 | Demo consumer pada satu origin | Arena mint/use, Social frame, Gallery card, route docs; tidak membuat passkey berbeda per path |
| FR-10 | P0 | View diperbarui dari history | `Used(WIN)` yang sah mengubah title setelah refresh/refetch tanpa mapping/LLM baru; riwayat port lama tetap sama |
| FR-11 | P0 | DX dan akses juri | README menampilkan status/live link, instruksi wallet/passkey, contract/agent data nyata; quickstart dapat diuji dari consumer bersih setelah SDK tersedia |
| FR-12 | P1 | Reputasi agent | Target app admin memberi feedback; sumber evaluator ditampilkan; SDK dapat memilih kandidat eligible berdasarkan score |
| FR-13 | P1 | Royalty port | Formula disepakati sebelum coding; transaksi membayar origin sesuai konfigurasi; event sesuai transfer nyata |
| FR-14 | P1 | Agent kedua | Dua agent/card dan perbandingan score; boleh dipotong setelah royalty menurut urutan handoff |
| FR-15 | P1 | Developer view dan waitlist | Contoh integrasi terlihat; formulir opt-in menghasilkan penyimpanan nyata/tautan form yang dapat dipakai, bukan sukses palsu |
| FR-16 | P2 | Wrapper external NFT | Live ownership sumber menjadi otoritas; tidak ada custody; desain tambahan disetujui sebelum implementasi |
| FR-17 | P2 | Kemudahan demo tambahan | Faucet browser-burner, React SDK components, dan game visual bila waktu cukup; tidak menggeser core flow |

P0 wajib untuk MVP yang diklaim lengkap. P1 adalah target jika waktu cukup. Urutan pemotongan fitur tetap mengikuti handoff, bukan hanya angka prioritas. Fallback raw P256 adalah pengecualian yang dinyatakan terbuka, bukan kelulusan WebAuthn penuh.

## Requirement nonfungsional

| ID | Requirement | Cara menilai |
| --- | --- | --- |
| NFR-01 | Tidak ada secret/PII tidak perlu pada repo, browser, prompt atau log | Review boundary + secret scan; prompt memakai allowlist data aset publik |
| NFR-02 | Determinisme dan integritas | Input identik menghasilkan view identik atau typed error; SDK dan agent memakai interpreter sama; hash diverifikasi |
| NFR-03 | Approval aman dan atomik | Revert tidak mengonsumsi nonce atau menulis provenance; replay/wrong-owner gagal |
| NFR-04 | RPC efisien dan gagal secara jelas | Multicall, pagination, retry berbatas; transport failure dibedakan dari unsupported |
| NFR-05 | UX dapat dipahami dan diakses | Status langkah, error actionable, navigasi keyboard, kontras/readability, layout mobile |
| NFR-06 | Bukti yang dapat direproduksi | Dependency/ABI pinned, fixture browser, deployment block, test command dan hasil dicatat |
| NFR-07 | Dokumentasi jujur | Tidak mengklaim mock sebagai onchain, cache berbeda target sebagai hit, atau event sebagai pembayaran |

Target engineering awal, **belum terukur**: render aset cached ≤3 detik pada koneksi demo; translate selesai ≤60 detik atau error/timeout terstruktur; ≤3 percobaan LLM total. Waktu konfirmasi chain dan interaksi passkey dilaporkan terpisah. Target ini perlu pengukuran M6–M10, bukan SLA produksi.

## Alur utama dan recovery

1. Pengguna membuka Arena, menghubungkan wallet testnet, memperoleh aset lewat duel sederhana.
2. Pengguna mendaftarkan passkey melalui wallet; aplikasi menjelaskan bahwa approval berikutnya memakai passkey.
3. Social menampilkan aset portable. Pengguna melihat tujuan dan preview, meminta mapping bila belum ada, lalu menyetujui passkey.
4. SDK mengirim port, menunggu receipt sukses, memuat ulang view dan provenance.
5. Gallery memakai mapping Gallery yang sudah disiapkan; developer panel menunjukkan bahwa tidak ada request translate.
6. WIN baru mengubah title Social melalui history. Royalty hanya ditampilkan bila transfer nyata diaktifkan.

Cancel passkey mempertahankan state sebelum submit. Receipt gagal tidak menghasilkan sukses UI. Transfer owner sebelum submit menggagalkan approval lama. Schema berubah saat prompt memaksa refresh mapping dan approval baru. Detail state berada di [UX](ux-spec.md).

## Ukuran keberhasilan

Prioritas mengikuti bobot rubric yang dicantumkan handoff; ketentuan penyelenggara belum diverifikasi secara independen pada tahap dokumentasi ini.

| Kriteria | Bobot handoff | Bukti produk yang diprioritaskan |
| --- | --- | --- |
| Technical Execution | 20% | Passkey/P256, nonce, negative tests, isolasi keys |
| Design & Craft / DX | 20% | SDK kecil, typed errors, quickstart yang diuji |
| Originality & Track Insight | 15% | Primitive terbuka, ownership tetap, competing agents |
| Founder & Market Readiness | 25% | Target adopter jelas dan alasan mengurangi integrasi manual |
| Traction & Path Forward | 20% | Bukti consumer eksternal bila tersedia dan waitlist berfungsi |

| Ukuran | Target | Evidence |
| --- | --- | --- |
| Primitive berfungsi | Lima kontrak terhubung + minimal satu agent live | Test, manifest, tx hash pada tahap deployment |
| Persetujuan nyata | ≥1 platform browser berhasil; target desktop Chrome, iOS Safari, Android | Fixture dan device checklist |
| Mapping reusable | Port pasangan current berikutnya tanpa translate/LLM | Network trace dan log hit counter |
| Provenance | SDK menerima chain valid dan menolak data yang dimodifikasi | Unit/integration test |
| DX | Consumer bersih dapat integrasi dasar dalam target 10 menit | Catatan uji quickstart |
| Adopsi | Target satu tim eksternal mencoba `getAssetsFor` | Catatan integrasi yang benar-benar terjadi; belum ada |
| Submission | Demo ≤3 menit, pitch ≤2 menit, repo publik, logo ≤3 MB | Checklist submission |

## Release gate

Checklist handoff §14 tetap acuan akhir. Selain itu, tidak boleh ada kegagalan terbuka pada signature/replay, kontrol akses, validasi mapping, atau kebocoran secret. Milestone deployment dan publikasi dikerjakan kemudian sesuai arahan pengguna. Persiapan dokumen ini tidak menyatakan proyek siap submit.
