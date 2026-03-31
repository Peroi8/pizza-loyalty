import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/receipt-scanner";

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Bild (Base64) erforderlich" },
        { status: 400 }
      );
    }

    // Max ~10MB Base64 (ca. 7.5MB Bild)
    if (image.length > 13_000_000) {
      return NextResponse.json(
        { error: "Bild zu gross. Bitte kleineres Foto verwenden." },
        { status: 400 }
      );
    }

    const receiptData = await parseReceipt(image);
    return NextResponse.json(receiptData);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Fehler beim Lesen des Kassenzettels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
