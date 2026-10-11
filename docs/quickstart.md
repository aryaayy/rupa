# Quickstart — integrasi dalam target 10 menit

**Status: panduan target, belum dapat dijalankan.** `@rupa/sdk`, manifest deployment, dan live agent belum tersedia. Angka 10 menit adalah target DX yang akan diuji pada M9, bukan hasil pengukuran saat ini. Untuk membangun repository terlebih dahulu, baca [development](development.md).

## Prasyarat setelah SDK tersedia

- App terdaftar dengan schema canonical, app ID nyata, dan mapping/type policy yang didukung.
- Wallet/public clients viem mengarah ke Monad testnet yang telah diverifikasi.
- Alamat kontrak, deployment block, dan agent endpoint nyata; wallet memiliki MON testnet bila menjadi sender.
- Untuk demo passkey, semua consumer berada pada satu origin yang cocok RP ID deployment. SDK tidak membuat passkey lintas domain bekerja otomatis.

## 1. Hubungkan package

Di pnpm monorepo, tambahkan `@rupa/sdk` sebagai `workspace:*` dependency consumer. Setelah paket dipublikasikan, command consumer eksternal yang dituju adalah:

```bash
pnpm add @rupa/sdk viem
```

Jangan menjalankan command itu sebagai bukti paket sudah ada di registry. Sebelum publikasi, uji consumer bersih melalui hasil `pnpm pack`/tarball lokal saat M6/M9.

## 2. Inisialisasi client

Contoh berikut membutuhkan `walletClient`, `registeredAppId`, `agentUrl`, dan `connectedAddress` dari konfigurasi aplikasi. Provider wallet, connect UI, dan approval UI disediakan consumer.

```ts
import { createRupa } from "@rupa/sdk";

const rupa = createRupa({
  chain: "monad-testnet",
  appId: registeredAppId,
  walletClient,
  agentUrl,
});

const assets = await rupa.getAssetsFor(connectedAddress);
```

Render `active` menggunakan view tervalidasi. Tampilkan Bring here pada `portable`. Pada `unsupported`, tampilkan reason yang diberikan. Jangan menampilkan transport error sebagai daftar kosong yang berhasil dimuat.

## 3. Register passkey dan lakukan port

Registrasi dijalankan sekali oleh owner ketika key belum ada, melalui aksi user:

```ts
await rupa.passkey.register();
```

Kemudian setelah pengguna meninjau target, mapping, dan fee yang berlaku:

```ts
const portResult = await rupa.port(selectedAssetId, {
  onStep: (step) => updatePortStatus(step),
  onReview: (preview) => showApprovalReview(preview),
});

const updatedAssets = await rupa.getAssetsFor(connectedAddress);
const history = await rupa.getProvenance(selectedAssetId);
```

`updatePortStatus` adalah callback UI consumer. `showApprovalReview` adalah dialog consumer yang mengembalikan `Promise<boolean>`; hook `onReview` masih usulan API M6 untuk memastikan mapping baru dapat ditinjau sebelum prompt passkey. Tangani RupaError menurut `code`; untuk cancel cukup kembali ke state sebelumnya. Bila ada txHash tetapi status belum pasti, periksa receipt sebelum submit ulang. Aktivasi dan indikator hash verified baru ditampilkan setelah konfirmasi/verifikasi berhasil.

## 4. Integrasi origin app

Di lingkungan admin yang sah, gunakan `admin.registerApp`, `admin.mint`, dan `admin.recordUse`. Wallet admin/minter atau adapter backend menandatangani transaksi; jangan memasukkan private key service atau pinning token ke aplikasi browser. Content publisher harus menghasilkan schema/attrs canonical dengan hash yang cocok.

Gunakan schema output kecil dengan required/enum/length caps. Contoh mapping dan tier policy ada di [DSL](mapping-dsl.md). Daftarkan schema baru melalui updateSchema; versi bertambah dan mapping versi lama perlu diganti.

## 5. Checklist integrasi

- [ ] App ID dan chain berasal dari deployment nyata.
- [ ] Setidaknya satu aset dibaca dengan owner dan origin benar.
- [ ] Register passkey dan port dapat dilakukan dari origin yang sesuai.
- [ ] Cache hit diuji untuk type, target app, dan schema version yang sama.
- [ ] Schema update/revoke, cancel, dan insufficient funds memberi error yang dapat dipahami.
- [ ] Provenance diterima hanya setelah head diverifikasi.
- [ ] Consumer tidak membawa server credentials.

Catat waktu mulai/selesai dan kendala uji sebagai T-DX-01. Dokumentasi API lengkap ada di [SDK dan API](sdk-and-api.md); akses demo akan ditambahkan di [judge guide](judge-guide.md) setelah deployment.
