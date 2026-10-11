# SDK dan API service

Status: target interface; paket `@rupa/sdk` dan endpoint belum tersedia. Contoh bukan klaim package telah diterbitkan. Perubahan types tambahan harus konsisten dengan baseline handoff.

## SDK publik

```ts
const rupa = createRupa({
  chain: "monad-testnet",
  appId,
  walletClient,
  agentUrl,
});

const assets = await rupa.getAssetsFor(ownerAddress);
const result = await rupa.port(assetId, { onStep });
const history = await rupa.getProvenance(assetId);
await rupa.passkey.register();
const view = rupa.applyMapping(mappingJson, assetContext);
```

| API | Kontrak perilaku |
| --- | --- |
| `createRupa(config)` | Validasi chain/app/config; resolve deployment yang cocok; tidak auto-submit transaksi |
| `getAssetsFor(address)` | Discovery kandidat lalu live ownership; mapping/content validation; status dan origin/provenance |
| `port(assetId, {onStep})` | Resolve mapping current, preview/approval, submit, tunggu receipt; hasil mengandung txHash, recordId, mappingId |
| `getProvenance(assetId)` | Reconstruct record dan verifikasi head; typed error bila data incomplete/tampered |
| `passkey.register()` | Browser create, parse COSE, validasi ES256/P256, tx register oleh wallet owner |
| `applyMapping(mapping, context)` | Pure evaluator; schema/policy yang sudah dimuat atau dibundel dipakai untuk output validation; tidak fetch saat fungsi berjalan |
| `admin.registerApp({name,schema,payout,royaltyBps})` | Pin canonical schema melalui adapter yang berwenang, submit registry tx |
| `admin.mint(player, {assetType,rarity,attrs})` | Hash/pin attrs melalui adapter, panggil minter; tidak menyimpan server credentials di browser |
| `admin.recordUse(assetId, "WIN")` | Encode tag dan kirim sebagai app admin; enforce contract permissions |

Kebutuhan implementasi M6: tambahkan adapter content publisher dan pilihan public client/transport tanpa memasukkan pinning secret ke frontend. `applyMapping` harus mendapatkan schema yang sudah tersedia: bisa melalui cache instance `createRupa`, atau explicit context/schema pada API pure package DSL. Jangan menyebut fungsi pure jika ia diam-diam melakukan HTTP.

`passkey.rotate()` adalah perluasan SDK yang direncanakan untuk recovery; user tetap memakai wallet owner. EOA connect dibutuhkan untuk registrasi/recovery dan sender default; port dapat memakai relayer bila adapter tersedia. Dukungan relayer tidak diasumsikan gratis atau otomatis tersedia.

## Status aset

Hasil baseline mempunyai `assetId`, `status`, `view`, `origin`, dan `provenance`.

| `status` | Arti |
| --- | --- |
| `active` | Ada activation dan mapping yang masih usable; view lolos validasi |
| `portable` | Asset supported, belum mempunyai activation usable untuk app; mapping dapat diperoleh |
| `unsupported` | Jenis aset/schema berada di luar kemampuan yang dideklarasikan; alasan spesifik tersedia |

Usulan field tambahan: `reasonCode`, `activation: { mappingId, approver, approvedByPreviousOwner }`, dan `mapping: { id, schemaVersion, agentId }`. Historical `isActive=true` tidak otomatis berarti view current usable. Bila revoked/stale, tampilkan alasan dan replacement flow. Transport error tidak boleh diam-diam mengubah semua aset menjadi unsupported.

Jika history belum lengkap atau content tidak valid, `view` tidak diberikan sebagai data tervalidasi. Pada API baca multi-aset, error per aset dapat disertakan secara terstruktur; error konfigurasi/chain tetap menggagalkan request keseluruhan. Bentuk final union type dikunci saat M6.

## Progress dan retry

Step handoff: `mapping:cached`, `mapping:requesting`, `passkey:prompt`, `tx:sent`, `tx:confirmed`. SDK mendokumentasikan urutan dan payload event. Cache hit memerlukan mapping current dan usable untuk **target app yang sama**.

Gunakan nonce/deadline terbaru ketika membangun approval. Jika nonce/schema berubah saat dialog, refresh dan minta persetujuan baru. Timeout setelah tx dikirim harus mengembalikan txHash supaya caller mengecek receipt, tidak mengirim ulang tanpa memeriksa state. Setelah receipt sukses, invalidate activation/history cache dan baca ulang state penting.

Untuk preview mapping yang baru selesai dibuat, `onStep` saja belum menyediakan jeda konfirmasi. Usulan M6: opsi `onReview(preview): Promise<boolean>` pada `port`, dipanggil setelah mapping tervalidasi dan sebelum `passkey:prompt`; false menghentikan flow tanpa submit. UI consumer harus memasang hook ini atau menyediakan tahap prepare/review ekuivalen yang terdokumentasi. Bekukan bentuk API saat M6 dan uji cancel serta perubahan nonce/schema selama review.

## Agent HTTP

### `POST /translate`

Request JSON:

```json
{ "assetId": "42", "targetAppId": 2 }
```

assetId adalah string desimal uint256; targetAppId integer uint32. Chain dikunci oleh konfigurasi service; jangan menerima RPC URL atau private key dari request. Batasi body dan rate per IP serta assetType. Endpoint publik memproses data publik; ini bukan endpoint admin mint.

Response sukses sesudah proposal confirmed:

```json
{
  "mappingId": "<bytes32-hex>",
  "contentURI": "ipfs://<cid>",
  "txHash": "<transaction-hash>"
}
```

Placeholder di atas bukan nilai valid. Baseline synchronous API mengembalikan HTTP 200 untuk proposal baru maupun reuse proposal valid yang sudah ada; field opsional `reused` dapat menjelaskan hasil. Bila job in-progress, gunakan 409 dengan requestId/retry hint; jangan mengembalikan sukses sebelum proposal confirmed. Pemindahan ke job API asynchronous memerlukan revisi spesifikasi jika limit hosting menuntutnya.

Deduplication key: chain + MappingRegistry + assetType + targetAppId + schemaVersion. Sebelum sign dan submit, baca ulang versi schema. Jika berubah, hentikan hasil lama. Setelah tx timeout, rekonsiliasi registry/receipt sebelum membuat proposal baru.

### `GET /.well-known/agent-card.json`

Mengembalikan card agent sesuai schema ERC-8004 yang sudah diverifikasi: identity, nama, endpoint/service, model, dan supported trust. Jangan mempublikasikan provider key, signer secret, atau prompt internal berisi data sensitif. Card tidak membuktikan endpoint tersedia; health check terpisah.

### `GET /health`

HTTP 200 untuk service ready; 503 bila dependency konfigurasi wajib belum siap. Response publik hanya status, versi service, dan chain ID yang tidak sensitif. Jangan memanggil LLM berbayar pada setiap probe atau menampilkan exception/env lengkap.

## Error envelope dan pemetaan

```json
{
  "error": {
    "code": "MAPPING_REJECTED",
    "message": "Mapping belum memenuhi schema aplikasi.",
    "retryable": false,
    "requestId": "<public-request-id>"
  }
}
```

| Code SDK / service | HTTP bila relevan | Recovery |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Perbaiki input |
| `ASSET_NOT_FOUND`, `APP_NOT_FOUND` | 404 | Refresh atau pilih ID yang ada |
| `NO_PASSKEY` | — | Register melalui wallet |
| `PASSKEY_CANCELLED`, `PASSKEY_UNAVAILABLE` | — | User retry / perangkat yang mendukung |
| `NOT_OWNER`, `WRONG_CHAIN` | — | Ganti wallet/network atau refresh |
| `SCHEMA_OUTDATED`, `NONCE_CHANGED` | 409 / — | Refresh data dan approval |
| `TRANSLATION_IN_PROGRESS` | 409 | Retry sesuai hint; tidak memanggil model ganda |
| `MAPPING_REJECTED`, `UNSUPPORTED_ASSET` | 422 | Tampilkan detail aman; jangan submit |
| `CONTENT_HASH_MISMATCH`, `PROVENANCE_INVALID` | — | Fail closed dan laporkan sumber data |
| `RATE_LIMITED` | 429 | Backoff sesuai Retry-After |
| `DEPENDENCY_UNAVAILABLE` | 502/503 | Retry terbatas, jangan ubah validasi |
| `TRANSLATION_TIMEOUT` | 504 | Periksa request/tx yang mungkin sudah berjalan |
| `DEADLINE_EXPIRED`, `TX_REVERTED`, `RPC_ERROR` | — | Jelaskan alasan dan langkah berikutnya |

RupaError menyimpan code stabil, pesan pengguna, cause untuk debug yang sudah disanitasi, dan metadata aman seperti txHash. Jangan bergantung pada string revert provider yang berubah-ubah.

## Reputasi

Pemilihan agent memfilter chain, schema/type support, endpoint sehat, dan identitas valid; kemudian memakai summary dari evaluator yang telah dipilih. Tie-break deterministik memakai agentId. Nilai count=0 berarti belum dinilai. Jangan menyatakan semua registered app admins merupakan jaringan anti-sybil. Pembatasan self-feedback dan perubahan wallet identity harus mengikuti ABI deployment yang diverifikasi.
