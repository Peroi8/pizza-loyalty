-- =============================================
-- PIZZA LOYALTY SYSTEM - Erweiterung: E-Mail Marketing
-- Fuehre dieses SQL in deinem Supabase SQL-Editor aus (NACH 001 + 002)
-- =============================================

-- Marketing-Einwilligung auf Kunden-Tabelle
alter table customers add column if not exists marketing_consent boolean default false;
alter table customers add column if not exists marketing_consent_at timestamptz;
alter table customers add column if not exists unsubscribed_at timestamptz;

-- Index fuer Marketing-Abfragen (alle Kunden mit Einwilligung + Email)
create index if not exists idx_customers_marketing
  on customers(marketing_consent) where marketing_consent = true and email is not null;
