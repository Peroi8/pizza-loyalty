-- =============================================
-- PIZZA LOYALTY SYSTEM - Erweiterung: Geburtsdatum + Telefon optional
-- Fuehre dieses SQL in deinem Supabase SQL-Editor aus (NACH 001-003)
-- =============================================

-- Geburtsdatum
alter table customers add column if not exists birthday date;

-- Telefon optional machen (unique constraint entfernen)
alter table customers alter column phone drop not null;

-- Email als unique setzen (neuer primaerer Identifier)
-- Erst pruefen ob es Duplikate gibt, dann Constraint setzen
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_email_key'
  ) then
    alter table customers add constraint customers_email_key unique (email);
  end if;
end $$;

-- Index fuer Geburtstags-Abfragen (z.B. "alle Kunden mit Geburtstag im Maerz")
create index if not exists idx_customers_birthday on customers(birthday);

-- Unique-Constraint auf Telefon anpassen (null erlauben)
-- Der bestehende unique index erlaubt bereits NULL-Werte in PostgreSQL
