// App-Einstellungen: werden aus Supabase geladen und gecached

export interface AppSettings {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  program_name: string;
  pizzeria_name: string;
  welcome_text: string;
  tagline: string;
  wallet_bg_color: string;
  wallet_text_color: string;
  points_per_euro: string;
  referral_bonus_points: string;
  feedback_bonus_points: string;
  points_expire_days: string;
  points_expire_warning_days: string;
  birthday_bonus_points: string;
  inactive_days_warning: string;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  color: string;
  icon: string;
  benefits: string | null;
  sort_order: number;
  active: boolean;
}

// Defaults (werden verwendet wenn DB nicht erreichbar)
export const DEFAULT_SETTINGS: AppSettings = {
  primary_color: "#f5c61c",
  secondary_color: "#1a1a1a",
  accent_color: "#fdcf28",
  program_name: "Neapolitan Pizza Club",
  pizzeria_name: "Ciao Napoli",
  welcome_text:
    "Registriere dich fuer unseren Club und sammle bei jedem Einkauf Punkte!",
  tagline: "1 EUR Umsatz = 1 Punkt",
  wallet_bg_color: "#f5c61c",
  wallet_text_color: "#1a1a1a",
  points_per_euro: "1",
  referral_bonus_points: "50",
  feedback_bonus_points: "5",
  points_expire_days: "365",
  points_expire_warning_days: "30",
  birthday_bonus_points: "50",
  inactive_days_warning: "30",
};

// Server-seitig: Settings aus Supabase laden
export async function loadSettings(): Promise<AppSettings> {
  try {
    const { getSupabaseAdmin } = await import("./supabase");
    const db = getSupabaseAdmin();
    const { data } = await db.from("app_settings").select("key, value");

    if (!data || data.length === 0) return DEFAULT_SETTINGS;

    const settings = { ...DEFAULT_SETTINGS };
    for (const row of data) {
      if (row.key in settings) {
        (settings as Record<string, string>)[row.key] = row.value;
      }
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Server-seitig: Tiers laden
export async function loadTiers(): Promise<LoyaltyTier[]> {
  try {
    const { getSupabaseAdmin } = await import("./supabase");
    const db = getSupabaseAdmin();
    const { data } = await db
      .from("loyalty_tiers")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    return data || [];
  } catch {
    return [];
  }
}

// Tier fuer einen bestimmten Punktestand berechnen
export function getTierForPoints(
  totalPoints: number,
  tiers: LoyaltyTier[]
): LoyaltyTier | null {
  if (tiers.length === 0) return null;

  // Sortiert nach min_points absteigend, den hoechsten passenden finden
  const sorted = [...tiers].sort((a, b) => b.min_points - a.min_points);
  return sorted.find((t) => totalPoints >= t.min_points) || sorted[sorted.length - 1];
}

// Naechsten Tier berechnen
export function getNextTier(
  totalPoints: number,
  tiers: LoyaltyTier[]
): { tier: LoyaltyTier; pointsNeeded: number } | null {
  const sorted = [...tiers].sort((a, b) => a.min_points - b.min_points);
  const next = sorted.find((t) => t.min_points > totalPoints);
  if (!next) return null;
  return { tier: next, pointsNeeded: next.min_points - totalPoints };
}

// Hex zu RGB konvertieren (fuer Apple Wallet)
export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
