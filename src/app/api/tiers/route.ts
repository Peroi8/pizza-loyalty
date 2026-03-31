import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Alle Tiers laden
export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("loyalty_tiers")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiers: data });
}

// Neuen Tier erstellen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, min_points, color, icon, benefits, sort_order } = body;

    if (!name || min_points === undefined) {
      return NextResponse.json(
        { error: "Name und Mindestpunkte erforderlich" },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("loyalty_tiers")
      .insert({
        name,
        min_points: Number(min_points),
        color: color || "#9ca3af",
        icon: icon || "🍕",
        benefits: benefits || null,
        sort_order: sort_order ?? 0,
        active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tier: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// Tier aktualisieren oder loeschen
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Tier-ID erforderlich" }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    // Loeschen wenn action = delete
    if (updates.action === "delete") {
      const { error } = await db.from("loyalty_tiers").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Aktualisieren
    const { data, error } = await db
      .from("loyalty_tiers")
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.min_points !== undefined && {
          min_points: Number(updates.min_points),
        }),
        ...(updates.color !== undefined && { color: updates.color }),
        ...(updates.icon !== undefined && { icon: updates.icon }),
        ...(updates.benefits !== undefined && { benefits: updates.benefits }),
        ...(updates.sort_order !== undefined && {
          sort_order: Number(updates.sort_order),
        }),
        ...(updates.active !== undefined && { active: updates.active }),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tier: data });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
