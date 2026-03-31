-- =============================================
-- PIZZA LOYALTY SYSTEM - App Settings + Loyalty Tiers
-- Fuehre dieses SQL in deinem Supabase SQL-Editor aus (NACH 001-004)
-- =============================================

-- App-Einstellungen (Key-Value)
create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Default-Einstellungen
insert into app_settings (key, value) values
  ('primary_color', '#f5c61c'),
  ('secondary_color', '#1a1a1a'),
  ('accent_color', '#fdcf28'),
  ('program_name', 'Neapolitan Pizza Club'),
  ('pizzeria_name', 'Ciao Napoli'),
  ('welcome_text', 'Registriere dich fuer unseren Club und sammle bei jedem Einkauf Punkte!'),
  ('tagline', '1 EUR Umsatz = 1 Punkt'),
  ('wallet_bg_color', '#f5c61c'),
  ('wallet_text_color', '#1a1a1a'),
  ('points_per_euro', '1');

-- Loyalty Tiers
create table loyalty_tiers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  min_points integer not null default 0,
  color text not null default '#9ca3af',
  icon text not null default '🍕',
  benefits text,
  sort_order integer not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create index idx_tiers_sort on loyalty_tiers(sort_order);

-- Default Tiers
insert into loyalty_tiers (name, min_points, color, icon, benefits, sort_order) values
  ('Starter',  0,   '#9ca3af', '🍕', 'Willkommen im Club!', 0),
  ('Bronze',   100, '#cd7f32', '🥉', 'Du bist dabei!', 1),
  ('Silber',   300, '#c0c0c0', '🥈', 'Treuer Gast!', 2),
  ('Gold',     500, '#ffd700', '🥇', 'VIP Status!', 3);
