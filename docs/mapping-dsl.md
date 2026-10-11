# Mapping DSL v1

Status: interpreter/validator shared di `packages/mapping-dsl` sudah diterapkan dan diuji. D-09/D-15 mendefinisikan profil bounded MVP; dukungan schema umum tidak diklaim.

## Input dan output

Interpreter menerima mapping JSON, asset context `{base, attrs, history}`, dan target schema yang sudah diverifikasi hash-nya. Ia menghasilkan objek target atau typed error. Tidak ada network, clock, randomness, akses global, `eval`, JavaScript expression, atau operasi filesystem dalam evaluator.

```json
{
  "rupa": "mapping/v1",
  "assetType": "rupa.weapon.sword",
  "targetAppId": 2,
  "targetSchemaVersion": 1,
  "rules": [
    { "target": "kind", "const": "profile_badge" },
    { "target": "color", "from": "attrs.element", "map": { "fire": "#FF5A1F", "ice": "#4FC3F7" }, "default": "#999999" },
    { "target": "title", "template": "{{attrs.name}} — {{history.wins}} wins" },
    { "target": "tier", "from": "base.rarity", "map": { "0": "bronze", "1": "silver", "2": "steel", "3": "gold", "4": "legend" } }
  ],
  "rationale": "Elemen menentukan warna frame; history kemenangan menentukan judul."
}
```

Contoh menggunakan app ID ilustratif. `targetSchemaVersion` v1 mengikuti format integer handoff dan dibatasi `Number.isSafeInteger`; versi uint64 di luar batas JS safe integer harus ditolak sampai format DSL baru menyediakan encoding lossless. assetId/agentId uint256 yang berada di payload lain selalu string desimal.

## Semantik rule

| Field | Aturan |
| --- | --- |
| `target` | Nama properti top-level schema output; unik per mapping; nested target ditunda |
| `const` | Nilai JSON literal; tidak boleh digabung dengan `from` atau `template` |
| `from` | Path allowlisted ke `base`, `attrs`, atau `history`; own properties saja |
| `map` | Dictionary literal, hanya bersama `from`; lookup exact key dari string/boolean/finite number |
| `template` | String dengan placeholder path; tanpa conditional, operator, fungsi, atau HTML execution |
| `default` | Nilai saat path opsional tidak tersedia atau lookup map tidak cocok; bukan pemutih output invalid |

Setiap rule memiliki tepat satu producer: `const`, `from`, atau `template`. `map` memodifikasi `from`; `default` hanya bersama `from`. Unknown field/operator, duplicate target, path terlarang, dan kombinasi ambigu adalah error.

Path grammar baseline: segmen identifier dipisahkan titik; tanpa bracket/index array pada v1. Tolak segmen `__proto__`, `prototype`, dan `constructor`, termasuk pada objek map/const bersarang. Resolve hanya own property. Source path divalidasi terhadap source schema/allowlist dan asset instance; field opsional yang tidak hadir memerlukan default.

Template mensubstitusi scalar dengan representasi yang stabil; objek/array/null pada placeholder ditolak. Missing placeholder adalah error. Hasil diperlakukan sebagai teks biasa; consumer tidak memasukkannya melalui raw HTML. Rule tidak dapat membaca output rule lain, sehingga urutan tidak mengubah hasil untuk target yang unik.

## Source context

- `base.rarity`: integer 0–4; field base lain hanya diekspos bila perlu dan ada pada allowlist.
- `attrs`: JSON public content yang cocok dengan attrsHash; untuk sword demo minimal `name` dan `element`.
- `history.wins`: jumlah event `Used` dengan tag WIN untuk asset dan origin app, diurutkan/didedupe dari deployment block. Tag baseline `keccak256(UTF8("WIN"))`; tag lain memakai konvensi yang sama.
- Wallet, credential ID, email, bearer token, serta data waitlist tidak termasuk context model.

Timestamp/snapshot block context harus sama bila output dibandingkan untuk determinisme. Bertambahnya WIN adalah perubahan input, sehingga perubahan title bukan nondeterminisme.

## Schema dan invariant

Gunakan ajv JSON Schema 2020-12 dengan schema yang telah diverifikasi. Semua `$ref`, `$dynamicRef`, `$recursiveRef`, `pattern`, `patternProperties`, dan `format` ditolak, termasuk referensi lokal. Profil konservatif ini mencegah recursive/network/regex schema; bukan seluruh fitur JSON Schema. Output object divalidasi pada **setiap eksekusi**, termasuk mapping dari agent pihak lain dan asset yang tidak ada pada tiga sample awal.

Schema demo menetapkan required properties, jenis field, enum/range, string caps, dan `additionalProperties: false`. Untuk field `tier`, policy Rupa demo menetapkan rank tetap: bronze=0, silver=1, steel=2, gold=3, legend=4. `rank(tier) <= base.rarity`; enum tak dikenal error. Schema aplikasi lain harus mendeklarasikan policy tier yang dapat dibandingkan sebelum dianggap supported.

Field URI pada output aset hanya boleh IPFS jika diperlukan. Prohibisi URL tidak berlaku pada endpoint layanan HTTP agent di agent card. Validation mencakup format field, string, serta nested JSON literal agar URL tidak diselundupkan melalui `const`. Aturan ini membatasi output; tidak menjamin model tidak pernah terpengaruh instruksi berbahaya.

Limit yang diterapkan: maksimum 32 rules, 64 KiB mapping/schema JSON, 64 KiB attrs JSON, 8 segmen source path, 256 karakter nama/title, 1.024 karakter rationale, 2.048 karakter URI. Batas depth 16 dan 8192 node juga diterapkan. Payload dibatasi sebelum parse; tree divalidasi sebelum evaluasi. Agent dan SDK memakai implementasi yang sama.

## Canonicalization dan hash

Gunakan JSON Canonicalization Scheme sesuai [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), lalu UTF-8 dan keccak256. Tolak data yang tidak bisa direpresentasikan tanpa ambiguitas, termasuk duplicate object key saat parse raw JSON, angka non-finite, dan integer ID yang kehilangan presisi. Implementasi menyortir key menurut UTF-16 dan memakai representasi string/number ECMAScript, dengan profil lebih ketat: semua integer harus safe integer, tanpa lone surrogate, unsafe keys, sparse/extended arrays atau objek non-JSON. Jangan menganggap `JSON.stringify` tanpa sorting setara JCS.

Pin **bytes canonical yang sama** ke IPFS. CID adalah locator; `contentHash` adalah digest bytes canonical. Mapping JSON harus cocok dengan assetType hash, target app, dan versi yang dicatat registry. Schema/attrs memakai konvensi hash yang sama agar agent dan SDK memverifikasi identik.

## Pipeline agent

1. Baca asset, schema, versi, dan hash dari chain; fetch content terbatas dari gateway yang dikonfigurasi.
2. Verifikasi hash attrs dan schema target; dukung source type yang dikonfigurasi dan pilih name/element/rarity/wins dengan batas panjang.
3. Kirim system instructions DSL + contoh + target schema + data dalam struktur terpisah ke LLM.
4. Parse structured output; validasi grammar, source path, target, limit, dan metadata mapping.
5. Jalankan terhadap minimum tiga fixture berbeda termasuk rarity minimum/maksimum dan nilai enum tak dikenal; validasi schema dan invariants.
6. Jika gagal, retry maksimum dua kali setelah percobaan pertama dengan error feedback; tidak sign/pin proposal invalid.
7. Canonicalize, pin, sign EIP-712, propose, tunggu receipt sukses, kembalikan mapping ID.

Sampel tidak membuktikan semua input valid. Karena itu runtime validation dan property testing wajib. Sepuluh pasangan test tidak berarti sepuluh pemanggilan provider berbayar harus berjalan pada setiap CI; gunakan provider stub deterministik di unit suite dan smoke live terpisah.

## Error evaluator

Code mencakup `INVALID_JSON`, `INVALID_MAPPING`, `UNKNOWN_OPERATOR`, `INVALID_SOURCE_PATH`, `MISSING_SOURCE`, `DUPLICATE_TARGET`, `LIMIT_EXCEEDED`, `SCHEMA_INVALID`, `INVARIANT_VIOLATION`, `CONTENT_HASH_MISMATCH`. Agent dapat memetakan kumpulan error ke HTTP 422; SDK membungkusnya dalam RupaError dengan detail aman. Tidak mengembalikan view parsial sebagai valid.
