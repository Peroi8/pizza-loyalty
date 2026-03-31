import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Alle Promotionen laden
export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promotions: data });
}

// Promotion erstellen oder bearbeiten
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getSupabaseAdmin();

    const { id, action, ...fields } = body;

    if (action === "delete" && id) {
      await db.from("promotions").delete().eq("id", id);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle" && id) {
      const { data: promo } = await db.from("promotions").select("active").eq("id", id).single();
      if (promo) {
        await db.from("promotions").update({ active: !promo.active }).eq("id", id);
      }
      return NextResponse.json({ success: true });
    }

    if (id) {
      // Update
      await db.from("promotions").update(fields).eq("id", id);
      return NextResponse.json({ success: true });
    }

    // Create
    const { data, error } = await db.from("promotions").insert(fields).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promotion: data });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
