"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { AppSettings, LoyaltyTier } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState(refCode);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { if (d.settings) setS(d.settings); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          birthday: birthday || null,
          phone: phone || null,
          marketingConsent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fehler bei der Registrierung");
        return;
      }
      // Referral-Code einloesen falls vorhanden
      if (referralCode && data.isNew) {
        try {
          await fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: data.customer.id, referralCode }),
          });
        } catch {}
      }

      router.push(`/wallet?id=${data.customer.id}&new=${data.isNew}`);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${s.primary_color}, ${s.accent_color}, ${s.primary_color})`,
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🍕</div>
          <h1 className="text-2xl font-bold text-gray-900">{s.program_name}</h1>
          <p className="text-sm text-gray-400 mb-1">by {s.pizzeria_name}</p>
          <p className="text-gray-600 mt-2">{s.welcome_text}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Dein Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Mustermann"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@beispiel.de"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">
              Geburtsdatum
            </label>
            <input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Handynummer <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 170 1234567"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
            />
          </div>

          <div>
            <label htmlFor="referral" className="block text-sm font-medium text-gray-700 mb-1">
              Empfehlungscode <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="referral"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="z.B. MAXI4K2P"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 uppercase"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
            />
            {referralCode && (
              <p className="text-xs text-green-600 mt-1">Bonus-Punkte fuer dich und deinen Freund!</p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 h-4 w-4"
              style={{ accentColor: s.primary_color }}
            />
            <span className="text-xs text-gray-500">
              Ich moechte exklusive Angebote und Neuigkeiten per E-Mail
              erhalten. Abmeldung jederzeit moeglich.
            </span>
          </label>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: s.secondary_color }}
          >
            {loading ? "Wird registriert..." : "Jetzt registrieren"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">{s.tagline}</p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><div className="text-xl">Laden...</div></main>}>
      <RegisterContent />
    </Suspense>
  );
}
