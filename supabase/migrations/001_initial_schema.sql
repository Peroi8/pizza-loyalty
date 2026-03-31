-- =============================================
-- PIZZA LOYALTY SYSTEM - Datenbank-Schema
-- Fuehre dieses SQL in deinem Supabase SQL-Editor aus
-- =============================================

-- Filialen
create table locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  created_at timestamptz default now()
);

-- Kunden
create table customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text unique,
  email text unique,
  birthday date,
  points_balance integer default 0 not null check (points_balance >= 0),
  total_points_earned integer default 0 not null,
  marketing_consent boolean default false,
  marketing_consent_at timestamptz,
  unsubscribed_at timestamptz,
  first_location_id uuid,
  created_at timestamptz default now()
);

-- Mitarbeiter
create table staff (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  pin text not null,
  location_id uuid references locations(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- Praemien
create table rewards (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  points_required integer not null check (points_required > 0),
  active boolean default true,
  created_at timestamptz default now()
);

-- Transaktionen (Punkte sammeln + einloesen)
create table transactions (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) not null,
  location_id uuid references locations(id),
  staff_id uuid references staff(id),
  type text not null check (type in ('earn', 'redeem')),
  amount_eur numeric(10,2),
  points integer not null,
  reward_id uuid references rewards(id),
  note text,
  created_at timestamptz default now()
);

-- Wallet-Passes
create table wallet_passes (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) not null unique,
  apple_serial text unique,
  apple_auth_token text,
  google_object_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indizes fuer Performance
create index idx_customers_phone on customers(phone);
create index idx_transactions_customer on transactions(customer_id);
create index idx_transactions_created on transactions(created_at);
create index idx_wallet_passes_apple on wallet_passes(apple_serial);

-- Beispiel-Daten: Filialen + Praemien
insert into locations (name, address) values
  ('Filiale Zentrum', 'Hauptstr. 1, 12345 Musterstadt'),
  ('Filiale Nord', 'Nordring 15, 12345 Musterstadt');

-- Keine Praemien konfiguriert - bei Bedarf hier eintragen:
-- insert into rewards (name, description, points_required) values
--   ('Beispiel', 'Beschreibung', 100);

insert into staff (name, pin, location_id) values
  ('Admin', '1234', (select id from locations limit 1));

-- RLS (Row Level Security) - Optional fuer Sicherheit
-- alter table customers enable row level security;
-- alter table transactions enable row level security;
