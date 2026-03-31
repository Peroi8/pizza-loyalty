import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Alle Challenges laden (optional mit Kunden-Fortschritt)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const db = getSupabaseAdmin();

  const { data: challenges, error } = await db
    .from("challenges")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (customerId) {
    // Fortschritt des Kunden laden
    const { data: progress } = await db
      .from("customer_challenges")
      .select("*")
      .eq("customer_id", customerId);

    const challengesWithProgress = (challenges || []).map((c) => {
      const p = progress?.find((p) => p.challenge_id === c.id);
      return { ...c, customerProgress: p || null };
    });

    return NextResponse.json({ challenges: challengesWithProgress });
  }

  return NextResponse.json({ challenges });
}

// Challenge erstellen/bearbeiten/loeschen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabaseAdmin();

    const { id, action, ...fields } = body;

    if (action === "delete" && id) {
      await db.from("customer_challenges").delete().eq("challenge_id", id);
      await db.from("challenges").delete().eq("id", id);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle" && id) {
      const { data: ch } = await db.from("challenges").select("active").eq("id", id).single();
      if (ch) {
        await db.from("challenges").update({ active: !ch.active }).eq("id", id);
      }
      return NextResponse.json({ success: true });
    }

    if (id) {
      await db.from("challenges").update(fields).eq("id", id);
      return NextResponse.json({ success: true });
    }

    const { data, error } = await db.from("challenges").insert(fields).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ challenge: data });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
