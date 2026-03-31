import { NextRequest, NextResponse } from "next/server";
import { earnPoints, redeemPoints, saveOrderItems } from "@/lib/points";
import { getSupabaseAdmin } from "@/lib/supabase";

// Punkte vergeben oder einloesen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, type, amountEur, rewardId, staffId, locationId, items, receiptNumber } = body;

    if (!customerId || !type) {
      return NextResponse.json(
        { error: "customerId und type sind erforderlich" },
        { status: 400 }
      );
    }

    if (type === "earn") {
      if (!amountEur || amountEur <= 0) {
        return NextResponse.json(
          { error: "amountEur muss groesser als 0 sein" },
          { status: 400 }
        );
      }
      const result = await earnPoints(customerId, amountEur, staffId, locationId);
      const promoNames = result.promoNames || [];

      // Bestellte Gerichte speichern (wenn vorhanden)
      if (items && Array.isArray(items) && items.length > 0) {
        try {
          await saveOrderItems(result.transaction.id, items);
        } catch {
          // Items-Fehler soll Punkte nicht blockieren
        }
      }

      // Bonnummer speichern (wenn vorhanden)
      if (receiptNumber) {
        try {
          const db = getSupabaseAdmin();
          await db
            .from("transactions")
            .update({ receipt_number: receiptNumber })
            .eq("id", result.transaction.id);
        } catch {
          // Ignorieren
        }
      }

      return NextResponse.json({ ...result, promoNames });
    }

    if (type === "redeem") {
      if (!rewardId) {
        return NextResponse.json(
          { error: "rewardId ist erforderlich fuer Einloesung" },
          { status: 400 }
        );
      }
      const result = await redeemPoints(customerId, rewardId, staffId, locationId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Ungueltiger Typ" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Transaktionen eines Kunden abrufen
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const db = getSupabaseAdmin();

  if (!customerId) {
    // Letzte 100 Transaktionen (Admin)
    const { data, error } = await db
      .from("transactions")
      .select("*, customers(name, phone), locations(name), rewards(name), order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data });
  }

  const { data, error } = await db
    .from("transactions")
    .select("*, locations(name), rewards(name), order_items(*)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data });
}
