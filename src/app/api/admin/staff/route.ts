import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

function checkAuth(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== process.env.ADMIN_PASSWORD && auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  return null;
}

// Alle Mitarbeiter laden
export async function GET(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("staff")
    .select("id, name, pin, location_id, active, created_at, locations(name)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
}

// Neuen Mitarbeiter anlegen
export async function POST(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const body = await request.json();
  const { name, pin, location_id } = body;

  if (!name || !pin) {
    return NextResponse.json({ error: "Name und PIN sind erforderlich" }, { status: 400 });
  }

  if (pin.length < 4) {
    return NextResponse.json({ error: "PIN muss mindestens 4 Zeichen haben" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Pruefen ob PIN schon vergeben
  const { data: existing } = await db
    .from("staff")
    .select("id")
    .eq("pin", pin)
    .eq("active", true)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Diese PIN ist bereits vergeben" }, { status: 409 });
  }

  const { data, error } = await db
    .from("staff")
    .insert({
      name,
      pin,
      location_id: location_id || null,
      active: true,
    })
    .select("id, name, pin, location_id, active, created_at, locations(name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data }, { status: 201 });
}

// Mitarbeiter bearbeiten
export async function PUT(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const body = await request.json();
  const { id, name, pin, location_id, active } = body;

  if (!id) {
    return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Wenn PIN geaendert wird, pruefen ob sie schon vergeben ist
  if (pin) {
    const { data: existing } = await db
      .from("staff")
      .select("id")
      .eq("pin", pin)
      .eq("active", true)
      .neq("id", id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Diese PIN ist bereits vergeben" }, { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (pin !== undefined) updateData.pin = pin;
  if (location_id !== undefined) updateData.location_id = location_id || null;
  if (active !== undefined) updateData.active = active;

  const { data, error } = await db
    .from("staff")
    .update(updateData)
    .eq("id", id)
    .select("id, name, pin, location_id, active, created_at, locations(name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
}
