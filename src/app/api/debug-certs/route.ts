import { NextResponse } from "next/server";
import * as crypto from "crypto";

export async function GET() {
  try {
    const certB64 = process.env.APPLE_PASS_CERT_BASE64;
    const keyB64 = process.env.APPLE_PASS_KEY_BASE64;
    const wwdrB64 = process.env.APPLE_WWDR_CERT_BASE64;

    const results: Record<string, unknown> = {
      certSet: !!certB64,
      certLen: certB64?.length,
      keySet: !!keyB64,
      keyLen: keyB64?.length,
      wwdrSet: !!wwdrB64,
      wwdrLen: wwdrB64?.length,
    };

    if (certB64) {
      const certPem = Buffer.from(certB64, "base64").toString("utf-8");
      results.certStartsWith = certPem.substring(0, 30);
      results.certEndsWith = certPem.substring(certPem.length - 30);
      results.certPemLen = certPem.length;

      // Try to parse as X509
      try {
        const cert = new crypto.X509Certificate(certPem);
        results.certSubject = cert.subject;
        results.certValid = true;
      } catch (e) {
        results.certValid = false;
        results.certError = (e as Error).message;
      }
    }

    if (keyB64) {
      const keyPem = Buffer.from(keyB64, "base64").toString("utf-8");
      results.keyStartsWith = keyPem.substring(0, 30);
      results.keyPemLen = keyPem.length;

      try {
        const key = crypto.createPrivateKey(keyPem);
        results.keyType = key.type;
        results.keyValid = true;
      } catch (e) {
        results.keyValid = false;
        results.keyError = (e as Error).message;
      }
    }

    // Check if cert and key match
    if (certB64 && keyB64) {
      try {
        const certPem = Buffer.from(certB64, "base64").toString("utf-8");
        const keyPem = Buffer.from(keyB64, "base64").toString("utf-8");
        const cert = new crypto.X509Certificate(certPem);
        const key = crypto.createPrivateKey(keyPem);
        const pubFromCert = cert.publicKey;

        // Sign and verify to check match
        const testData = Buffer.from("test");
        const sig = crypto.sign("sha256", testData, key);
        const verified = crypto.verify("sha256", testData, pubFromCert, sig);
        results.certKeyMatch = verified;
      } catch (e) {
        results.certKeyMatchError = (e as Error).message;
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
