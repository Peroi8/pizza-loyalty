-- =============================================
-- PIZZA LOYALTY SYSTEM - Erweiterung: Bestellungen + Analytics
-- Fuehre dieses SQL in deinem Supabase SQL-Editor aus (NACH 001)
-- =============================================

-- Bestellte Gerichte pro Transaktion
create table order_items (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references transactions(id) on delete cascade not null,
  item_name text not null,
  quantity integer default 1,
  price numeric(10,2),
  created_at timestamptz default now()
);

create index idx_order_items_transaction on order_items(transaction_id);
create index idx_order_items_name on order_items(item_name);

-- Erste Filiale des Kunden (wo wurde er zuerst gesehen)
alter table customers add column if not exists first_location_id uuid references locations(id);

-- Bonnummer auf Transaktionen
alter table transactions add column if not exists receipt_number text;

-- Bestehende Kunden: first_location aus aeltester Transaktion befuellen
update customers
set first_location_id = sub.location_id
from (
  select distinct on (customer_id) customer_id, location_id
  from transactions
  where location_id is not null
  order by customer_id, created_at asc
) sub
where customers.id = sub.customer_id
  and customers.first_location_id is null;
