import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { processReferral, generateReferralCode } from "@/lib/points";

// Referral-Code einloesen
export async function POST(request: NextRequest) {
  try {
    const { customerId, referralCode } = await request.json();

    if (!customerId || !referralCode) {
      return NextResponse.json({ error: "customerId und referralCode erforderlich" }, { status: 400 });
    }

    const result = await processReferral(customerId, referralCode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// Referral-Code generieren/abrufen
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const db = getSupabaseAdmin();

  if (!customerId) {
    // Admin: alle Referrals
    const { data } = await db
      .from("referrals")
      .select("*, referrer:referrer_id(name), referred:referred_id(name)")
      .order("created_at", { ascending: false });

    return NextResponse.json({ referrals: data });
  }

  // Kunden-Code laden oder generieren
  const { data: customer } = await db
    .from("customers")
    .select("id, name, referral_code")
    .eq("id", customerId)
    .single();

  if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  let code = customer.referral_code;
  if (!code) {
    code = generateReferralCode(customer.name);
    await db.from("customers").update({ referral_code: code }).eq("id", customerId);
  }

  // Anzahl erfolgreicher Empfehlungen
  const { data: referrals } = await db
    .from("referrals")
    .select("id, referred:referred_id(name), created_at")
    .eq("referrer_id", customerId);

  return NextResponse.json({
    referralCode: code,
    referralCount: referrals?.length || 0,
    referrals,
  });
}
