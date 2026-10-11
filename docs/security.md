# Security dan trust model

Status: requirement dan rancangan kontrol, **bukan hasil audit keamanan**. Target penggunaan awal adalah demo testnet.

## Aset yang dilindungi dan pihak yang dipercaya

Aset utama: hak approval owner, key wallet/passkey, signer service, integritas mapping/schema, keutuhan provenance, dan saldo demo. App admin dipercaya menyatakan schema dan use; agent diidentifikasi tetapi outputnya tetap divalidasi; provider LLM dan content IPFS tidak menjadi otoritas approval.

Kontrak tidak menjalankan DSL. Karena registry terbuka, signature agent dan jumlah approval tidak membuktikan seluruh invariant semantik. SDK yang dipakai aplikasi wajib memverifikasi content dan menjalankan validator yang sama dengan agent.

## Threat matrix

| Ancaman | Kontrol wajib | Bukti |
| --- | --- | --- |
| Replay atau pemindahan approval ke chain/app/aset lain | Domain chain+ledger, owner, asset, target, mapping, nonce, deadline | T-AUTH-02/03 |
| Assertion pada RP yang salah atau tanpa user verification | RP hash, UP, UV, type/challenge, policy origin | T-AUTH-04/05 |
| Signature malleability / return precompile malformed | SDK low-s normalization, onchain range/low-s, success+length+value | T-AUTH-06/07 |
| Register/rotate key untuk owner lain | Binding msg.sender; ledger-only verify; rotation tidak reset nonce | T-AUTH-08 |
| Mapping malicious/invalid | DSL whitelist, content hash, output schema, rarity cap, runtime validation | T-DSL-01/02/03 |
| Prompt injection | Data dipisahkan dari instruksi, allowlist input, validator sebelum signer | T-AGENT-02 |
| Agent identity/signature palsu | ABI pinned, live wallet resolution, EIP-712 chain/contract binding | T-REG-02 |
| Source URL SSRF/resource exhaustion | Gateway allowlist, IPFS resolver terbatas, no remote schema refs, caps/timeouts | T-AGENT-03 |
| Port setelah transfer/revoke/schema update | Live owner dan state checks saat tx | T-LEDGER-02 |
| Royalty reentrancy/failed payout | CEI, guard, value policy, atomic rollback | T-LEDGER-03 |
| Provenance palsu atau event hilang | Deterministic reconstruction dan head comparison | T-SDK-02 |
| Secret atau PII bocor | Server-only env, redaction, minimal prompt, scan secret | T-OPS-01 |
| Reputasi hasil sybil | Evaluator policy yang dinyatakan terbuka; jangan klaim kebal sybil | T-REP-01 |

## WebAuthn

Ledger menghitung approval hash dari data transaksi dan state terbaru. Approver memeriksa hanya ledger yang dapat memanggil verifier. Signature harus tetap diverifikasi terhadap bytes authenticatorData/clientDataJSON asli, dengan indeks byte tervalidasi sebelum slice.

Verifikasi `type=webauthn.get`, challenge tepat 43 karakter base64url tanpa padding untuk 32 bytes, RP hash, UP/UV, deadline, dan P256. Key registration memeriksa COSE kty=2, crv=1, alg=-7 dan coordinate length. DER parser menolak integer malformed; r/s diserialisasi fixed-width dengan benar dan s dinormalisasi.

Usulan D-05 menambahkan exact origin allowlist dan menolak flow cross-origin yang tidak didukung. [WebAuthn specification](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion) memisahkan pemeriksaan origin dari RP ID dan challenge; RP hash saja bukan pengganti pemeriksaan origin. Pilihan parser harus mencegah nested-field/duplicate-field/escaped-string confusion. Dukungan browser dibuktikan dengan fixture asli; jangan berasumsi semua JSON memiliki byte layout sama.

`signCount` tidak dipakai sebagai replay guard karena passkey tersinkron dapat memberikan nilai nol, sebagaimana diantisipasi handoff. Nonce per owner menjadi replay guard aplikasi. Rotation tidak mereset nonce. Contract/state changes dalam transaksi yang revert harus rollback termasuk nonce.

Recovery menggunakan EOA owner melalui `rotatePasskey`. Ini berarti keamanan wallet owner tetap penting. Registrasi key membuktikan wallet memilih key tersebut; kebijakan attestation hardware tidak termasuk MVP. Jangan mengklaim kontrak menerima biometrik: yang diverifikasi adalah signature.

## P256 precompile

[Dokumentasi Monad](https://docs.monad.xyz/developer-essentials/precompiles) menyebut input fixed-width 160 bytes pada `0x0100`, return 32-byte angka 1 untuk valid, dan empty bytes untuk invalid. Implementasi harus memeriksa `success`, panjang tepat 32, dan nilai 1 sebelum decode diterima. `eth_getCode` kosong tidak membuktikan precompile absen; gunakan vector valid dan invalid.

Verifier local yang di-etch adalah alat unit test, bukan bukti runtime Monad. Gunakan fork/live call terpisah dengan block, input digest, output, dan tool version tercatat.

## Isolasi agent dan content

LLM tidak memperoleh keys atau kemampuan memanggil signer langsung. Setelah output lolos validasi, signer hanya menandatangani typed data yang disusun service dari chain state dan verified content. Retry maksimal tiga percobaan total. Batasi input/response size, durasi, concurrency, dan budget request.

Atribut berupa string tetap dapat berisi PII atau instruksi meskipun disebut publik. Terapkan allowlist field dan batas panjang sebelum prompt; demo menggunakan fixture yang tidak memuat data personal. Sanitasi log request/model. Jangan menganggap penolakan tiga injection sample menjamin semua prompt injection teratasi.

IPFS resolver menggunakan gateway yang dikonfigurasi; jangan mengunduh URL arbitrary dari request/LLM. Matikan remote JSON Schema refs. Render title sebagai teks. Verifikasi content hash sebelum mengeksekusi DSL, termasuk setelah gateway fallback.

## Key dan operasi

- Pisahkan deployer, agent, faucet, serta admin demo. Hak minter/admin tidak ditempelkan pada route publik tanpa autentikasi dan rate limit.
- Frontend hanya menerima public config; `VITE_`/`NEXT_PUBLIC_` tidak boleh berisi private key, pinning JWT, atau provider key.
- `.env.example` berisi nilai kosong; `.env*` di-ignore dengan exception template tersebut.
- Fixture boleh berisi assertion/public key untuk chain/key uji; jangan menyimpan private key atau credential store. Tandai chain/domain/nonce fixture agar replay test dipahami.
- Jangan memakai wallet bersama dengan private key publik untuk juri. Browser burner bersifat opsional dan memiliki batas saldo/umur yang jelas jika dibangun.

## Emergency response dan disclosure

Jika key service bocor: hentikan job/signing, cabut credential provider, ganti signer sesuai mekanisme registry yang terverifikasi, revoke mapping terpengaruh, dan catat rentang tx yang perlu ditinjau. Rotation key saja tidak menghapus historical mapping. Jika bug port ditemukan, gunakan pause yang benar-benar tersedia; jika belum diimplementasikan, jangan mengklaim penghentian kontrak global. Pause UI/service tidak menghentikan pemanggil langsung.

Untuk raw-P256 fallback: key non-extractable tidak berarti tahan XSS; script pada origin dapat meminta signature. Tampilkan mode dan keterbatasan storage/recovery secara jujur. Tidak ada downgrade otomatis ketika WebAuthn gagal.
