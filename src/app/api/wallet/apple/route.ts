import { NextRequest, NextResponse } from "next/server";
import { generateApplePass } from "@/lib/apple-wallet";
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

    const passBuffer = await generateApplePass({
      customerId: customer.id,
      customerName: customer.name,
      pointsBalance: customer.points_balance,
      totalEarned: customer.total_points_earned,
    });

    return new NextResponse(new Uint8Array(passBuffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename=treuekarte.pkpass`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler bei der Pass-Generierung";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
