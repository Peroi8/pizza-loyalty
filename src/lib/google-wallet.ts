import { GoogleAuth } from "google-auth-library";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import { getSupabaseAdmin } from "./supabase";
import { loadSettings, loadTiers, getTierForPoints } from "./settings";

interface PassData {
  customerId: string;
  customerName: string;
  phone: string;
  pointsBalance: number;
  totalEarned: number;
}

function getCredentials() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_PATH nicht gesetzt");
  return JSON.parse(fs.readFileSync(keyPath, "utf-8"));
}

export async function createGoogleWalletClass(): Promise<void> {
  const credentials = getCredentials();
  const settings = await loadSettings();
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  const client = await auth.getClient();
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = `${issuerId}.${process.env.GOOGLE_WALLET_CLASS_ID || "loyalty-pizza"}`;

  const classPayload = {
    id: classId,
    issuerName: settings.pizzeria_name,
    programName: settings.program_name,
    programLogo: {
      sourceUri: { uri: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png` },
      contentDescription: { defaultValue: { language: "de", value: "Logo" } },
    },
    reviewStatus: "UNDER_REVIEW",
    countryCode: "DE",
    hexBackgroundColor: settings.wallet_bg_color,
  };

  try {
    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${classId}`,
      method: "GET",
    });
  } catch {
    await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",
      method: "POST",
      data: classPayload,
    });
  }
}

export async function generateGoogleWalletLink(data: PassData): Promise<string> {
  const credentials = getCredentials();
  const [settings, tiers] = await Promise.all([loadSettings(), loadTiers()]);
  const tier = getTierForPoints(data.totalEarned, tiers);

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = `${issuerId}.${process.env.GOOGLE_WALLET_CLASS_ID || "loyalty-pizza"}`;
  const objectId = `${issuerId}.${data.customerId.replace(/-/g, "")}`;

  const textModules = [
    {
      header: "So funktioniert es",
      body: `${settings.tagline}. Sammle Punkte bei jedem Einkauf!`,
    },
  ];

  if (tier) {
    textModules.push({
      header: "Dein Status",
      body: `${tier.icon} ${tier.name}${tier.benefits ? ` - ${tier.benefits}` : ""}`,
    });
  }

  if (tiers.length > 0) {
    textModules.push({
      header: "Stufen",
      body: tiers.map((t) => `${t.icon} ${t.name}: ab ${t.min_points} Punkte`).join("\n"),
    });
  }

  const objectPayload = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: data.phone || data.customerId,
    accountName: data.customerName,
    loyaltyPoints: {
      label: "Punkte",
      balance: { int: data.pointsBalance },
    },
    secondaryLoyaltyPoints: {
      label: "Gesamt gesammelt",
      balance: { int: data.totalEarned },
    },
    barcode: {
      type: "QR_CODE",
      value: `CIAO:${data.customerId}`,
    },
    textModulesData: textModules,
  };

  const token = jwt.sign(
    {
      iss: credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
      payload: { loyaltyObjects: [objectPayload] },
    },
    credentials.private_key,
    { algorithm: "RS256" }
  );

  const db = getSupabaseAdmin();
  await db.from("wallet_passes").upsert(
    { customer_id: data.customerId, google_object_id: objectId },
    { onConflict: "customer_id" }
  );

  return `https://pay.google.com/gp/v/save/${token}`;
}
