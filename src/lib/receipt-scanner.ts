import Anthropic from "@anthropic-ai/sdk";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  items: ReceiptItem[];
  total: number;
  date?: string;
  receiptNumber?: string;
  confidence: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `Du bist ein Kassenzettel-Parser fuer eine deutsche Pizzeria.
Analysiere das Bild eines Kassenzettels und extrahiere:
1. Alle bestellten Gerichte/Artikel mit Name, Menge und Einzelpreis
2. Den Gesamtbetrag (Summe/Total/Gesamtbetrag)
3. Das Datum (falls lesbar)
4. Die Bonnummer (falls vorhanden)

WICHTIG:
- Preise sind in EUR
- Ignoriere MwSt-Zeilen, Zahlungsart und andere Nicht-Artikel-Zeilen
- Bei "2x Pizza Margherita 18,00" ist quantity=2, price=9.00 (Einzelpreis!)
- Falls ein Preis nicht klar zuzuordnen ist, schaetze basierend auf ueblichen Pizzeria-Preisen
- Antworte NUR mit validem JSON, kein anderer Text

Antwortformat:
{
  "items": [{"name": "Pizza Margherita", "quantity": 1, "price": 9.50}],
  "total": 25.80,
  "date": "2024-03-15",
  "receiptNumber": "BON-1234"
}`;

export async function parseReceipt(imageBase64: string): Promise<ReceiptData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY nicht gesetzt. Bitte in .env.local eintragen."
    );
  }

  const client = new Anthropic({ apiKey });

  // Bestimme den Medientyp
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
    "image/jpeg";
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (match) {
      mediaType = match[1] as typeof mediaType;
      imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    }
  }

  const response = await client.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
  });

  // Antwort parsen
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von der AI erhalten");
  }

  let parsed: {
    items: ReceiptItem[];
    total: number;
    date?: string;
    receiptNumber?: string;
  };

  try {
    // JSON aus der Antwort extrahieren (auch wenn Text drumherum ist)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kein JSON gefunden");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      "Kassenzettel konnte nicht gelesen werden. Bitte manuell eingeben."
    );
  }

  // Validierung
  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Keine Artikel auf dem Kassenzettel erkannt.");
  }

  if (!parsed.total || parsed.total <= 0) {
    // Versuche Total aus Items zu berechnen
    parsed.total = parsed.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  // Items bereinigen
  const cleanItems: ReceiptItem[] = parsed.items.map((item) => ({
    name: String(item.name || "Unbekannt").trim(),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    price: Math.round((Number(item.price) || 0) * 100) / 100,
  }));

  // Confidence bestimmen
  const itemsTotal = cleanItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const diff = Math.abs(itemsTotal - parsed.total);
  let confidence: "high" | "medium" | "low" = "high";
  if (diff > 1.0) confidence = "medium";
  if (diff > 5.0) confidence = "low";

  return {
    items: cleanItems,
    total: Math.round(parsed.total * 100) / 100,
    date: parsed.date || undefined,
    receiptNumber: parsed.receiptNumber || undefined,
    confidence,
  };
}
