-- =========================================================
-- POS TOKO SEMBAKO - SUPABASE SCHEMA (PostgreSQL)
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New Query)
-- =========================================================

-- Extension untuk UUID
create extension if not exists "uuid-ossp";

-- =========================================================
-- 1. STORES (Multi-tenant: 1 baris = 1 toko/profil)
-- =========================================================
create table stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Toko Sembako',
  address text,
  phone_whatsapp text,
  logo_url text,
  receipt_note text default 'Terima kasih telah berbelanja!',
  receipt_paper_size text default '80mm' check (receipt_paper_size in ('58mm','80mm')),
  wholesale_min_qty integer default 10, -- syarat minimal qty utk harga grosir (default toko)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- 2. USERS (Profil tambahan, terhubung ke auth.users Supabase)
-- =========================================================
create type user_role as enum ('admin', 'kepala_toko', 'kasir');

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'kasir',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =========================================================
-- 3. CATEGORIES
-- =========================================================
create table categories (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- =========================================================
-- 4. PRODUCTS (Dual-tier pricing: Eceran & Grosir)
-- =========================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  sku text,
  barcode text,
  name text not null,
  unit text default 'pcs', -- pcs, kg, liter, dus, dll
  cost_price numeric(14,2) default 0,      -- harga modal (utk hitung margin)
  retail_price numeric(14,2) not null,     -- harga eceran
  wholesale_price numeric(14,2),           -- harga grosir
  wholesale_min_qty integer,               -- override syarat qty per produk (opsional, kalau null pakai default toko)
  stock_qty numeric(14,2) default 0,
  min_stock_alert numeric(14,2) default 5,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (store_id, sku)
);
create index idx_products_barcode on products(barcode);
create index idx_products_store on products(store_id);

-- =========================================================
-- 5. STOCK MOVEMENTS (barang masuk / stok opname / adjustment)
-- =========================================================
create type stock_movement_type as enum ('in', 'out', 'adjustment', 'opname');

create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  type stock_movement_type not null,
  qty numeric(14,2) not null,
  note text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- =========================================================
-- 6. TRANSACTIONS (Header struk)
-- =========================================================
create type payment_method as enum ('tunai', 'qris', 'transfer');
create type transaction_status as enum ('completed', 'void', 'refunded');

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  invoice_number text not null,
  cashier_id uuid references users(id),
  shift_id uuid, -- referensi ke cashier_shifts
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  change_amount numeric(14,2) not null default 0,
  payment_method payment_method not null default 'tunai',
  status transaction_status not null default 'completed',
  created_at timestamptz default now(),
  unique (store_id, invoice_number)
);
create index idx_transactions_store_date on transactions(store_id, created_at);

-- =========================================================
-- 7. TRANSACTION ITEMS (Detail per item, simpan snapshot harga & tier)
-- =========================================================
create type price_tier as enum ('eceran', 'grosir');

create table transaction_items (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) on delete cascade,
  product_id uuid references products(id),
  product_name_snapshot text not null, -- snapshot nama produk saat transaksi
  qty numeric(14,2) not null,
  unit_price numeric(14,2) not null,   -- harga yg dipakai (eceran/grosir) saat itu
  price_tier price_tier not null default 'eceran',
  cost_price_snapshot numeric(14,2) default 0, -- utk hitung margin laporan
  line_total numeric(14,2) not null,
  created_at timestamptz default now()
);
create index idx_txitems_transaction on transaction_items(transaction_id);

-- =========================================================
-- 8. CASHIER SHIFTS (buka/tutup shift kasir)
-- =========================================================
create table cashier_shifts (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  cashier_id uuid references users(id),
  starting_cash numeric(14,2) default 0,
  ending_cash numeric(14,2),
  opened_at timestamptz default now(),
  closed_at timestamptz,
  notes text
);

-- =========================================================
-- 9. AUDIT LOG (khusus Admin)
-- =========================================================
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  user_id uuid references users(id),
  action text not null,       -- e.g. 'UPDATE_PRICE', 'DELETE_PRODUCT'
  entity text,                -- e.g. 'products'
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- =========================================================
-- ROW LEVEL SECURITY (RLS) - Multi-tenant isolation
-- =========================================================
alter table stores enable row level security;
alter table users enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table cashier_shifts enable row level security;
alter table audit_logs enable row level security;

-- Helper function: ambil store_id milik user yang sedang login
create or replace function auth_store_id()
returns uuid
language sql stable
as $$
  select store_id from users where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql stable
as $$
  select role from users where id = auth.uid();
$$;

-- Policy generik: user hanya boleh akses data milik store-nya sendiri
create policy "store_isolation_select" on products for select using (store_id = auth_store_id());
create policy "store_isolation_all" on products for all using (store_id = auth_store_id());

create policy "categories_isolation" on categories for all using (store_id = auth_store_id());
create policy "stock_isolation" on stock_movements for all using (store_id = auth_store_id());
create policy "tx_isolation" on transactions for all using (store_id = auth_store_id());
create policy "shift_isolation" on cashier_shifts for all using (store_id = auth_store_id());

create policy "txitems_isolation" on transaction_items for all using (
  transaction_id in (select id from transactions where store_id = auth_store_id())
);

create policy "users_self_store" on users for select using (store_id = auth_store_id());
create policy "users_admin_manage" on users for all using (
  store_id = auth_store_id() and auth_role() = 'admin'
);

create policy "stores_own_row" on stores for all using (id = auth_store_id());

-- Audit log: hanya admin yang boleh baca
create policy "audit_admin_only" on audit_logs for select using (
  store_id = auth_store_id() and auth_role() = 'admin'
);
create policy "audit_insert_any" on audit_logs for insert with check (store_id = auth_store_id());

-- =========================================================
-- TRIGGER: auto-generate invoice number per toko (format INV-YYYYMMDD-0001)
-- =========================================================
create or replace function generate_invoice_number()
returns trigger as $$
declare
  today_prefix text := 'INV-' || to_char(now(), 'YYYYMMDD') || '-';
  next_seq int;
begin
  if new.invoice_number is null or new.invoice_number = '' then
    select coalesce(max(cast(substring(invoice_number from length(today_prefix)+1) as int)), 0) + 1
    into next_seq
    from transactions
    where store_id = new.store_id and invoice_number like today_prefix || '%';

    new.invoice_number := today_prefix || lpad(next_seq::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_invoice
before insert on transactions
for each row execute function generate_invoice_number();

-- =========================================================
-- TRIGGER: auto-kurangi stok saat transaction_items ditambahkan
-- =========================================================
create or replace function deduct_stock_on_sale()
returns trigger as $$
begin
  update products
  set stock_qty = stock_qty - new.qty,
      updated_at = now()
  where id = new.product_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_deduct_stock
after insert on transaction_items
for each row execute function deduct_stock_on_sale();

-- =========================================================
-- SEED CONTOH (opsional - hapus jika tidak perlu)
-- =========================================================
-- insert into stores (name, address, phone_whatsapp) values
--   ('Toko Sembako Berkah', 'Jl. Merdeka No. 1', '081234567890');
