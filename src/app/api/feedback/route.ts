import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { submitFeedback } from "@/lib/points";

// Feedback abgeben
export async function POST(request: NextRequest) {
  try {
    const { customerId, rating, comment, transactionId, locationId } = await request.json();

    if (!customerId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "customerId und rating (1-5) erforderlich" }, { status: 400 });
    }

    const result = await submitFeedback(customerId, rating, comment, transactionId, locationId);

    if (!result.success) {
      return NextResponse.json({ error: "Bereits heute bewertet", alreadyRated: true }, { status: 200 });
    }

    return NextResponse.json({ success: true, bonusPoints: result.bonusPoints });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// Feedback-Liste fuer Admin
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const db = getSupabaseAdmin();

  let query = db
    .from("feedback")
    .select("*, customers(name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Durchschnittsbewertung
  const ratings = (data || []).map((f) => f.rating);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : "0";

  return NextResponse.json({
    feedback: data,
    avgRating: parseFloat(avgRating),
    totalFeedback: data?.length || 0,
  });
}
