-- =============================================
-- 006: Advanced Loyalty Features
-- Referrals, Promotions, Challenges, Feedback, Events
-- =============================================

-- === REFERRAL-SYSTEM ===
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by TEXT REFERENCES customers(id);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES customers(id),
  referred_id UUID NOT NULL REFERENCES customers(id),
  referrer_bonus INT NOT NULL DEFAULT 50,
  referred_bonus INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === PROMOTIONEN / AKTIONEN ===
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('multiplier', 'bonus_points', 'birthday')),
  multiplier NUMERIC DEFAULT 1,
  bonus_points INT DEFAULT 0,
  days_of_week JSONB DEFAULT '[]',  -- z.B. [1,2,3] fuer Mo-Mi (0=So, 1=Mo, ...)
  location_ids JSONB DEFAULT '[]',  -- leer = alle Filialen
  start_date DATE,
  end_date DATE,
  min_tier TEXT,   -- Mindest-Tier fuer die Aktion (optional)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === CHALLENGES ===
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('visit_all_locations', 'visit_count', 'spend_amount', 'item_count')),
  target INT NOT NULL DEFAULT 1,    -- z.B. 3 Filialen, 10 Besuche, 500 EUR
  reward_points INT NOT NULL DEFAULT 100,
  active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  progress JSONB DEFAULT '{}',   -- z.B. {"locations": ["id1","id2"], "count": 5}
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, challenge_id)
);

-- === FEEDBACK ===
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  transaction_id UUID REFERENCES transactions(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  bonus_points INT DEFAULT 5,
  location_id UUID REFERENCES locations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === VIP EVENTS ===
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location_id UUID REFERENCES locations(id),
  min_tier TEXT,         -- z.B. "Gold" - Mindest-Tier
  max_guests INT DEFAULT 20,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, customer_id)
);

-- === ZUSAETZLICHE SETTINGS ===
INSERT INTO app_settings (key, value) VALUES
  ('referral_bonus_points', '50'),
  ('feedback_bonus_points', '5'),
  ('points_expire_days', '365'),
  ('points_expire_warning_days', '30'),
  ('birthday_bonus_points', '50'),
  ('inactive_days_warning', '30')
ON CONFLICT (key) DO NOTHING;

-- === DEFAULT PROMOTION: Doppelte Punkte Mo-Mi ===
INSERT INTO promotions (name, description, type, multiplier, days_of_week, active)
VALUES (
  'Doppelte Punkte Mo-Mi',
  'Montag bis Mittwoch doppelte Punkte sammeln!',
  'multiplier',
  2,
  '[1, 2, 3]',
  false  -- Standardmaessig deaktiviert
);

-- === DEFAULT CHALLENGE: Alle Filialen besuchen ===
INSERT INTO challenges (name, description, type, target, reward_points, active)
VALUES (
  'Filial-Explorer',
  'Besuche alle Filialen und erhalte 100 Bonus-Punkte!',
  'visit_all_locations',
  2,  -- Anzahl Filialen (anpassen!)
  100,
  false  -- Standardmaessig deaktiviert
);
