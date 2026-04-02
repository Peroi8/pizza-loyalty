import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

function checkAuth(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== process.env.ADMIN_PASSWORD && auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  return null;
}

// Alle Standorte laden
export async function GET(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("locations")
    .select("id, name, address, created_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mitarbeiter-Anzahl pro Standort
  const { data: staffCounts } = await db
    .from("staff")
    .select("location_id")
    .eq("active", true);

  const countMap: Record<string, number> = {};
  (staffCounts || []).forEach((s) => {
    if (s.location_id) {
      countMap[s.location_id] = (countMap[s.location_id] || 0) + 1;
    }
  });

  const locations = (data || []).map((loc) => ({
    ...loc,
    staff_count: countMap[loc.id] || 0,
  }));

  return NextResponse.json({ locations });
}

// Neuen Standort anlegen
export async function POST(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const body = await request.json();
  const { name, address } = body;

  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("locations")
    .insert({ name, address: address || null })
    .select("id, name, address, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ location: data }, { status: 201 });
}

// Standort bearbeiten
export async function PUT(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const body = await request.json();
  const { id, name, address } = body;

  if (!id) {
    return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (address !== undefined) updateData.address = address || null;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("locations")
    .update(updateData)
    .eq("id", id)
    .select("id, name, address, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ location: data });
}

// Standort loeschen
export async function DELETE(request: NextRequest) {
  const err = checkAuth(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Pruefen ob noch Mitarbeiter zugeordnet sind
  const { data: staffAtLocation } = await db
    .from("staff")
    .select("id")
    .eq("location_id", id)
    .eq("active", true);

  if (staffAtLocation && staffAtLocation.length > 0) {
    return NextResponse.json(
      { error: `Standort hat noch ${staffAtLocation.length} aktive Mitarbeiter. Bitte erst Mitarbeiter umziehen oder deaktivieren.` },
      { status: 409 }
    );
  }

  const { error } = await db
    .from("locations")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
