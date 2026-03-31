import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("rewards")
    .select("*")
    .eq("active", true)
    .order("points_required", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rewards: data });
}
