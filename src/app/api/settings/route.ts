import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadSettings, loadTiers } from "@/lib/settings";

// Settings + Tiers laden
export async function GET() {
  try {
    const [settings, tiers] = await Promise.all([loadSettings(), loadTiers()]);
    return NextResponse.json({ settings, tiers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Settings aktualisieren
export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json();
    const db = getSupabaseAdmin();

    for (const [key, value] of Object.entries(updates)) {
      await db
        .from("app_settings")
        .upsert(
          { key, value: String(value), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }

    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
