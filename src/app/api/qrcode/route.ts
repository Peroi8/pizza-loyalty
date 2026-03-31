import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

// QR-Code als PNG generieren
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json({ error: "customerId erforderlich" }, { status: 400 });
  }

  // Encode: CIAO:{customerId} damit der Scanner weiss es ist ein Loyalty-QR
  const qrData = `CIAO:${customerId}`;

  try {
    const pngBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: 300,
      margin: 2,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "QR-Code Fehler" }, { status: 500 });
  }
}
