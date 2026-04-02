import { PKPass } from "passkit-generator";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { getSupabaseAdmin } from "./supabase";
import { loadSettings, loadTiers, getTierForPoints, hexToRgb } from "./settings";

interface PassData {
  customerId: string;
  customerName: string;
  pointsBalance: number;
  totalEarned: number;
}

function loadCert(envBase64: string | undefined, envPath: string | undefined, defaultPath: string): Buffer {
  if (envBase64) return Buffer.from(envBase64, "base64");
  return fs.readFileSync(envPath || defaultPath);
}

export async function generateApplePass(data: PassData): Promise<Buffer> {
  const certDirectory = path.resolve(process.cwd(), "certs");
  const [settings, tiers] = await Promise.all([loadSettings(), loadTiers()]);
  const tier = getTierForPoints(data.totalEarned, tiers);

  // Icon-Bilder laden (Apple verlangt mindestens icon.png)
  const publicDir = path.resolve(process.cwd(), "public");
  const passImages: Record<string, Buffer> = {};
  const imageFiles = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png", "strip.png", "strip@2x.png", "strip@3x.png"];
  for (const img of imageFiles) {
    try {
      passImages[img] = fs.readFileSync(path.join(publicDir, img));
    } catch {
      // Optional: Bild nicht vorhanden
    }
  }

  const pass = new PKPass(
    passImages,
    {
      signerCert: loadCert(process.env.APPLE_PASS_CERT_BASE64, process.env.APPLE_PASS_CERT_PATH, path.join(certDirectory, "signerCert.pem")),
      signerKey: loadCert(process.env.APPLE_PASS_KEY_BASE64, process.env.APPLE_PASS_KEY_PATH, path.join(certDirectory, "signerKey.pem")),
      wwdr: loadCert(process.env.APPLE_WWDR_CERT_BASE64, process.env.APPLE_WWDR_CERT_PATH, path.join(certDirectory, "WWDR.pem")),
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE,
    },
    {
      serialNumber: uuidv4(),
      description: settings.program_name,
      organizationName: settings.pizzeria_name,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      foregroundColor: hexToRgb(settings.wallet_text_color),
      backgroundColor: hexToRgb(settings.wallet_bg_color),
      labelColor: hexToRgb(settings.wallet_text_color),
    }
  );

  pass.type = "storeCard";

  pass.headerFields.push({
    key: "points",
    label: "PUNKTE",
    value: data.pointsBalance,
  });

  pass.primaryFields.push({
    key: "name",
    label: settings.program_name.toUpperCase(),
    value: data.customerName,
  });

  pass.secondaryFields.push(
    {
      key: "balance",
      label: "Aktueller Stand",
      value: `${data.pointsBalance} Punkte`,
    },
    {
      key: "tier",
      label: "Status",
      value: tier ? `${tier.icon} ${tier.name}` : "Starter",
    }
  );

  pass.auxiliaryFields.push({
    key: "total",
    label: "Gesamt gesammelt",
    value: `${data.totalEarned} Punkte`,
  });

  pass.backFields.push(
    {
      key: "info",
      label: "So funktioniert es",
      value: `Bei jedem Einkauf sammelst du Punkte! ${settings.tagline}. Zeige deine Karte beim Bezahlen vor.`,
    },
    {
      key: "club",
      label: settings.program_name,
      value: `by ${settings.pizzeria_name} - Sammle Punkte bei jedem Einkauf!`,
    }
  );

  // Tiers auf der Rueckseite anzeigen
  if (tiers.length > 0) {
    pass.backFields.push({
      key: "tiers",
      label: "Stufen",
      value: tiers
        .map((t) => `${t.icon} ${t.name}: ab ${t.min_points} Punkte`)
        .join("\n"),
    });
  }

  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: `CIAO:${data.customerId}`,
    messageEncoding: "iso-8859-1",
  });

  const db = getSupabaseAdmin();
  await db.from("wallet_passes").upsert(
    {
      customer_id: data.customerId,
      apple_serial: pass.props.serialNumber,
      apple_auth_token: uuidv4(),
    },
    { onConflict: "customer_id" }
  );

  return pass.getAsBuffer();
}
