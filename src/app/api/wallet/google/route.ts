import { NextRequest, NextResponse } from "next/server";
import { generateGoogleWalletLink } from "@/lib/google-wallet";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId erforderlich" },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const { data: customer, error } = await db
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    const walletLink = await generateGoogleWalletLink({
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      pointsBalance: customer.points_balance,
      totalEarned: customer.total_points_earned,
    });

    return NextResponse.json({ walletLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler bei der Link-Generierung";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
