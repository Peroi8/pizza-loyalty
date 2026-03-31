import { createClient } from "@supabase/supabase-js";

// Client-side Supabase (mit anon key)
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server-side Supabase (mit service role key fuer Admin-Zugriff)
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Typen
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  points_balance: number;
  total_points_earned: number;
  first_location_id: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  unsubscribed_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  name: string;
  pin: string;
  location_id: string;
  active: boolean;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
}

export interface Transaction {
  id: string;
  customer_id: string;
  location_id: string | null;
  staff_id: string | null;
  type: "earn" | "redeem";
  amount_eur: number | null;
  points: number;
  reward_id: string | null;
  receipt_number: string | null;
  note: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  transaction_id: string;
  item_name: string;
  quantity: number;
  price: number | null;
  created_at: string;
}

export interface WalletPass {
  id: string;
  customer_id: string;
  apple_serial: string | null;
  apple_auth_token: string | null;
  google_object_id: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: "multiplier" | "bonus_points" | "birthday";
  multiplier: number;
  bonus_points: number;
  days_of_week: number[];
  location_ids: string[];
  start_date: string | null;
  end_date: string | null;
  min_tier: string | null;
  active: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  name: string;
  description: string | null;
  type: "visit_all_locations" | "visit_count" | "spend_amount" | "item_count";
  target: number;
  reward_points: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface CustomerChallenge {
  id: string;
  customer_id: string;
  challenge_id: string;
  progress: Record<string, unknown>;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  customer_id: string;
  transaction_id: string | null;
  rating: number;
  comment: string | null;
  bonus_points: number;
  location_id: string | null;
  created_at: string;
}

export interface VipEvent {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  location_id: string | null;
  min_tier: string | null;
  max_guests: number;
  active: boolean;
  created_at: string;
}

export interface EventInvitation {
  id: string;
  event_id: string;
  customer_id: string;
  status: "invited" | "accepted" | "declined";
  created_at: string;
}
