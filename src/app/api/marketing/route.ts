import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Flexibler Daten-Export mit waehlbaren Feldern
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";
  const fieldsParam = searchParams.get("fields") || "";
  const onlyConsented = searchParams.get("consented") !== "false"; // default: nur mit Einwilligung
  const db = getSupabaseAdmin();

  // Alle verfuegbaren Felder
  const allFields = [
    "name", "email", "phone", "birthday", "points_balance",
    "total_points_earned", "marketing_consent", "created_at",
    "first_location_id",
  ];

  // Welche Felder werden angefragt?
  const requestedFields = fieldsParam
    ? fieldsParam.split(",").filter((f) => allFields.includes(f))
    : allFields;

  // Immer mindestens id holen (intern)
  const selectFields = ["id", ...requestedFields].join(", ");

  let query = db.from("customers").select(selectFields);

  if (onlyConsented) {
    query = query.eq("marketing_consent", true).is("unsubscribed_at", null);
  }

  const { data: customers, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrichment: Lade zusaetzliche Daten wenn noetig
  const needsLocation = requestedFields.includes("first_location_id");
  const needsVisitCount = fieldsParam.includes("visit_count");
  const needsTotalSpend = fieldsParam.includes("total_spend");
  const needsLastVisit = fieldsParam.includes("last_visit");
  const needsFavorites = fieldsParam.includes("favorite_items");

  let locationMap: Record<string, string> = {};
  if (needsLocation) {
    const { data: locs } = await db.from("locations").select("id, name");
    locationMap = Object.fromEntries((locs || []).map((l) => [l.id, l.name]));
  }

  // Lade Transaktionsdaten wenn erweiterte Felder angefragt
  let customerStats: Record<string, { visitCount: number; totalSpend: number; lastVisit: string | null }> = {};
  if (needsVisitCount || needsTotalSpend || needsLastVisit) {
    const { data: txs } = await db
      .from("transactions")
      .select("customer_id, amount_eur, created_at")
      .eq("type", "earn");

    const statsMap: Record<string, { visitCount: number; totalSpend: number; lastVisit: string | null }> = {};
    for (const tx of txs || []) {
      if (!statsMap[tx.customer_id]) {
        statsMap[tx.customer_id] = { visitCount: 0, totalSpend: 0, lastVisit: null };
      }
      statsMap[tx.customer_id].visitCount++;
      statsMap[tx.customer_id].totalSpend += tx.amount_eur || 0;
      if (!statsMap[tx.customer_id].lastVisit || tx.created_at > statsMap[tx.customer_id].lastVisit!) {
        statsMap[tx.customer_id].lastVisit = tx.created_at;
      }
    }
    customerStats = statsMap;
  }

  // Lade Lieblingsgerichte
  let customerFavorites: Record<string, string> = {};
  if (needsFavorites) {
    const { data: items } = await db
      .from("order_items")
      .select("transaction_id, item_name, quantity");
    const { data: txs } = await db
      .from("transactions")
      .select("id, customer_id")
      .eq("type", "earn");

    const txCustomerMap = Object.fromEntries((txs || []).map((t) => [t.id, t.customer_id]));
    const favMap: Record<string, Record<string, number>> = {};

    for (const item of items || []) {
      const cid = txCustomerMap[item.transaction_id];
      if (!cid) continue;
      if (!favMap[cid]) favMap[cid] = {};
      favMap[cid][item.item_name] = (favMap[cid][item.item_name] || 0) + item.quantity;
    }

    for (const [cid, itemCounts] of Object.entries(favMap)) {
      const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      customerFavorites[cid] = sorted.map(([name, count]) => `${name} (${count}x)`).join("; ");
    }
  }

  // Baue Export-Daten
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportData = (customers || []).map((c: any) => {
    const row: Record<string, unknown> = {};

    if (requestedFields.includes("name")) row["Name"] = c.name || "";
    if (requestedFields.includes("email")) row["Email"] = c.email || "";
    if (requestedFields.includes("phone")) row["Telefon"] = c.phone || "";
    if (requestedFields.includes("birthday")) row["Geburtstag"] = c.birthday || "";
    if (requestedFields.includes("points_balance")) row["Punkte"] = c.points_balance || 0;
    if (requestedFields.includes("total_points_earned")) row["Gesamt_Punkte"] = c.total_points_earned || 0;
    if (requestedFields.includes("marketing_consent")) row["Newsletter"] = c.marketing_consent ? "Ja" : "Nein";
    if (requestedFields.includes("created_at")) row["Registriert"] = c.created_at ? new Date(c.created_at as string).toLocaleDateString("de-DE") : "";
    if (requestedFields.includes("first_location_id")) row["Erste_Filiale"] = locationMap[c.first_location_id as string] || "";

    // Erweiterte Felder aus Transaktionen
    const stats = customerStats[c.id as string];
    if (needsVisitCount) row["Besuche"] = stats?.visitCount || 0;
    if (needsTotalSpend) row["Gesamtausgaben_EUR"] = stats?.totalSpend?.toFixed(2) || "0.00";
    if (needsLastVisit) row["Letzter_Besuch"] = stats?.lastVisit ? new Date(stats.lastVisit).toLocaleDateString("de-DE") : "";
    if (needsFavorites) row["Lieblingsgerichte"] = customerFavorites[c.id as string] || "";

    return row;
  });

  // CSV-Export
  if (format === "csv") {
    if (exportData.length === 0) {
      return new NextResponse("Keine Daten", { status: 200 });
    }
    const headers = Object.keys(exportData[0]);
    const csvRows = exportData.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "");
        // Escape CSV-Werte mit Komma oder Anfuehrungszeichen
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");

    // BOM fuer Excel UTF-8
    const bom = "\uFEFF";
    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=kunden-export-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  }

  return NextResponse.json({
    totalCount: exportData.length,
    fields: Object.keys(exportData[0] || {}),
    data: exportData,
  });
}

// Abmeldung (Unsubscribe)
export async function POST(request: NextRequest) {
  try {
    const { email, action } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email erforderlich" }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    if (action === "unsubscribe") {
      await db
        .from("customers")
        .update({
          marketing_consent: false,
          unsubscribed_at: new Date().toISOString(),
        })
        .eq("email", email);

      return NextResponse.json({ success: true, message: "Erfolgreich abgemeldet" });
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
