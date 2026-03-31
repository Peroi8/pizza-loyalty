import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Wird nach jeder Punkte-Aenderung aufgerufen um Wallet-Passes zu aktualisieren
// Apple Wallet: Push-Notification an das Geraet (Pass wird automatisch aktualisiert)
// Google Wallet: Objekt wird ueber API aktualisiert
export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json();
    const db = getSupabaseAdmin();

    const { data: customer } = await db
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const { data: walletPass } = await db
      .from("wallet_passes")
      .select("*")
      .eq("customer_id", customerId)
      .single();

    if (!walletPass) {
      return NextResponse.json({ message: "Kein Wallet-Pass vorhanden" });
    }

    const results: { apple?: string; google?: string } = {};

    // Google Wallet Update
    if (walletPass.google_object_id) {
      try {
        const { GoogleAuth } = await import("google-auth-library");
        const fs = await import("fs");

        const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
        if (keyPath) {
          const credentials = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
          const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
          });

          const client = await auth.getClient();
          await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${walletPass.google_object_id}`,
            method: "PATCH",
            data: {
              loyaltyPoints: {
                label: "Punkte",
                balance: { int: customer.points_balance },
              },
              secondaryLoyaltyPoints: {
                label: "Gesamt gesammelt",
                balance: { int: customer.total_points_earned },
              },
            },
          });
          results.google = "updated";
        }
      } catch {
        results.google = "update_failed";
      }
    }

    // Apple Wallet: Der Pass wird beim naechsten Abruf durch das Geraet aktualisiert
    // (Apple ruft periodisch den webServiceURL ab)
    if (walletPass.apple_serial) {
      await db
        .from("wallet_passes")
        .update({ updated_at: new Date().toISOString() })
        .eq("customer_id", customerId);
      results.apple = "marked_for_update";
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
