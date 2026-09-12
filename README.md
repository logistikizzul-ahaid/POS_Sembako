# POS Toko Sembako — Web App (Gratis, Netlify + Supabase)

Aplikasi Point of Sale (kasir) berbasis web untuk toko sembako, dengan:
- RBAC 3 level: **Admin**, **Kepala Toko**, **Kasir**
- Harga dual-tier **Eceran & Grosir** (otomatis + toggle manual)
- Profil toko custom (nama, alamat, logo, catatan struk) — multi-tenant siap
- Cetak struk thermal via **Bluetooth**, **USB (WebUSB)**, atau **Print Dialog biasa**
- Laporan harian + export **Excel** & **PDF**

Stack: **Vite + React + Tailwind CSS** (frontend) + **Supabase** (Auth + Postgres + Storage) — semuanya di tier gratis. Hosting: **Netlify Free**.

---

## 1. Setup Supabase (Gratis)

1. Buat akun di [supabase.com](https://supabase.com) → New Project (pilih region terdekat, mis. Singapore).
2. Buka **SQL Editor** → jalankan seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql).
3. Buka **Storage** → buat bucket baru bernama `store-logos`, set jadi **Public bucket** (untuk logo toko).
4. Buka **Authentication → Providers** → pastikan **Email** provider aktif.
5. Buat toko pertama:
   ```sql
   insert into stores (name, address, phone_whatsapp)
   values ('Toko Sembako Berkah', 'Jl. Merdeka No. 1', '081234567890')
   returning id;
   ```
   Catat `id` toko yang dihasilkan.
6. Buat user admin pertama: **Authentication → Add User** (masukkan email & password).
   Catat `id` user yang dihasilkan (UUID), lalu jalankan:
   ```sql
   insert into users (id, store_id, full_name, role)
   values ('UUID_USER_TADI', 'UUID_STORE_TADI', 'Nama Admin', 'admin');
   ```
7. Ambil kredensial API: **Project Settings → API** → salin `Project URL` dan `anon public key`.

## 2. Setup Lokal

```bash
npm install
cp .env.example .env
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env
npm run dev
```

Buka `http://localhost:5173`, login dengan akun admin yang dibuat di langkah 1.6.

## 3. Deploy ke Netlify (Gratis)

**Opsi A — via Git (disarankan):**
1. Push folder ini ke repository GitHub/GitLab.
2. Di [Netlify](https://app.netlify.com) → **Add new site → Import an existing project**.
3. Pilih repo tersebut. Build command dan publish directory sudah otomatis terbaca dari `netlify.toml`.
4. Masuk ke **Site settings → Environment variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Netlify otomatis menyediakan HTTPS (wajib untuk Web Bluetooth/WebUSB).

**Opsi B — Netlify CLI:**
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_SUPABASE_URL "https://xxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJxxxx..."
netlify deploy --prod
```

## 4. Menambah Toko Baru / Pengguna Baru (Multi-Tenant)

- **Toko baru**: insert baris baru di tabel `stores` via SQL editor Supabase (atau buat halaman admin superuser terpisah jika ingin self-service).
- **Pengguna baru**: buat di **Authentication → Add User**, lalu insert baris di tabel `users` dengan `store_id` yang sesuai dan `role` (`admin` / `kepala_toko` / `kasir`).
- Row Level Security (RLS) sudah dikonfigurasi agar setiap toko **hanya bisa melihat datanya sendiri**.

## 5. Struktur Proyek

```
pos-sembako/
├── netlify.toml              # konfigurasi build & redirect Netlify
├── .env.example               # template environment variables
├── package.json
├── vite.config.js
├── tailwind.config.js
├── supabase/
│   └── schema.sql             # DDL lengkap + RLS + trigger
└── src/
    ├── main.jsx
    ├── App.jsx                 # routing + RBAC route guard
    ├── index.css                # termasuk CSS @media print utk struk
    ├── lib/
    │   └── supabaseClient.js
    ├── contexts/
    │   └── AuthContext.jsx      # session, profil, role, store
    ├── utils/
    │   └── pricing.js           # LOGIKA INTI: eceran vs grosir
    ├── components/
    │   ├── ProtectedRoute.jsx   # RBAC guard per-route
    │   ├── layout/Header.jsx    # header dinamis (nama/logo toko + menu by role)
    │   ├── pos/
    │   │   ├── ProductSearch.jsx
    │   │   ├── Cart.jsx          # toggle manual eceran/grosir per baris
    │   │   └── PaymentModal.jsx  # simpan transaksi + trigger cetak
    │   └── printer/
    │       ├── PrinterManager.js # Bluetooth + WebUSB + ESC/POS encoder
    │       └── ThermalReceipt.jsx # fallback window.print()
    └── pages/
        ├── LoginPage.jsx
        ├── POSPage.jsx           # halaman kasir utama
        ├── ProductsPage.jsx      # CRUD produk (Kepala Toko+)
        ├── StoreSettingsPage.jsx # profil toko (Admin)
        ├── UsersPage.jsx         # kelola role pengguna (Admin)
        └── ReportsPage.jsx       # laporan harian + export xlsx/pdf
```

## 6. Cara Kerja Logika Harga Eceran vs Grosir

Lihat `src/utils/pricing.js` — aturan lengkap:
1. Produk boleh punya `retail_price` (wajib) dan `wholesale_price` (opsional).
2. Syarat qty minimal grosir: per-produk (`wholesale_min_qty`) atau default toko (`stores.wholesale_min_qty`, default 10).
3. Saat qty di keranjang ≥ syarat minimal **dan** produk punya harga grosir → otomatis pindah ke tier grosir.
4. Kasir bisa override manual lewat tombol toggle **Eceran / Grosir** di setiap baris keranjang (`Cart.jsx`).
5. Saat transaksi disimpan, `unit_price` dan `price_tier` yang benar-benar dipakai di-snapshot ke `transaction_items` (tidak berubah walau harga produk diubah di kemudian hari).

## 7. Cara Kerja Cetak Printer Thermal

Lihat `src/components/printer/PrinterManager.js`:
- **Bluetooth**: `navigator.bluetooth.requestDevice()` → pairing → tulis payload ESC/POS ke GATT characteristic. Perlu Chrome/Edge (Android/Desktop), tidak jalan di Safari/iOS.
- **WebUSB**: `navigator.usb.requestDevice()` → klaim interface → `transferOut()` payload ESC/POS. Perlu Chrome/Edge Desktop.
- **Print Dialog (fallback universal)**: komponen `ThermalReceipt.jsx` di-render tersembunyi di halaman, CSS `@media print` di `index.css` menampilkannya hanya saat `window.print()` dipanggil — mencetak lewat driver printer OS (support semua browser, termasuk Safari/iOS, tapi user perlu setting ukuran kertas manual di dialog print / driver).

Kasir memilih metode cetak dari dropdown di `PaymentModal.jsx` sebelum menyelesaikan transaksi.

## 8. Catatan Keamanan

- RLS (Row Level Security) Postgres memastikan isolasi data antar toko meski memakai 1 project Supabase untuk banyak toko (multi-tenant).
- `anon key` Supabase **aman untuk dipublikasikan** di frontend (bukan rahasia) karena akses data dikontrol oleh RLS, bukan oleh key tersebut.
- Jangan pernah menaruh `service_role key` Supabase di frontend/kode client — hanya untuk operasi backend (mis. Netlify Function jika suatu saat dibutuhkan, misalnya untuk membuat user baru otomatis).

## 9. Roadmap Lanjutan (opsional, tidak termasuk versi ini)

- Netlify Function untuk auto-create user (memakai `service_role` key di server-side agar Admin bisa membuat kasir baru langsung dari UI tanpa ke Supabase Dashboard).
- Modul Stok Opname & Barang Masuk yang lebih detail (form input per-batch, riwayat `stock_movements`).
- Modul buka/tutup shift kasir dengan rekonsiliasi kas (`cashier_shifts`).
- Progressive Web App (PWA) agar bisa dipakai semi-offline di warung dengan koneksi tidak stabil.
