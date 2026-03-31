import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Staff-Login per PIN
export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    if (!pin) {
      return NextResponse.json({ error: "PIN erforderlich" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: staff, error } = await db
      .from("staff")
      .select("id, name, location_id, locations(name)")
      .eq("pin", pin)
      .eq("active", true)
      .single();

    if (error || !staff) {
      return NextResponse.json({ error: "Ungueltige PIN" }, { status: 401 });
    }

    return NextResponse.json({ staff });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
