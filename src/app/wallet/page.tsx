"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import type { AppSettings, LoyaltyTier } from "@/lib/settings";
import { DEFAULT_SETTINGS, getTierForPoints, getNextTier } from "@/lib/settings";

interface Customer {
  id: string;
  name: string;
  phone: string;
  points_balance: number;
  total_points_earned: number;
}

interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  type: string;
  target: number;
  reward_points: number;
  active: boolean;
  customerProgress: {
    progress: Record<string, unknown>;
    completed: boolean;
  } | null;
}

function WalletContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("id");
  const isNew = searchParams.get("new") === "true";

  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [googleLink, setGoogleLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState("");

  // Referral
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Feedback
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  // Challenges
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);

  // Events
  const [events, setEvents] = useState<{ id: string; name: string; description: string; event_date: string; invitations: { status: string; customer_id: string }[] }[]>([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setS(d.settings);
        if (d.tiers) setTiers(d.tiers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!customerId) return;

    async function loadData() {
      try {
        const customerRes = await fetch(`/api/customers?phone=`);
        const allData = await customerRes.json();
        const found = allData.customers?.find(
          (c: Customer) => c.id === customerId
        );
        if (found) setCustomer(found);
      } catch {}

      try {
        const googleRes = await fetch(
          `/api/wallet/google?customerId=${customerId}`
        );
        if (googleRes.ok) {
          const data = await googleRes.json();
          setGoogleLink(data.walletLink);
        }
      } catch {}

      // Referral-Code laden
      try {
        const refRes = await fetch(`/api/referral?customerId=${customerId}`);
        if (refRes.ok) {
          const data = await refRes.json();
          setReferralCode(data.referralCode || "");
          setReferralCount(data.referralCount || 0);
        }
      } catch {}

      // Challenges laden
      try {
        const chRes = await fetch(`/api/challenges?customerId=${customerId}`);
        if (chRes.ok) {
          const data = await chRes.json();
          setChallenges((data.challenges || []).filter((c: ChallengeWithProgress) => c.active));
        }
      } catch {}

      // Events laden
      try {
        const evRes = await fetch(`/api/events?customerId=${customerId}`);
        if (evRes.ok) {
          const data = await evRes.json();
          setEvents(data.events || []);
        }
      } catch {}

      setLoading(false);
    }

    loadData();
  }, [customerId]);

  async function handleFeedback() {
    if (!customerId || feedbackRating === 0) return;
    setFeedbackError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          rating: feedbackRating,
          comment: feedbackComment || undefined,
        }),
      });
      const data = await res.json();
      if (data.alreadyRated) {
        setFeedbackError("Du hast heute bereits bewertet.");
      } else if (data.success) {
        setFeedbackSent(true);
        if (customer && data.bonusPoints) {
          setCustomer({ ...customer, points_balance: customer.points_balance + data.bonusPoints });
        }
      }
    } catch {
      setFeedbackError("Fehler beim Senden.");
    }
  }

  async function handleRsvp(eventId: string, status: "accepted" | "declined") {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rsvp", eventId, customerId, status }),
    });
    // Reload events
    const evRes = await fetch(`/api/events?customerId=${customerId}`);
    if (evRes.ok) {
      const data = await evRes.json();
      setEvents(data.events || []);
    }
  }

  function copyReferralLink() {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const currentTier = customer
    ? getTierForPoints(customer.total_points_earned, tiers)
    : null;
  const nextTier = customer
    ? getNextTier(customer.total_points_earned, tiers)
    : null;

  if (!customerId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-600">Keine Kunden-ID angegeben.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: `linear-gradient(135deg, ${s.primary_color}, ${s.accent_color}, ${s.primary_color})` }}
      >
        <div className="text-xl" style={{ color: s.secondary_color }}>Laden...</div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${s.primary_color}, ${s.accent_color}, ${s.primary_color})` }}
    >
      <div className="w-full max-w-md space-y-4">
        {/* Hauptkarte */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isNew && (
            <div className="bg-yellow-50 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-center">
              Willkommen im {s.program_name}! Du bist jetzt registriert.
            </div>
          )}

          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🍕</div>
            <h1 className="text-2xl font-bold text-gray-900">{s.program_name}</h1>
            <p className="text-sm text-gray-400">by {s.pizzeria_name}</p>
            {customer && (
              <p className="text-gray-600 mt-1">Hallo, {customer.name}!</p>
            )}
          </div>

          {/* Punktestand */}
          <div
            className="rounded-xl p-6 text-center mb-4"
            style={{ background: `linear-gradient(135deg, ${s.primary_color}, ${s.accent_color})`, color: s.wallet_text_color }}
          >
            <p className="text-sm opacity-70">Dein Punktestand</p>
            <p className="text-5xl font-bold my-2">
              {customer?.points_balance || 0}
            </p>
            <p className="text-sm opacity-70">Punkte</p>
          </div>

          {/* Tier-Anzeige */}
          {currentTier && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">{currentTier.icon}</span>
                <span className="font-bold text-lg" style={{ color: currentTier.color }}>
                  {currentTier.name}
                </span>
              </div>
              {nextTier && (
                <div className="text-center">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          ((customer?.total_points_earned || 0) / nextTier.tier.min_points) * 100,
                          100
                        )}%`,
                        backgroundColor: nextTier.tier.color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Noch {nextTier.pointsNeeded} Punkte bis{" "}
                    <span style={{ color: nextTier.tier.color }}>{nextTier.tier.icon} {nextTier.tier.name}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* QR-Code zum Scannen */}
          {customerId && (
            <div className="mb-6 text-center">
              <p className="text-xs text-gray-400 mb-2">Zeig diesen Code beim Bezahlen</p>
              <div className="inline-block bg-white rounded-xl p-3 shadow-inner border">
                <img
                  src={`/api/qrcode?customerId=${customerId}`}
                  alt="Dein QR-Code"
                  width={180}
                  height={180}
                  className="mx-auto"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">Mitarbeiter scannt &rarr; Punkte werden gebucht</p>
            </div>
          )}

          {/* Wallet Buttons */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-4">
              Zur Wallet hinzufuegen
            </h2>

            <a
              href={`/api/wallet/apple?customerId=${customerId}`}
              className="flex items-center justify-center gap-3 w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              onClick={() => setWalletError("")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Zu Apple Wallet hinzufuegen
            </a>

            {googleLink ? (
              <a
                href={googleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Zu Google Wallet hinzufuegen
              </a>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-3 w-full bg-gray-100 text-gray-400 py-3 rounded-lg font-semibold cursor-not-allowed"
              >
                Google Wallet (nicht konfiguriert)
              </button>
            )}
          </div>

          {walletError && (
            <div className="mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {walletError}
            </div>
          )}
        </div>

        {/* Aktive Challenges */}
        {challenges.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Aktive Challenges</h2>
            <div className="space-y-3">
              {challenges.map((ch) => {
                const progress = ch.customerProgress;
                const completed = progress?.completed || false;
                let progressValue = 0;

                if (ch.type === "visit_all_locations") {
                  progressValue = ((progress?.progress?.locations as string[])?.length || 0);
                } else if (ch.type === "visit_count") {
                  progressValue = (progress?.progress?.count as number) || 0;
                } else if (ch.type === "spend_amount") {
                  progressValue = (progress?.progress?.spent as number) || 0;
                }

                const pct = Math.min((progressValue / ch.target) * 100, 100);

                return (
                  <div key={ch.id} className={`border rounded-lg p-4 ${completed ? "bg-green-50 border-green-200" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{ch.name}</span>
                      <span className="text-xs font-medium" style={{ color: s.primary_color }}>
                        +{ch.reward_points} Punkte
                      </span>
                    </div>
                    {ch.description && (
                      <p className="text-xs text-gray-500 mb-2">{ch.description}</p>
                    )}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: completed ? "#22c55e" : s.primary_color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {completed ? "Abgeschlossen!" : `${progressValue} / ${ch.target}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIP Events */}
        {events.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Deine Einladungen</h2>
            <div className="space-y-3">
              {events.map((ev) => {
                const myInvite = ev.invitations?.find((i) => i.customer_id === customerId);
                return (
                  <div key={ev.id} className="border rounded-lg p-4">
                    <p className="font-medium text-sm">{ev.name}</p>
                    {ev.description && <p className="text-xs text-gray-500">{ev.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(ev.event_date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {myInvite && myInvite.status === "invited" && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleRsvp(ev.id, "accepted")}
                          className="flex-1 text-sm py-1 rounded text-white font-medium"
                          style={{ backgroundColor: s.secondary_color }}>Zusagen</button>
                        <button onClick={() => handleRsvp(ev.id, "declined")}
                          className="flex-1 text-sm py-1 rounded border text-gray-600">Absagen</button>
                      </div>
                    )}
                    {myInvite && myInvite.status === "accepted" && (
                      <p className="text-xs text-green-600 font-medium mt-2">Du hast zugesagt!</p>
                    )}
                    {myInvite && myInvite.status === "declined" && (
                      <p className="text-xs text-gray-400 mt-2">Abgesagt</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empfehlungsprogramm */}
        {referralCode && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Freunde einladen</h2>
            <p className="text-sm text-gray-500 mb-3">
              Teile deinen Code und ihr bekommt beide {s.referral_bonus_points} Bonus-Punkte!
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-100 rounded-lg px-4 py-3 text-center font-mono font-bold text-lg tracking-wider">
                {referralCode}
              </div>
              <button
                onClick={copyReferralLink}
                className="px-4 py-3 rounded-lg text-white font-medium text-sm"
                style={{ backgroundColor: s.secondary_color }}
              >
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
            </div>
            {referralCount > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {referralCount} Freund{referralCount !== 1 ? "e" : ""} eingeladen
              </p>
            )}
          </div>
        )}

        {/* Feedback */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Wie war dein Besuch?</h2>
          {feedbackSent ? (
            <div className="text-center py-3">
              <p className="text-green-600 font-medium">Danke fuer dein Feedback!</p>
              <p className="text-xs text-gray-500 mt-1">+{s.feedback_bonus_points} Bonus-Punkte</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Bewerte uns und erhalte {s.feedback_bonus_points} Bonus-Punkte!
              </p>
              <div className="flex justify-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    className="text-3xl transition hover:scale-110"
                  >
                    {star <= feedbackRating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
              {feedbackRating > 0 && (
                <div className="space-y-2">
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Optional: Was hat dir gefallen? Was koennen wir besser machen?"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 resize-none h-20"
                    style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties}
                  />
                  <button
                    onClick={handleFeedback}
                    className="w-full py-2 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: s.secondary_color }}
                  >
                    Bewertung senden (+{s.feedback_bonus_points} Punkte)
                  </button>
                </div>
              )}
              {feedbackError && (
                <p className="text-red-500 text-xs mt-2">{feedbackError}</p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-xl">Laden...</div>
        </main>
      }
    >
      <WalletContent />
    </Suspense>
  );
}
