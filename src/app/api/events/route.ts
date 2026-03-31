import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Events laden
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const db = getSupabaseAdmin();

  const { data: events, error } = await db
    .from("events")
    .select("*, locations(name)")
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Einladungen laden
  for (const event of events || []) {
    const { data: invitations } = await db
      .from("event_invitations")
      .select("*, customers(name, email)")
      .eq("event_id", event.id);
    event.invitations = invitations || [];
    event.acceptedCount = invitations?.filter((i: { status: string }) => i.status === "accepted").length || 0;
  }

  // Wenn customerId, nur relevante Events
  if (customerId) {
    const filtered = (events || []).filter((e) =>
      e.invitations?.some((i: { customer_id: string }) => i.customer_id === customerId)
    );
    return NextResponse.json({ events: filtered });
  }

  return NextResponse.json({ events });
}

// Events erstellen/bearbeiten + Einladungen verwalten
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabaseAdmin();
    const { id, action, ...fields } = body;

    // Event loeschen
    if (action === "delete" && id) {
      await db.from("event_invitations").delete().eq("event_id", id);
      await db.from("events").delete().eq("id", id);
      return NextResponse.json({ success: true });
    }

    // Einladungen versenden
    if (action === "invite" && id) {
      const { customerIds } = body;
      if (!customerIds?.length) {
        return NextResponse.json({ error: "Keine Kunden ausgewaehlt" }, { status: 400 });
      }

      const rows = customerIds.map((cid: string) => ({
        event_id: id,
        customer_id: cid,
        status: "invited",
      }));

      await db.from("event_invitations").upsert(rows, { onConflict: "event_id,customer_id" });
      return NextResponse.json({ success: true, invited: customerIds.length });
    }

    // Auto-Invite: alle Kunden mit passendem Tier einladen
    if (action === "auto_invite" && id) {
      const { data: event } = await db.from("events").select("min_tier").eq("id", id).single();
      if (!event) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });

      // Alle Kunden laden
      const { data: customers } = await db.from("customers").select("id, total_points_earned");

      if (event.min_tier && customers) {
        const { loadTiers, getTierForPoints } = await import("@/lib/settings");
        const tiers = await loadTiers();
        const minTier = tiers.find((t) => t.name === event.min_tier);

        const eligible = customers.filter((c) => {
          const tier = getTierForPoints(c.total_points_earned, tiers);
          return tier && minTier && tier.min_points >= minTier.min_points;
        });

        const rows = eligible.map((c) => ({
          event_id: id,
          customer_id: c.id,
          status: "invited",
        }));

        if (rows.length > 0) {
          await db.from("event_invitations").upsert(rows, { onConflict: "event_id,customer_id" });
        }

        return NextResponse.json({ success: true, invited: rows.length });
      }

      return NextResponse.json({ success: true, invited: 0 });
    }

    // RSVP (Kunde antwortet)
    if (action === "rsvp") {
      const { eventId, customerId, status } = body;
      await db
        .from("event_invitations")
        .update({ status })
        .eq("event_id", eventId)
        .eq("customer_id", customerId);
      return NextResponse.json({ success: true });
    }

    // Event Update
    if (id) {
      await db.from("events").update(fields).eq("id", id);
      return NextResponse.json({ success: true });
    }

    // Event Create
    const { data, error } = await db.from("events").insert(fields).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
