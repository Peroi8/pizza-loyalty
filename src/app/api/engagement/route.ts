import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadSettings, loadTiers, getTierForPoints } from "@/lib/settings";

// Engagement-Dashboard: Inaktive Kunden, Geburtstage, Punkteverfall
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "overview";
  const db = getSupabaseAdmin();
  const settings = await loadSettings();

  // === INAKTIVE KUNDEN ===
  if (type === "inactive") {
    const inactiveDays = parseInt(settings.inactive_days_warning) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);

    // Alle Kunden mit letzter Transaktion
    const { data: customers } = await db
      .from("customers")
      .select("id, name, email, phone, points_balance, total_points_earned, created_at");

    const { data: txs } = await db
      .from("transactions")
      .select("customer_id, created_at")
      .eq("type", "earn")
      .order("created_at", { ascending: false });

    // Letzten Besuch pro Kunde
    const lastVisitMap: Record<string, string> = {};
    for (const tx of txs || []) {
      if (!lastVisitMap[tx.customer_id]) {
        lastVisitMap[tx.customer_id] = tx.created_at;
      }
    }

    const inactive = (customers || [])
      .filter((c) => {
        const lastVisit = lastVisitMap[c.id];
        if (!lastVisit) return true; // Nie besucht
        return new Date(lastVisit) < cutoff;
      })
      .map((c) => ({
        ...c,
        lastVisit: lastVisitMap[c.id] || null,
        daysSinceVisit: lastVisitMap[c.id]
          ? Math.floor((Date.now() - new Date(lastVisitMap[c.id]).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);

    return NextResponse.json({ inactive, inactiveDays });
  }

  // === GEBURTSTAGE ===
  if (type === "birthdays") {
    const daysAhead = parseInt(searchParams.get("days") || "30");
    const { data: customers } = await db
      .from("customers")
      .select("id, name, email, phone, birthday, points_balance")
      .not("birthday", "is", null);

    const now = new Date();
    const upcoming = (customers || [])
      .filter((c) => {
        if (!c.birthday) return false;
        const bday = new Date(c.birthday);
        const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
        // Wenn Geburtstag schon war, naechstes Jahr
        if (thisYearBday < now) thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
        const diffDays = Math.floor((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= daysAhead;
      })
      .map((c) => {
        const bday = new Date(c.birthday!);
        const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
        if (thisYearBday < now) thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
        const daysUntil = Math.floor((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...c, daysUntil, isToday: daysUntil === 0 };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ birthdays: upcoming, bonusPoints: parseInt(settings.birthday_bonus_points) || 50 });
  }

  // === PUNKTEVERFALL-WARNUNG ===
  if (type === "expiring") {
    const expireDays = parseInt(settings.points_expire_days) || 365;
    const warningDays = parseInt(settings.points_expire_warning_days) || 30;

    const { data: customers } = await db
      .from("customers")
      .select("id, name, email, phone, points_balance, total_points_earned");

    const { data: txs } = await db
      .from("transactions")
      .select("customer_id, created_at")
      .eq("type", "earn")
      .order("created_at", { ascending: false });

    const lastEarnMap: Record<string, string> = {};
    for (const tx of txs || []) {
      if (!lastEarnMap[tx.customer_id]) lastEarnMap[tx.customer_id] = tx.created_at;
    }

    const now = Date.now();
    const atRisk = (customers || [])
      .filter((c) => {
        if (c.points_balance <= 0) return false;
        const lastEarn = lastEarnMap[c.id];
        if (!lastEarn) return false;
        const daysSinceEarn = Math.floor((now - new Date(lastEarn).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceEarn >= (expireDays - warningDays);
      })
      .map((c) => {
        const lastEarn = lastEarnMap[c.id];
        const daysSinceEarn = Math.floor((now - new Date(lastEarn).getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilExpiry = expireDays - daysSinceEarn;
        return { ...c, lastEarn, daysSinceEarn, daysUntilExpiry };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return NextResponse.json({ atRisk, expireDays, warningDays });
  }

  // === OVERVIEW ===
  const tiers = await loadTiers();
  const { data: customers } = await db
    .from("customers")
    .select("id, total_points_earned, birthday, points_balance, created_at");

  const { data: txs } = await db
    .from("transactions")
    .select("customer_id, created_at")
    .eq("type", "earn")
    .order("created_at", { ascending: false });

  const lastVisitMap: Record<string, string> = {};
  for (const tx of txs || []) {
    if (!lastVisitMap[tx.customer_id]) lastVisitMap[tx.customer_id] = tx.created_at;
  }

  const now = new Date();
  const inactiveDays = parseInt(settings.inactive_days_warning) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  let inactiveCount = 0;
  let birthdayCount = 0;
  const tierDistribution: Record<string, number> = {};

  for (const c of customers || []) {
    // Inactive
    const lastVisit = lastVisitMap[c.id];
    if (!lastVisit || new Date(lastVisit) < cutoff) inactiveCount++;

    // Birthday this month
    if (c.birthday) {
      const bday = new Date(c.birthday);
      if (bday.getMonth() === now.getMonth()) birthdayCount++;
    }

    // Tier distribution
    const tier = getTierForPoints(c.total_points_earned, tiers);
    const tierName = tier?.name || "Kein Tier";
    tierDistribution[tierName] = (tierDistribution[tierName] || 0) + 1;
  }

  const { data: feedbackData } = await db.from("feedback").select("rating");
  const avgRating = feedbackData && feedbackData.length > 0
    ? (feedbackData.reduce((a, f) => a + f.rating, 0) / feedbackData.length).toFixed(1)
    : "0";

  const { data: referrals } = await db.from("referrals").select("id");
  const { data: activeChallenges } = await db.from("challenges").select("id").eq("active", true);
  const { data: activePromos } = await db.from("promotions").select("id").eq("active", true);

  return NextResponse.json({
    inactiveCount,
    birthdayCount,
    tierDistribution,
    avgRating: parseFloat(avgRating),
    totalFeedback: feedbackData?.length || 0,
    totalReferrals: referrals?.length || 0,
    activeChallenges: activeChallenges?.length || 0,
    activePromotions: activePromos?.length || 0,
  });
}
