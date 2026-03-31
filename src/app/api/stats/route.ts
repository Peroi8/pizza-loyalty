import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = getSupabaseAdmin();

  const [customersRes, transactionsRes, locationsRes, rewardsRes] =
    await Promise.all([
      db.from("customers").select("id, points_balance, total_points_earned"),
      db
        .from("transactions")
        .select("type, points, amount_eur, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      db.from("locations").select("*"),
      db.from("rewards").select("*").eq("active", true),
    ]);

  const customers = customersRes.data || [];
  const transactions = transactionsRes.data || [];

  const totalCustomers = customers.length;
  const totalPointsIssued = customers.reduce(
    (sum, c) => sum + (c.total_points_earned || 0),
    0
  );
  const totalRevenue = transactions
    .filter((t) => t.type === "earn" && t.amount_eur)
    .reduce((sum, t) => sum + Number(t.amount_eur), 0);
  const totalRedemptions = transactions.filter((t) => t.type === "redeem").length;

  // Letzte 7 Tage
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentTransactions = transactions.filter(
    (t) => new Date(t.created_at) >= sevenDaysAgo
  );

  return NextResponse.json({
    totalCustomers,
    totalPointsIssued,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalRedemptions,
    recentTransactions: recentTransactions.length,
    locations: locationsRes.data || [],
    rewards: rewardsRes.data || [],
  });
}
