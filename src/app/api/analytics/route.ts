import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const db = getSupabaseAdmin();

  try {
    // === FILIAL-UEBERSICHT ===
    if (type === "location-summary") {
      const { data: transactions } = await db
        .from("transactions")
        .select("location_id, customer_id, amount_eur, type, created_at")
        .eq("type", "earn");

      const { data: locations } = await db.from("locations").select("*");

      const locationMap = new Map<string, {
        locationId: string;
        locationName: string;
        totalRevenue: number;
        transactionCount: number;
        uniqueCustomers: Set<string>;
        avgSpend: number;
      }>();

      // Init
      for (const loc of locations || []) {
        locationMap.set(loc.id, {
          locationId: loc.id,
          locationName: loc.name,
          totalRevenue: 0,
          transactionCount: 0,
          uniqueCustomers: new Set(),
          avgSpend: 0,
        });
      }

      // Aggregieren
      for (const tx of transactions || []) {
        if (!tx.location_id) continue;
        const loc = locationMap.get(tx.location_id);
        if (!loc) continue;
        loc.totalRevenue += Number(tx.amount_eur) || 0;
        loc.transactionCount++;
        if (tx.customer_id) loc.uniqueCustomers.add(tx.customer_id);
      }

      const result = Array.from(locationMap.values()).map((loc) => ({
        locationId: loc.locationId,
        locationName: loc.locationName,
        totalRevenue: Math.round(loc.totalRevenue * 100) / 100,
        transactionCount: loc.transactionCount,
        uniqueCustomers: loc.uniqueCustomers.size,
        avgSpend:
          loc.transactionCount > 0
            ? Math.round((loc.totalRevenue / loc.transactionCount) * 100) / 100
            : 0,
      }));

      return NextResponse.json({ locations: result });
    }

    // === KUNDEN-DETAIL ===
    if (type === "customer-detail") {
      const customerId = searchParams.get("customerId");
      if (!customerId) {
        return NextResponse.json({ error: "customerId erforderlich" }, { status: 400 });
      }

      const [customerRes, txRes, itemsRes] = await Promise.all([
        db.from("customers").select("*, locations:first_location_id(name)").eq("id", customerId).single(),
        db.from("transactions").select("*").eq("customer_id", customerId).eq("type", "earn").order("created_at", { ascending: true }),
        db.from("order_items")
          .select("item_name, quantity, transaction_id")
          .in(
            "transaction_id",
            (await db.from("transactions").select("id").eq("customer_id", customerId)).data?.map((t) => t.id) || []
          ),
      ]);

      const customer = customerRes.data;
      const transactions = txRes.data || [];
      const items = itemsRes.data || [];

      // Besuchsstatistiken
      const visitCount = transactions.length;
      const totalSpend = transactions.reduce((s, t) => s + (Number(t.amount_eur) || 0), 0);
      const avgSpend = visitCount > 0 ? Math.round((totalSpend / visitCount) * 100) / 100 : 0;
      const lastVisit = transactions.length > 0 ? transactions[transactions.length - 1].created_at : null;
      const firstVisit = transactions.length > 0 ? transactions[0].created_at : null;

      // Durchschnittliche Tage zwischen Besuchen
      let avgDaysBetweenVisits = 0;
      if (transactions.length > 1) {
        const first = new Date(transactions[0].created_at).getTime();
        const last = new Date(transactions[transactions.length - 1].created_at).getTime();
        avgDaysBetweenVisits = Math.round(
          (last - first) / (1000 * 60 * 60 * 24) / (transactions.length - 1)
        );
      }

      // Lieblingsgerichte (Top 5)
      const itemCounts = new Map<string, number>();
      for (const item of items) {
        const count = itemCounts.get(item.item_name) || 0;
        itemCounts.set(item.item_name, count + (item.quantity || 1));
      }
      const favoriteItems = Array.from(itemCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return NextResponse.json({
        customer,
        visitCount,
        totalSpend: Math.round(totalSpend * 100) / 100,
        avgSpend,
        lastVisit,
        firstVisit,
        avgDaysBetweenVisits,
        favoriteItems,
        firstLocationName: customer?.locations?.name || null,
      });
    }

    // === BELIEBTE GERICHTE ===
    if (type === "popular-items") {
      const locationId = searchParams.get("locationId");

      let txQuery = db.from("transactions").select("id").eq("type", "earn");
      if (locationId) txQuery = txQuery.eq("location_id", locationId);
      const { data: txIds } = await txQuery;

      if (!txIds || txIds.length === 0) {
        return NextResponse.json({ items: [] });
      }

      const { data: orderItems } = await db
        .from("order_items")
        .select("item_name, quantity, price")
        .in("transaction_id", txIds.map((t) => t.id));

      // Aggregieren
      const itemMap = new Map<string, { totalQty: number; totalRevenue: number; orderCount: number }>();
      for (const item of orderItems || []) {
        const existing = itemMap.get(item.item_name) || { totalQty: 0, totalRevenue: 0, orderCount: 0 };
        existing.totalQty += item.quantity || 1;
        existing.totalRevenue += (Number(item.price) || 0) * (item.quantity || 1);
        existing.orderCount++;
        itemMap.set(item.item_name, existing);
      }

      const result = Array.from(itemMap.entries())
        .map(([name, data]) => ({
          itemName: name,
          totalQuantity: data.totalQty,
          totalRevenue: Math.round(data.totalRevenue * 100) / 100,
          orderCount: data.orderCount,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 20);

      return NextResponse.json({ items: result });
    }

    // === ZEIT-ANALYSE ===
    if (type === "time-analysis") {
      const days = parseInt(searchParams.get("days") || "30");
      const locationId = searchParams.get("locationId");

      const since = new Date();
      since.setDate(since.getDate() - days);

      let query = db
        .from("transactions")
        .select("created_at, amount_eur")
        .eq("type", "earn")
        .gte("created_at", since.toISOString());

      if (locationId) query = query.eq("location_id", locationId);
      const { data: transactions } = await query;

      // Nach Wochentag
      const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
      const byDayOfWeek = dayNames.map((day) => ({ day, count: 0, revenue: 0 }));

      // Nach Stunde
      const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 }));

      // Taeglich
      const dailyMap = new Map<string, { count: number; revenue: number }>();

      for (const tx of transactions || []) {
        const d = new Date(tx.created_at);
        const rev = Number(tx.amount_eur) || 0;

        byDayOfWeek[d.getDay()].count++;
        byDayOfWeek[d.getDay()].revenue += rev;

        byHour[d.getHours()].count++;
        byHour[d.getHours()].revenue += rev;

        const dateKey = d.toISOString().split("T")[0];
        const daily = dailyMap.get(dateKey) || { count: 0, revenue: 0 };
        daily.count++;
        daily.revenue += rev;
        dailyMap.set(dateKey, daily);
      }

      const dailyTrend = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          revenue: Math.round(data.revenue * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({
        byDayOfWeek: byDayOfWeek.map((d) => ({
          ...d,
          revenue: Math.round(d.revenue * 100) / 100,
        })),
        byHour: byHour.map((h) => ({
          ...h,
          revenue: Math.round(h.revenue * 100) / 100,
        })),
        dailyTrend,
      });
    }

    return NextResponse.json({ error: "Unbekannter Analyse-Typ" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analyse-Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
