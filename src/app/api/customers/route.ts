import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Kunde registrieren
export async function POST(request: NextRequest) {
  try {
    const { name, phone, email, birthday, marketingConsent } =
      await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name und E-Mail sind erforderlich" },
        { status: 400 }
      );
    }

    const cleanPhone = phone ? phone.replace(/\s/g, "") : null;
    const db = getSupabaseAdmin();

    // Pruefen ob Kunde schon existiert (per Email)
    const { data: existing } = await db
      .from("customers")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json({ customer: existing, isNew: false });
    }

    const { data: customer, error } = await db
      .from("customers")
      .insert({
        name,
        phone: cleanPhone,
        email: email.toLowerCase().trim(),
        birthday: birthday || null,
        marketing_consent: marketingConsent ?? false,
        marketing_consent_at: marketingConsent
          ? new Date().toISOString()
          : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer, isNew: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// Kunde suchen (per Telefon, Email oder alle auflisten)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");
  const search = searchParams.get("search");
  const db = getSupabaseAdmin();

  // Suche per Telefon
  if (phone) {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .eq("phone", phone.replace(/\s/g, ""))
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }
    return NextResponse.json({ customer: data });
  }

  // Suche per Email
  if (email) {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }
    return NextResponse.json({ customer: data });
  }

  // Freitext-Suche (Name, Email, Telefon oder ID via QR-Code)
  if (search) {
    const term = search.trim();

    // Pruefen ob es eine UUID ist (QR-Code Scan)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(term)) {
      const { data: byId } = await db
        .from("customers")
        .select("*")
        .eq("id", term)
        .single();
      if (byId) {
        return NextResponse.json({ customer: byId });
      }
    }

    const { data, error } = await db
      .from("customers")
      .select("*")
      .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }
    // Wenn genau 1 Treffer, direkt zurueckgeben
    if (data.length === 1) {
      return NextResponse.json({ customer: data[0] });
    }
    return NextResponse.json({ customers: data });
  }

  // Alle Kunden (fuer Admin)
  const { data, error } = await db
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ customers: data });
}
