# Spesifikasi kontrak

Status: rancangan interface berdasarkan handoff; **belum ada Solidity, ABI hasil build, atau deployment Rupa**. Detail berstatus usulan di [decision log](decisions.md) harus dikunci sebelum ABI final.

## Alamat dan artefak

| Komponen | Alamat testnet | Status |
| --- | --- | --- |
| RupaAsset | TBD | Belum deploy |
| AppRegistry | TBD | Belum deploy |
| MappingRegistry | TBD | Belum deploy |
| PasskeyApprover | TBD | Belum deploy |
| PortLedger | TBD | Belum deploy |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Tercantum di upstream; runtime belum diverifikasi |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | Tercantum di upstream; runtime belum diverifikasi |
| P256 precompile | `0x0100` | Didokumentasikan Monad; vector test belum dijalankan |

Alamat ERC-8004 sesuai [repository resmi](https://github.com/erc-8004/erc-8004-contracts). ABI harus diambil dari upstream pada commit tertentu dan dibandingkan dengan deployment aktual, termasuk implementation proxy bila relevan. Sumber kebenaran deployment Rupa nantinya `deployments/10143.json`, berisi alamat, deployment block/tx, compiler/ABI revision, RP ID, agent IDs, dan app IDs; file tersebut belum dibuat.

## RupaAsset

`Base = (bytes32 assetType, uint8 rarity, uint32 originAppId, uint64 createdAt, bytes32 attrsHash)`.

| Fungsi | Akses | Perilaku wajib |
| --- | --- | --- |
| `mint(to, assetType, rarity, originAppId, attrsHash, uri)` | Minter yang terdaftar pada origin app | Validasi app/rarity/recipient; mint canonical NFT; simpan base; emit AssetMinted |
| `ownerOfAsset(id)` | Publik, read | Native owner; live source owner untuk wrapper jika fitur tersedia |
| `baseOf(id)` | Publik, read | Data dasar immutable untuk aset yang ada |
| `wrapExternal(collection, tokenId, assetType, attrsHash)` | Current owner collection sumber | Opsional; tidak memindahkan NFT; semantik representation harus diputuskan dulu |

TokenURI/metadata harus memberi jalur yang jelas ke attrs JSON yang hash-nya cocok dengan `attrsHash`. Metadata source publik bukan instruksi bagi model. Tidak ada mint tambahan saat port. `AssetMinted` dan ERC-721 `Transfer` menjadi input discovery SDK.

## AppRegistry

`App = (admin, minter, payout, schemaHash, schemaURI, uint16 royaltyBps, uint64 version)`.

| Fungsi | Akses | Validasi / efek |
| --- | --- | --- |
| `registerApp(name, schemaURI, schemaHash, payout, royaltyBps)` | Permissionless | Admin=sender; app ID unik; versi awal 1; bps ≤500; payout valid; schema tidak kosong |
| `updateSchema(appId, schemaURI, schemaHash)` | Admin app | Version bertambah, SchemaUpdated; mapping versi lama tidak usable untuk port baru |
| `setMinter(appId, minter)` | Admin app | Minter baru valid; mutasi terdokumentasi |

Baseline kerja: minter awal adalah admin, lalu dapat diganti. Batas panjang name/URI dan perilaku address zero dibekukan bersama ABI M2. Schema JSON belum dapat diperiksa kontrak; konsumen harus mengunduh dan mencocokkan hash. Event wajib: AppRegistered dan SchemaUpdated.

## MappingRegistry

Data mapping mengikuti handoff: type, target app, target version, agentId, contentHash/URI, createdAt, approvals, revoked. `mappingId` mengidentifikasi content tertentu; `activeMapping` menunjuk default per pasangan type/target.

| Fungsi | Akses | Validasi / efek |
| --- | --- | --- |
| `proposeMapping(type, app, version, agent, hash, uri, sig)` | Sender bebas | App ada, versi current, agent ada, signature sah, content reference valid; duplicate ID ditangani konsisten tanpa overwrite sejarah |
| `setActive(type, app, mappingId)` | Target app admin | Mapping ada, pasangan cocok, current, tidak revoked |
| `noteApproval(mappingId)` | Hanya ledger yang terikat | Increment approvals; active bila belum ada pilihan yang usable menurut policy final |
| `revokeMapping(mappingId)` | Target app admin | Mark revoked; clear pointer jika menunjuk mapping tersebut; emit MappingRevoked |

Pointer stale sesudah schema update harus diperlakukan sebagai tidak ada mapping usable. Usulan M2: `noteApproval` dapat mengganti pointer stale ketika approval pertama untuk schema current tiba. Ini memperjelas makna "none active" pada handoff; wajib test sebelum finalisasi.

Signature domain dan type mengikuti handoff:

```text
domain: name=Rupa, version=1, chainId=block.chainid,
        verifyingContract=address(MappingRegistry)
type: Mapping(bytes32 assetType,uint32 targetAppId,uint64 schemaVersion,uint256 agentId,bytes32 contentHash)
```

Signer berasal dari `getAgentWallet(agentId)`; fallback `ownerOf(agentId)` hanya berdasarkan policy ABI yang sudah diverifikasi, misalnya wallet zero. Error RPC/ABI tidak boleh otomatis mengaktifkan fallback. Initial MVP dapat membatasi signer agent pada EOA bila dukungan contract wallet belum dibangun, dan batasan tersebut harus ditulis.

## PasskeyApprover

`Key = (uint256 qx, uint256 qy, bytes32 credIdHash)`. Satu key aktif per owner pada MVP. `nonces[owner]` tidak reset setelah rotation.

| Fungsi | Akses | Efek |
| --- | --- | --- |
| `registerPasskey(qx, qy, credIdHash)` | Owner melalui `msg.sender` | Sekali per owner; tolak coordinate/key invalid dan credential hash kosong |
| `rotatePasskey(qx, qy, credIdHash)` | Owner melalui `msg.sender` | Ganti key; key lama gagal; jangan mengurangi nonce |
| `verifyApproval(owner, approvalHash, deadline, assertion)` | Hanya ledger | Verifikasi WebAuthn dan P256; nonce bertambah tepat sekali bila valid |

`Assertion = (bytes authenticatorData, string clientDataJSON, uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s)`. Penambahan origin parsing/index adalah keputusan M1, belum ABI final.

Wajib memeriksa deadline, authData minimal 37 byte, RP hash, flag UP dan UV, type, exact challenge, signature range/low-s, serta hasil precompile. SDK harus mempertahankan bytes clientDataJSON asli untuk signature hash, bukan melakukan serialize ulang.

`credIdHash = keccak256(rawCredentialIdBytes)` sebagai baseline kerja; SDK perlu credential ID asli/discoverable flow untuk prompt browser, bukan hanya hash. Penyimpanan browser menyimpan identifier publik, tidak mengekspor private key.

## PortLedger

`PortRecord = (uint256 assetId, uint32 fromAppId, uint32 toAppId, bytes32 mappingId, uint256 agentId, address approver, uint64 at, bytes32 prevRecord)`.

| Fungsi | Akses | Efek |
| --- | --- | --- |
| `port(assetId, toAppId, mappingId, deadline, assertion)` payable | Sender bebas/relayer | Live ownership dan mapping checks; approval; activation; provenance; fee sesuai mode final |
| `recordUse(assetId, appId, actionTag)` | App admin | Aset dan app ada; native origin atau activation usable sesuai policy; emit Used |
| `isActive(assetId, appId)` | Publik, read | Mengembalikan adanya activation historis dan mapping ID; tidak memverifikasi JSON |
| `headOf(assetId)` / `activeIn(assetId, appId)` | Publik, read | Hash head dan mapping aktivasi tersimpan |

Port harus menolak mapping tidak ada, revoked, type/target tidak cocok, atau schema version stale. Periksa fee sebelum interaksi eksternal. Gunakan CEI dan ReentrancyGuard; kegagalan pembayaran, verifikasi, atau registry call membatalkan seluruh tx.

Baseline history: `fromAppId` pada port pertama adalah origin; port berikutnya adalah target terakhir. Ini urutan provenance, bukan penentuan satu app tempat aset berada. Ulang port oleh owner baru diperbolehkan. Batas `recordUse` perlu diuji agar admin app yang tidak memiliki hubungan origin/activation dengan aset tidak dapat memalsukan use.

Event wajib: Ported, Used, dan RoyaltyPaid **bila pembayaran benar-benar terjadi**. Lihat D-08 untuk formula yang masih terbuka. Tidak mengubah event history yang sudah terbit. `isActive` tetap true setelah transfer; SDK memeriksa owner, revoked/schema, dan menampilkan approval pemilik sebelumnya.

## Encoding lintas implementasi

Tabel berikut adalah baseline teknis; hash provenance menunggu pengesahan D-06 sebelum deploy.

| Nilai | Encoding |
| --- | --- |
| Asset type hash | `keccak256(UTF8(typeName))` |
| Content hash | `keccak256(UTF8(JCS(json)))` |
| Pair key | `keccak256(abi.encode(bytes32 assetType, uint32 targetAppId))` |
| Mapping ID | `keccak256(abi.encode(bytes32 assetType, uint32 targetAppId, uint64 schemaVersion, bytes32 contentHash))` |
| Approval hash | `keccak256(abi.encode(string "RUPA_PORT_V1", uint256 chainId, address ledger, address owner, uint256 assetId, uint32 targetAppId, bytes32 mappingId, uint256 nonce, uint64 deadline))` |
| Browser challenge bytes | Raw 32 bytes approval hash; clientData encodes as base64url tanpa padding |
| Signature digest | `sha256(authenticatorData || sha256(originalClientDataJSONBytes))` |
| P256 input | Lima uint256/bytes32 fixed-width: digest, r, s, qx, qy; tepat 160 byte |
| Record ID, usulan | `keccak256(abi.encode(PortRecord))`; `prevRecord=bytes32(0)` pada port pertama |

Jangan memakai `abi.encodePacked` untuk approval/mapping ID hanya karena precompile memakai packed input. SDK harus memakai urutan field dan tipe Solidity yang sama. Record timestamp direkonstruksi dari block event dengan batas uint64; event tidak memuat `at` pada interface handoff.

## Wiring, error, dan test

Deploy AppRegistry, RupaAsset, MappingRegistry, PasskeyApprover dengan binding ledger yang belum aktif, lalu PortLedger dan finalisasi binding sekali. Seluruh setter binding hanya deployer/admin awal; no public race. Urutan tepat menyesuaikan constructor final D-10 dan diuji di deployment rehearsal.

Gunakan custom errors yang dapat dipetakan SDK, seperti Unauthorized, UnknownAsset, UnknownApp, InvalidMapping, SchemaOutdated, InvalidAgentSignature, NoPasskey, InvalidAssertion, DeadlineExpired, InvalidFee. Nama final berasal dari ABI, bukan string matching.

Test minimum dan traceability berada di [test plan](test-plan.md). Tidak satu pun alamat/ABI rencana di dokumen ini membuktikan deployment sudah ada.
