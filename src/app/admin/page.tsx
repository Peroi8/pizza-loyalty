"use client";

import { useState, useEffect } from "react";
import type { AppSettings, LoyaltyTier } from "@/lib/settings";
import { DEFAULT_SETTINGS, getTierForPoints } from "@/lib/settings";

interface Stats {
  totalCustomers: number;
  totalPointsIssued: number;
  totalRevenue: number;
  totalRedemptions: number;
  recentTransactions: number;
  locations: { id: string; name: string; address: string }[];
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points_balance: number;
  total_points_earned: number;
  marketing_consent: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  points: number;
  amount_eur: number | null;
  created_at: string;
  customers?: { name: string; phone: string };
  locations?: { name: string };
  rewards?: { name: string };
  order_items?: { item_name: string; quantity: number; price: number }[];
}

interface LocationSummary {
  locationId: string;
  locationName: string;
  totalRevenue: number;
  transactionCount: number;
  uniqueCustomers: number;
  avgSpend: number;
}

interface PopularItem {
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

interface TimeAnalysis {
  byDayOfWeek: { day: string; count: number; revenue: number }[];
  byHour: { hour: number; count: number; revenue: number }[];
}

interface CustomerDetail {
  visitCount: number;
  totalSpend: number;
  avgSpend: number;
  lastVisit: string | null;
  avgDaysBetweenVisits: number;
  favoriteItems: { name: string; count: number }[];
  firstLocationName: string | null;
}

interface PromotionData {
  id?: string;
  name: string;
  description: string;
  type: "multiplier" | "bonus_points" | "birthday";
  multiplier: number;
  bonus_points: number;
  days_of_week: number[];
  location_ids: string[];
  start_date: string;
  end_date: string;
  min_tier: string;
  active: boolean;
}

interface ChallengeData {
  id?: string;
  name: string;
  description: string;
  type: "visit_all_locations" | "visit_count" | "spend_amount" | "item_count";
  target: number;
  reward_points: number;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface EventData {
  id?: string;
  name: string;
  description: string;
  event_date: string;
  location_id: string;
  min_tier: string;
  max_guests: number;
  active: boolean;
  invitations?: { customer_id: string; status: string; customers?: { name: string; email: string } }[];
  acceptedCount?: number;
}

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customers?: { name: string; email: string };
}

interface EngagementOverview {
  inactiveCount: number;
  birthdayCount: number;
  tierDistribution: Record<string, number>;
  avgRating: number;
  totalFeedback: number;
  totalReferrals: number;
  activeChallenges: number;
  activePromotions: number;
}

interface InactiveCustomer {
  id: string;
  name: string;
  email: string | null;
  points_balance: number;
  daysSinceVisit: number;
  lastVisit: string | null;
}

interface BirthdayCustomer {
  id: string;
  name: string;
  email: string | null;
  birthday: string;
  daysUntil: number;
  isToday: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  pin: string;
  location_id: string | null;
  active: boolean;
  created_at: string;
  locations?: { name: string } | null;
}

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  staff_count: number;
}

type TabType = "dashboard" | "customers" | "transactions" | "analytics" | "items" | "export" | "engagement" | "promotions" | "challenges" | "events" | "feedback" | "design" | "tiers" | "staff" | "locations";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<TabType>("dashboard");

  // Settings & Tiers
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [settingsForm, setSettingsForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Tier editing
  const [editTier, setEditTier] = useState<Partial<LoyaltyTier> | null>(null);
  const [tierSaved, setTierSaved] = useState("");

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [locationSummary, setLocationSummary] = useState<LocationSummary[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysis | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  // Export
  const [exportFields, setExportFields] = useState<Record<string, boolean>>({
    name: true,
    email: true,
    phone: false,
    birthday: false,
    points_balance: true,
    total_points_earned: false,
    marketing_consent: false,
    created_at: true,
    first_location_id: false,
    visit_count: false,
    total_spend: false,
    last_visit: false,
    favorite_items: false,
  });
  const [exportOnlyConsented, setExportOnlyConsented] = useState(true);
  const [exportPreview, setExportPreview] = useState<Record<string, unknown>[] | null>(null);
  const [exportCount, setExportCount] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);

  // Promotions
  const [promotions, setPromotions] = useState<PromotionData[]>([]);
  const [editPromo, setEditPromo] = useState<Partial<PromotionData> | null>(null);
  const [promoSaved, setPromoSaved] = useState("");

  // Challenges
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [editChallenge, setEditChallenge] = useState<Partial<ChallengeData> | null>(null);
  const [challengeSaved, setChallengeSaved] = useState("");

  // Events
  const [events, setEvents] = useState<EventData[]>([]);
  const [editEvent, setEditEvent] = useState<Partial<EventData> | null>(null);
  const [eventSaved, setEventSaved] = useState("");

  // Feedback
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [avgRating, setAvgRating] = useState(0);

  // Engagement
  const [engagementOverview, setEngagementOverview] = useState<EngagementOverview | null>(null);
  const [inactiveCustomers, setInactiveCustomers] = useState<InactiveCustomer[]>([]);
  const [birthdayCustomers, setBirthdayCustomers] = useState<BirthdayCustomer[]>([]);
  const [engagementTab, setEngagementTab] = useState<"overview" | "inactive" | "birthdays" | "expiring">("overview");

  // Referrals
  const [referrals, setReferrals] = useState<{ referrer: { name: string }; referred: { name: string }; created_at: string }[]>([]);

  // Staff Management
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [editStaff, setEditStaff] = useState<Partial<StaffMember> | null>(null);
  const [staffSaved, setStaffSaved] = useState("");
  const [staffError, setStaffError] = useState("");

  // Location Management
  const [locationList, setLocationList] = useState<LocationData[]>([]);
  const [editLocation, setEditLocation] = useState<Partial<LocationData> | null>(null);
  const [locationSaved, setLocationSaved] = useState("");
  const [locationError, setLocationError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || password === "admin" || password === "demo") {
      setAuthenticated(true);
    } else {
      setAuthError("Falsches Passwort");
    }
  }

  // Load settings & tiers
  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.settings) { setS(d.settings); setSettingsForm(d.settings); }
      if (d.tiers) setTiers(d.tiers);
    }).catch(() => {});
  }, []);

  // Load data on auth
  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/stats").then((r) => r.json()).then(setStats);
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || []));
    fetch("/api/transactions").then((r) => r.json()).then((d) => setTransactions(d.transactions || []));
    fetch("/api/analytics?type=location-summary").then((r) => r.json()).then((d) => setLocationSummary(d.locations || []));
    fetch("/api/analytics?type=popular-items").then((r) => r.json()).then((d) => setPopularItems(d.items || []));
    fetch("/api/promotions").then((r) => r.json()).then((d) => setPromotions(d.promotions || []));
    fetch("/api/challenges").then((r) => r.json()).then((d) => setChallenges(d.challenges || []));
    fetch("/api/events").then((r) => r.json()).then((d) => setEvents(d.events || []));
    fetch("/api/feedback").then((r) => r.json()).then((d) => {
      setFeedbackList(d.feedback || []);
      setAvgRating(d.avgRating || 0);
    });
    fetch("/api/engagement").then((r) => r.json()).then((d) => setEngagementOverview(d));
    fetch("/api/referral").then((r) => r.json()).then((d) => setReferrals(d.referrals || []));
    loadStaffList();
    loadLocationList();
  }, [authenticated]);

  async function loadStaffList() {
    const res = await fetch("/api/admin/staff", { headers: { authorization: password } });
    if (res.ok) { const d = await res.json(); setStaffList(d.staff || []); }
  }

  async function loadLocationList() {
    const res = await fetch("/api/admin/locations", { headers: { authorization: password } });
    if (res.ok) { const d = await res.json(); setLocationList(d.locations || []); }
  }

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/analytics?type=time-analysis&days=${analyticsDays}`).then((r) => r.json()).then(setTimeAnalysis);
  }, [authenticated, analyticsDays]);

  async function loadCustomerDetail(customerId: string) {
    if (selectedCustomer === customerId) { setSelectedCustomer(null); setCustomerDetail(null); return; }
    setSelectedCustomer(customerId);
    const res = await fetch(`/api/analytics?type=customer-detail&customerId=${customerId}`);
    setCustomerDetail(await res.json());
  }

  // === SETTINGS SAVE ===
  async function saveSettings() {
    setSettingsSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsForm),
    });
    setS(settingsForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  // === TIER CRUD ===
  async function saveTier() {
    if (!editTier?.name) return;
    setTierSaved("");

    const isNew = !editTier.id;
    const res = await fetch("/api/tiers", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editTier),
    });

    if (res.ok) {
      // Reload
      const tiersRes = await fetch("/api/tiers");
      const data = await tiersRes.json();
      setTiers(data.tiers || []);
      setEditTier(null);
      setTierSaved(isNew ? "Tier erstellt!" : "Tier aktualisiert!");
      setTimeout(() => setTierSaved(""), 3000);
    }
  }

  async function deleteTier(id: string) {
    await fetch("/api/tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    const tiersRes = await fetch("/api/tiers");
    const data = await tiersRes.json();
    setTiers(data.tiers || []);
    setTierSaved("Tier geloescht!");
    setTimeout(() => setTierSaved(""), 3000);
  }

  // === PROMOTIONS ===
  async function savePromo() {
    if (!editPromo?.name) return;
    const isNew = !editPromo.id;
    const res = await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editPromo),
    });
    if (res.ok) {
      const data = await fetch("/api/promotions").then((r) => r.json());
      setPromotions(data.promotions || []);
      setEditPromo(null);
      setPromoSaved(isNew ? "Aktion erstellt!" : "Aktion aktualisiert!");
      setTimeout(() => setPromoSaved(""), 3000);
    }
  }

  async function togglePromo(id: string) {
    await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "toggle" }),
    });
    const data = await fetch("/api/promotions").then((r) => r.json());
    setPromotions(data.promotions || []);
  }

  async function deletePromo(id: string) {
    await fetch("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    const data = await fetch("/api/promotions").then((r) => r.json());
    setPromotions(data.promotions || []);
  }

  // === CHALLENGES ===
  async function saveChallenge() {
    if (!editChallenge?.name) return;
    const isNew = !editChallenge.id;
    await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editChallenge),
    });
    const data = await fetch("/api/challenges").then((r) => r.json());
    setChallenges(data.challenges || []);
    setEditChallenge(null);
    setChallengeSaved(isNew ? "Challenge erstellt!" : "Challenge aktualisiert!");
    setTimeout(() => setChallengeSaved(""), 3000);
  }

  async function toggleChallenge(id: string) {
    await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "toggle" }),
    });
    const data = await fetch("/api/challenges").then((r) => r.json());
    setChallenges(data.challenges || []);
  }

  async function deleteChallenge(id: string) {
    await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    const data = await fetch("/api/challenges").then((r) => r.json());
    setChallenges(data.challenges || []);
  }

  // === EVENTS ===
  async function saveEvent() {
    if (!editEvent?.name) return;
    const isNew = !editEvent.id;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editEvent),
    });
    const data = await fetch("/api/events").then((r) => r.json());
    setEvents(data.events || []);
    setEditEvent(null);
    setEventSaved(isNew ? "Event erstellt!" : "Event aktualisiert!");
    setTimeout(() => setEventSaved(""), 3000);
  }

  async function autoInviteEvent(eventId: string) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, action: "auto_invite" }),
    });
    const data = await fetch("/api/events").then((r) => r.json());
    setEvents(data.events || []);
    setEventSaved("Einladungen versendet!");
    setTimeout(() => setEventSaved(""), 3000);
  }

  async function deleteEvent(id: string) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    const data = await fetch("/api/events").then((r) => r.json());
    setEvents(data.events || []);
  }

  // === ENGAGEMENT ===
  async function loadEngagementData(subTab: string) {
    if (subTab === "inactive") {
      const res = await fetch("/api/engagement?type=inactive");
      const data = await res.json();
      setInactiveCustomers(data.inactive || []);
    } else if (subTab === "birthdays") {
      const res = await fetch("/api/engagement?type=birthdays");
      const data = await res.json();
      setBirthdayCustomers(data.birthdays || []);
    }
  }

  // === EXPORT ===
  const selectedExportFields = Object.entries(exportFields).filter(([, v]) => v).map(([k]) => k);

  async function loadExportPreview() {
    setExportLoading(true);
    setExportPreview(null);
    const params = new URLSearchParams({
      fields: selectedExportFields.join(","),
      consented: exportOnlyConsented ? "true" : "false",
    });
    try {
      const res = await fetch(`/api/marketing?${params}`);
      const data = await res.json();
      setExportPreview(data.data?.slice(0, 5) || []);
      setExportCount(data.totalCount || 0);
    } catch { setExportPreview([]); }
    setExportLoading(false);
  }

  function downloadExportCSV() {
    const params = new URLSearchParams({
      format: "csv",
      fields: selectedExportFields.join(","),
      consented: exportOnlyConsented ? "true" : "false",
    });
    window.open(`/api/marketing?${params}`, "_blank");
  }

  // === STAFF CRUD ===
  async function saveStaff() {
    if (!editStaff?.name || !editStaff?.pin) { setStaffError("Name und PIN sind erforderlich"); return; }
    setStaffError("");
    const isNew = !editStaff.id;
    const res = await fetch("/api/admin/staff", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json", authorization: password },
      body: JSON.stringify(editStaff),
    });
    if (res.ok) {
      await loadStaffList();
      setEditStaff(null);
      setStaffSaved(isNew ? "Mitarbeiter erstellt!" : "Mitarbeiter aktualisiert!");
      setTimeout(() => setStaffSaved(""), 3000);
    } else {
      const d = await res.json();
      setStaffError(d.error || "Fehler beim Speichern");
    }
  }

  async function toggleStaffActive(staff: StaffMember) {
    await fetch("/api/admin/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json", authorization: password },
      body: JSON.stringify({ id: staff.id, active: !staff.active }),
    });
    await loadStaffList();
  }

  // === LOCATION CRUD ===
  async function saveLocation() {
    if (!editLocation?.name) { setLocationError("Name ist erforderlich"); return; }
    setLocationError("");
    const isNew = !editLocation.id;
    const res = await fetch("/api/admin/locations", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json", authorization: password },
      body: JSON.stringify(editLocation),
    });
    if (res.ok) {
      await loadLocationList();
      setEditLocation(null);
      setLocationSaved(isNew ? "Standort erstellt!" : "Standort aktualisiert!");
      setTimeout(() => setLocationSaved(""), 3000);
    } else {
      const d = await res.json();
      setLocationError(d.error || "Fehler beim Speichern");
    }
  }

  async function deleteLocation(id: string) {
    setLocationError("");
    const res = await fetch(`/api/admin/locations?id=${id}`, {
      method: "DELETE",
      headers: { authorization: password },
    });
    if (res.ok) {
      await loadLocationList();
      setLocationSaved("Standort geloescht!");
      setTimeout(() => setLocationSaved(""), 3000);
    } else {
      const d = await res.json();
      setLocationError(d.error || "Fehler beim Loeschen");
    }
  }

  // === LOGIN ===
  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📊</div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin-Passwort" className="w-full px-4 py-3 border rounded-lg focus:ring-2 outline-none"
              style={{ "--tw-ring-color": s.primary_color } as React.CSSProperties} required />
            {authError && <p className="text-red-600 text-sm text-center">{authError}</p>}
            <button type="submit" className="w-full text-white py-3 rounded-lg font-semibold"
              style={{ backgroundColor: s.secondary_color }}>Anmelden</button>
          </form>
        </div>
      </main>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: "dashboard", label: "Uebersicht" },
    { key: "customers", label: "Kunden" },
    { key: "transactions", label: "Buchungen" },
    { key: "analytics", label: "Analytics" },
    { key: "items", label: "Gerichte" },
    { key: "engagement", label: "Engagement" },
    { key: "promotions", label: "Aktionen" },
    { key: "challenges", label: "Challenges" },
    { key: "events", label: "Events" },
    { key: "feedback", label: "Feedback" },
    { key: "export", label: "Export" },
    { key: "staff", label: "Mitarbeiter" },
    { key: "locations", label: "Standorte" },
    { key: "design", label: "Design" },
    { key: "tiers", label: "Tiers" },
  ];

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">🍕 Admin</h1>
          <div className="flex gap-1 flex-wrap">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  tab === t.key ? "text-gray-900 font-bold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={tab === t.key ? { backgroundColor: s.primary_color } : undefined}
              >{t.label}</button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">

        {/* === UEBERSICHT === */}
        {tab === "dashboard" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Kunden" value={stats.totalCustomers} icon="👥" />
              <StatCard label="Punkte ausgegeben" value={stats.totalPointsIssued.toLocaleString("de-DE")} icon="⭐" />
              <StatCard label="Umsatz (gesamt)" value={`${stats.totalRevenue.toLocaleString("de-DE")} EUR`} icon="💰" />
              <StatCard label="Letzte 7 Tage" value={`${stats.recentTransactions} Buchungen`} icon="📈" />
            </div>
            {locationSummary.length > 0 && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">Filialen im Vergleich</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {locationSummary.map((loc) => (
                    <div key={loc.locationId} className="border rounded-lg p-4">
                      <p className="font-semibold">{loc.locationName}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div><p className="text-gray-500">Umsatz</p><p className="font-medium">{loc.totalRevenue.toLocaleString("de-DE")} EUR</p></div>
                        <div><p className="text-gray-500">Buchungen</p><p className="font-medium">{loc.transactionCount}</p></div>
                        <div><p className="text-gray-500">Kunden</p><p className="font-medium">{loc.uniqueCustomers}</p></div>
                        <div><p className="text-gray-500">Durchschnitt</p><p className="font-medium">{loc.avgSpend.toFixed(2)} EUR</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">E-Mail Marketing</h2>
                <button onClick={() => setTab("export")} className="text-xs px-3 py-1 rounded-lg text-white" style={{ backgroundColor: s.secondary_color }}>Export &rarr;</button>
              </div>
              <p className="text-sm text-gray-500 mb-3">Newsletter-Liste fuer Mailchimp, Brevo & Co.</p>
              <div className="flex gap-4 text-sm">
                <div><p className="text-gray-500">Abonnenten</p><p className="text-xl font-bold" style={{ color: s.primary_color }}>{customers.filter((c) => c.marketing_consent && c.email).length}</p></div>
                <div><p className="text-gray-500">Mit E-Mail</p><p className="text-xl font-bold">{customers.filter((c) => c.email).length}</p></div>
                <div><p className="text-gray-500">Gesamt</p><p className="text-xl font-bold">{customers.length}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* === KUNDEN === */}
        {tab === "customers" && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">E-Mail</th>
                    <th className="text-center px-4 py-3 font-medium">Tier</th>
                    <th className="text-right px-4 py-3 font-medium">Punkte</th>
                    <th className="text-left px-4 py-3 font-medium">Seit</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const tier = getTierForPoints(c.total_points_earned, tiers);
                    return (
                      <>
                        <tr key={c.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => loadCustomerDetail(c.id)}>
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {c.email || "-"}
                            {c.marketing_consent && <span className="ml-1 text-green-600" title="Newsletter">✉</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tier && <span style={{ color: tier.color }}>{tier.icon} {tier.name}</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: s.primary_color }}>{c.points_balance}</td>
                          <td className="px-4 py-3 text-gray-600">{new Date(c.created_at).toLocaleDateString("de-DE")}</td>
                        </tr>
                        {selectedCustomer === c.id && customerDetail && (
                          <tr key={`${c.id}-detail`}>
                            <td colSpan={5} className="px-4 py-4 bg-gray-50">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div><p className="text-gray-500">Besuche</p><p className="font-semibold">{customerDetail.visitCount}</p></div>
                                <div><p className="text-gray-500">Durchschn.</p><p className="font-semibold">{customerDetail.avgSpend.toFixed(2)} EUR</p></div>
                                <div><p className="text-gray-500">Alle ~X Tage</p><p className="font-semibold">{customerDetail.avgDaysBetweenVisits > 0 ? `${customerDetail.avgDaysBetweenVisits} Tage` : "-"}</p></div>
                                <div><p className="text-gray-500">Letzter Besuch</p><p className="font-semibold">{customerDetail.lastVisit ? new Date(customerDetail.lastVisit).toLocaleDateString("de-DE") : "-"}</p></div>
                              </div>
                              {customerDetail.favoriteItems.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-500 mb-1">LIEBLINGSGERICHTE</p>
                                  <div className="flex flex-wrap gap-1">
                                    {customerDetail.favoriteItems.map((item) => (
                                      <span key={item.name} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: `${s.primary_color}22`, color: s.secondary_color }}>{item.name} ({item.count}x)</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {customers.length === 0 && <p className="text-center text-gray-500 py-8">Noch keine Kunden.</p>}
            </div>
          </div>
        )}

        {/* === BUCHUNGEN === */}
        {tab === "transactions" && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Datum</th>
                    <th className="text-left px-4 py-3 font-medium">Kunde</th>
                    <th className="text-left px-4 py-3 font-medium">Filiale</th>
                    <th className="text-left px-4 py-3 font-medium">Typ</th>
                    <th className="text-right px-4 py-3 font-medium">Betrag</th>
                    <th className="text-right px-4 py-3 font-medium">Punkte</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <>
                      <tr key={t.id} className={`border-t hover:bg-gray-50 ${t.order_items?.length ? "cursor-pointer" : ""}`}
                        onClick={() => t.order_items?.length ? setExpandedTx(expandedTx === t.id ? null : t.id) : null}>
                        <td className="px-4 py-3 text-gray-600">{new Date(t.created_at).toLocaleString("de-DE")}</td>
                        <td className="px-4 py-3 font-medium">{t.customers?.name || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{t.locations?.name || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === "earn" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {t.type === "earn" ? "Gesammelt" : "Eingeloest"}
                          </span>
                          {t.order_items && t.order_items.length > 0 && <span className="ml-1 text-xs text-gray-400">📋 {t.order_items.length}</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.amount_eur ? `${t.amount_eur} EUR` : "-"}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${t.type === "earn" ? "text-green-600" : "text-red-600"}`}>
                          {t.type === "earn" ? "+" : ""}{t.points}
                        </td>
                      </tr>
                      {expandedTx === t.id && t.order_items && t.order_items.length > 0 && (
                        <tr key={`${t.id}-items`}>
                          <td colSpan={6} className="px-4 py-2 bg-gray-50">
                            <div className="flex flex-wrap gap-2">
                              {t.order_items.map((item, i) => (
                                <span key={i} className="px-2 py-1 bg-white border rounded text-xs">
                                  {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.item_name}{item.price ? ` (${item.price} EUR)` : ""}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && <p className="text-center text-gray-500 py-8">Noch keine Buchungen.</p>}
            </div>
          </div>
        )}

        {/* === ANALYTICS === */}
        {tab === "analytics" && timeAnalysis && (
          <div className="space-y-6">
            <div className="flex gap-2">
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => setAnalyticsDays(d)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${analyticsDays === d ? "text-gray-900" : "bg-gray-200 text-gray-600"}`}
                  style={analyticsDays === d ? { backgroundColor: s.primary_color } : undefined}>{d} Tage</button>
              ))}
            </div>
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-4">Besuche nach Wochentag</h2>
              <div className="space-y-2">
                {timeAnalysis.byDayOfWeek.map((d) => {
                  const max = Math.max(...timeAnalysis.byDayOfWeek.map((x) => x.count), 1);
                  return (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-600">{d.day.slice(0, 2)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div className="h-full rounded-full flex items-center px-2"
                          style={{ width: `${Math.max((d.count / max) * 100, 2)}%`, backgroundColor: s.primary_color }}>
                          {d.count > 0 && <span className="text-xs font-medium">{d.count}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{d.revenue.toFixed(0)} EUR</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-4">Stosszeiten (Uhrzeit)</h2>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                {timeAnalysis.byHour.filter((h) => h.hour >= 10 && h.hour <= 23).map((h) => {
                  const max = Math.max(...timeAnalysis.byHour.filter((x) => x.hour >= 10).map((x) => x.count), 1);
                  const intensity = h.count / max;
                  return (
                    <div key={h.hour} className="text-center">
                      <div className="rounded h-12 flex items-end justify-center"
                        style={{ backgroundColor: intensity > 0 ? `${s.primary_color}${Math.round(Math.max(intensity, 0.1) * 255).toString(16).padStart(2, "0")}` : "#f3f4f6" }}>
                        <span className="text-xs font-medium">{h.count > 0 ? h.count : ""}</span>
                      </div>
                      <span className="text-xs text-gray-500">{h.hour}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* === GERICHTE === */}
        {tab === "items" && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Beliebteste Gerichte</h2>
              <p className="text-sm text-gray-500">Aus gescannten Kassenzetteln</p>
            </div>
            {popularItems.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">#</th>
                    <th className="text-left px-4 py-3 font-medium">Gericht</th>
                    <th className="text-right px-4 py-3 font-medium">Bestellt</th>
                    <th className="text-right px-4 py-3 font-medium">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {popularItems.map((item, i) => (
                    <tr key={item.itemName} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{item.itemName}</td>
                      <td className="px-4 py-3 text-right">{item.totalQuantity}x</td>
                      <td className="px-4 py-3 text-right font-medium">{item.totalRevenue.toFixed(2)} EUR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-500 py-8">Noch keine Gerichte-Daten.</p>
            )}
          </div>
        )}

        {/* === ENGAGEMENT === */}
        {tab === "engagement" && (
          <div className="space-y-6">
            {/* Overview Cards */}
            {engagementOverview && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Inaktive Kunden" value={engagementOverview.inactiveCount} icon="😴" />
                <StatCard label="Geburtstage (Monat)" value={engagementOverview.birthdayCount} icon="🎂" />
                <StatCard label="Bewertung" value={`${engagementOverview.avgRating} / 5`} icon="⭐" />
                <StatCard label="Empfehlungen" value={engagementOverview.totalReferrals} icon="👥" />
              </div>
            )}

            {/* Sub-Tabs */}
            <div className="flex gap-2">
              {(["overview", "inactive", "birthdays"] as const).map((t) => (
                <button key={t} onClick={() => { setEngagementTab(t); if (t !== "overview") loadEngagementData(t); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${engagementTab === t ? "text-gray-900" : "bg-gray-200 text-gray-600"}`}
                  style={engagementTab === t ? { backgroundColor: s.primary_color } : undefined}>
                  {t === "overview" ? "Uebersicht" : t === "inactive" ? "Inaktive" : "Geburtstage"}
                </button>
              ))}
            </div>

            {/* Tier-Verteilung */}
            {engagementTab === "overview" && engagementOverview && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-white rounded-xl p-6">
                  <h3 className="font-semibold mb-3">Tier-Verteilung</h3>
                  <div className="space-y-2">
                    {Object.entries(engagementOverview.tierDistribution).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm">{name}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6">
                  <h3 className="font-semibold mb-3">Feature-Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Aktive Aktionen</span><span className="font-semibold">{engagementOverview.activePromotions}</span></div>
                    <div className="flex justify-between"><span>Aktive Challenges</span><span className="font-semibold">{engagementOverview.activeChallenges}</span></div>
                    <div className="flex justify-between"><span>Feedbacks gesamt</span><span className="font-semibold">{engagementOverview.totalFeedback}</span></div>
                    <div className="flex justify-between"><span>Empfehlungen gesamt</span><span className="font-semibold">{engagementOverview.totalReferrals}</span></div>
                  </div>
                </div>
                {referrals.length > 0 && (
                  <div className="bg-white rounded-xl p-6 sm:col-span-2">
                    <h3 className="font-semibold mb-3">Letzte Empfehlungen</h3>
                    <div className="space-y-2">
                      {referrals.slice(0, 10).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b pb-1">
                          <span>{r.referrer?.name} hat {r.referred?.name} empfohlen</span>
                          <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("de-DE")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inaktive Kunden */}
            {engagementTab === "inactive" && (
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Inaktive Kunden</h3>
                  <p className="text-sm text-gray-500">Kunden die seit {s.inactive_days_warning}+ Tagen nicht da waren</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium">E-Mail</th>
                      <th className="text-right px-4 py-2 font-medium">Punkte</th>
                      <th className="text-right px-4 py-2 font-medium">Tage inaktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveCustomers.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{c.email || "-"}</td>
                        <td className="px-4 py-2 text-right">{c.points_balance}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            c.daysSinceVisit > 90 ? "bg-red-100 text-red-700" :
                            c.daysSinceVisit > 60 ? "bg-orange-100 text-orange-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{c.daysSinceVisit} Tage</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inactiveCustomers.length === 0 && <p className="text-center text-gray-500 py-8">Keine inaktiven Kunden.</p>}
              </div>
            )}

            {/* Geburtstage */}
            {engagementTab === "birthdays" && (
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Anstehende Geburtstage (30 Tage)</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium">E-Mail</th>
                      <th className="text-left px-4 py-2 font-medium">Geburtstag</th>
                      <th className="text-right px-4 py-2 font-medium">In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayCustomers.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{c.email || "-"}</td>
                        <td className="px-4 py-2">{new Date(c.birthday).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}</td>
                        <td className="px-4 py-2 text-right">
                          {c.isToday ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">HEUTE!</span>
                          ) : (
                            <span className="text-xs text-gray-500">{c.daysUntil} Tage</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {birthdayCustomers.length === 0 && <p className="text-center text-gray-500 py-8">Keine Geburtstage in den naechsten 30 Tagen.</p>}
              </div>
            )}
          </div>
        )}

        {/* === PROMOTIONEN === */}
        {tab === "promotions" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Aktionen & Bonus-Tage</h2>
                <button onClick={() => setEditPromo({
                  name: "", description: "", type: "multiplier", multiplier: 2, bonus_points: 0,
                  days_of_week: [], location_ids: [], start_date: "", end_date: "", min_tier: "", active: true,
                })} className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neue Aktion
                </button>
              </div>
              {promoSaved && <p className="text-green-600 text-sm mb-3">{promoSaved}</p>}
              <div className="space-y-3">
                {promotions.map((p) => (
                  <div key={p.id} className={`flex items-center gap-4 p-3 border rounded-lg ${p.active ? "" : "opacity-50"}`}>
                    <div className="text-2xl">
                      {p.type === "multiplier" ? "⭐" : p.type === "birthday" ? "🎂" : "🎁"}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-gray-500">
                        {p.type === "multiplier" ? `${p.multiplier}x Punkte` : `+${p.bonus_points} Bonus`}
                        {p.days_of_week?.length > 0 && ` | ${(p.days_of_week as number[]).map((d) => ["So","Mo","Di","Mi","Do","Fr","Sa"][d]).join(", ")}`}
                        {p.start_date && ` | ${p.start_date} - ${p.end_date}`}
                      </p>
                    </div>
                    <button onClick={() => togglePromo(p.id!)}
                      className={`px-2 py-1 rounded text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.active ? "Aktiv" : "Inaktiv"}
                    </button>
                    <button onClick={() => setEditPromo({ ...p })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                    <button onClick={() => deletePromo(p.id!)} className="text-sm text-red-500 hover:underline">X</button>
                  </div>
                ))}
                {promotions.length === 0 && <p className="text-gray-500 text-sm">Keine Aktionen. Erstelle deine erste!</p>}
              </div>
            </div>

            {editPromo && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editPromo.id ? "Aktion bearbeiten" : "Neue Aktion"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editPromo.name || ""}
                    onChange={(v) => setEditPromo({ ...editPromo, name: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                    <select value={editPromo.type || "multiplier"}
                      onChange={(e) => setEditPromo({ ...editPromo, type: e.target.value as PromotionData["type"] })}
                      className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="multiplier">Punkte-Multiplikator</option>
                      <option value="bonus_points">Bonus-Punkte</option>
                      <option value="birthday">Geburtstags-Bonus</option>
                    </select>
                  </div>
                  {editPromo.type === "multiplier" && (
                    <SettingField label="Multiplikator" value={String(editPromo.multiplier || 2)}
                      onChange={(v) => setEditPromo({ ...editPromo, multiplier: parseFloat(v) })} type="number" />
                  )}
                  {(editPromo.type === "bonus_points" || editPromo.type === "birthday") && (
                    <SettingField label="Bonus-Punkte" value={String(editPromo.bonus_points || 0)}
                      onChange={(v) => setEditPromo({ ...editPromo, bonus_points: parseInt(v) })} type="number" />
                  )}
                  <SettingField label="Beschreibung" value={editPromo.description || ""}
                    onChange={(v) => setEditPromo({ ...editPromo, description: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wochentage (leer = alle)</label>
                    <div className="flex gap-1">
                      {["So","Mo","Di","Mi","Do","Fr","Sa"].map((d, i) => (
                        <button key={i}
                          onClick={() => {
                            const days = editPromo.days_of_week || [];
                            setEditPromo({
                              ...editPromo,
                              days_of_week: days.includes(i) ? days.filter((x) => x !== i) : [...days, i],
                            });
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium border ${
                            (editPromo.days_of_week || []).includes(i) ? "bg-yellow-100 border-yellow-400" : ""
                          }`}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <SettingField label="Startdatum (optional)" value={editPromo.start_date || ""}
                    onChange={(v) => setEditPromo({ ...editPromo, start_date: v })} type="date" />
                  <SettingField label="Enddatum (optional)" value={editPromo.end_date || ""}
                    onChange={(v) => setEditPromo({ ...editPromo, end_date: v })} type="date" />
                  <SettingField label="Mindest-Tier (optional)" value={editPromo.min_tier || ""}
                    onChange={(v) => setEditPromo({ ...editPromo, min_tier: v })} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={savePromo} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => setEditPromo(null)} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 text-sm mb-1">Beispiele</h3>
              <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
                <li><strong>Doppelte Punkte Mo-Mi:</strong> Typ &quot;Multiplikator&quot;, Wert 2, Tage Mo+Di+Mi</li>
                <li><strong>Geburtstags-Bonus:</strong> Typ &quot;Geburtstag&quot;, 50 Bonus-Punkte (automatisch am Geburtstag)</li>
                <li><strong>Weihnachts-Special:</strong> Typ &quot;Multiplikator&quot;, Wert 3, Datum 20.12-26.12</li>
                <li><strong>Gold-Member Extra:</strong> Typ &quot;Bonus&quot;, 10 Punkte, Mindest-Tier &quot;Gold&quot;</li>
              </ul>
            </div>
          </div>
        )}

        {/* === CHALLENGES === */}
        {tab === "challenges" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Challenges</h2>
                <button onClick={() => setEditChallenge({
                  name: "", description: "", type: "visit_count", target: 10, reward_points: 100,
                  start_date: "", end_date: "", active: true,
                })} className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neue Challenge
                </button>
              </div>
              {challengeSaved && <p className="text-green-600 text-sm mb-3">{challengeSaved}</p>}
              <div className="space-y-3">
                {challenges.map((ch) => (
                  <div key={ch.id} className={`flex items-center gap-4 p-3 border rounded-lg ${ch.active ? "" : "opacity-50"}`}>
                    <div className="text-2xl">
                      {ch.type === "visit_all_locations" ? "📍" : ch.type === "visit_count" ? "🔄" :
                       ch.type === "spend_amount" ? "💰" : "🍕"}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{ch.name}</p>
                      <p className="text-sm text-gray-500">
                        Ziel: {ch.target} | Belohnung: {ch.reward_points} Punkte
                        {ch.start_date && ` | ${ch.start_date} - ${ch.end_date}`}
                      </p>
                    </div>
                    <button onClick={() => toggleChallenge(ch.id!)}
                      className={`px-2 py-1 rounded text-xs font-medium ${ch.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {ch.active ? "Aktiv" : "Inaktiv"}
                    </button>
                    <button onClick={() => setEditChallenge({ ...ch })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                    <button onClick={() => deleteChallenge(ch.id!)} className="text-sm text-red-500 hover:underline">X</button>
                  </div>
                ))}
                {challenges.length === 0 && <p className="text-gray-500 text-sm">Keine Challenges. Erstelle deine erste!</p>}
              </div>
            </div>

            {editChallenge && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editChallenge.id ? "Challenge bearbeiten" : "Neue Challenge"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editChallenge.name || ""}
                    onChange={(v) => setEditChallenge({ ...editChallenge, name: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                    <select value={editChallenge.type || "visit_count"}
                      onChange={(e) => setEditChallenge({ ...editChallenge, type: e.target.value as ChallengeData["type"] })}
                      className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="visit_all_locations">Alle Filialen besuchen</option>
                      <option value="visit_count">X Besuche</option>
                      <option value="spend_amount">X EUR ausgeben</option>
                      <option value="item_count">X Gerichte bestellen</option>
                    </select>
                  </div>
                  <SettingField label="Ziel (Anzahl/Betrag)" value={String(editChallenge.target || 10)}
                    onChange={(v) => setEditChallenge({ ...editChallenge, target: parseInt(v) })} type="number" />
                  <SettingField label="Belohnung (Punkte)" value={String(editChallenge.reward_points || 100)}
                    onChange={(v) => setEditChallenge({ ...editChallenge, reward_points: parseInt(v) })} type="number" />
                  <SettingField label="Beschreibung" value={editChallenge.description || ""}
                    onChange={(v) => setEditChallenge({ ...editChallenge, description: v })} />
                  <SettingField label="Startdatum (optional)" value={editChallenge.start_date || ""}
                    onChange={(v) => setEditChallenge({ ...editChallenge, start_date: v })} type="date" />
                  <SettingField label="Enddatum (optional)" value={editChallenge.end_date || ""}
                    onChange={(v) => setEditChallenge({ ...editChallenge, end_date: v })} type="date" />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveChallenge} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => setEditChallenge(null)} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 text-sm mb-1">Challenge-Typen</h3>
              <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
                <li><strong>Alle Filialen besuchen:</strong> Kunde muss jede Filiale mindestens 1x besuchen</li>
                <li><strong>X Besuche:</strong> z.B. 10 Besuche in einem Monat</li>
                <li><strong>X EUR ausgeben:</strong> z.B. 200 EUR Umsatz</li>
                <li><strong>X Gerichte:</strong> z.B. 20 verschiedene Gerichte bestellen</li>
              </ul>
            </div>
          </div>
        )}

        {/* === EVENTS === */}
        {tab === "events" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">VIP Events</h2>
                <button onClick={() => setEditEvent({
                  name: "", description: "", event_date: "", location_id: "",
                  min_tier: "Gold", max_guests: 20, active: true,
                })} className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neues Event
                </button>
              </div>
              {eventSaved && <p className="text-green-600 text-sm mb-3">{eventSaved}</p>}
              <div className="space-y-3">
                {events.map((ev) => (
                  <div key={ev.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{ev.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ev.event_date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {ev.min_tier && ` | Ab ${ev.min_tier}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => autoInviteEvent(ev.id!)} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">Auto-Einladen</button>
                        <button onClick={() => setEditEvent({ ...ev })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                        <button onClick={() => deleteEvent(ev.id!)} className="text-sm text-red-500 hover:underline">X</button>
                      </div>
                    </div>
                    {ev.description && <p className="text-sm text-gray-600 mb-2">{ev.description}</p>}
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>Eingeladen: {ev.invitations?.length || 0}</span>
                      <span>Zugesagt: {ev.acceptedCount || 0}</span>
                      <span>Max: {ev.max_guests}</span>
                    </div>
                    {ev.invitations && ev.invitations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ev.invitations.map((inv, i) => (
                          <span key={i} className={`px-2 py-1 rounded text-xs ${
                            inv.status === "accepted" ? "bg-green-100 text-green-700" :
                            inv.status === "declined" ? "bg-red-100 text-red-700 line-through" :
                            "bg-gray-100 text-gray-600"
                          }`}>{inv.customers?.name || "?"}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {events.length === 0 && <p className="text-gray-500 text-sm">Keine Events. Erstelle dein erstes VIP-Event!</p>}
              </div>
            </div>

            {editEvent && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editEvent.id ? "Event bearbeiten" : "Neues Event"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editEvent.name || ""}
                    onChange={(v) => setEditEvent({ ...editEvent, name: v })} />
                  <SettingField label="Datum & Uhrzeit" value={editEvent.event_date || ""}
                    onChange={(v) => setEditEvent({ ...editEvent, event_date: v })} type="datetime-local" />
                  <SettingField label="Beschreibung" value={editEvent.description || ""}
                    onChange={(v) => setEditEvent({ ...editEvent, description: v })} />
                  <SettingField label="Mindest-Tier" value={editEvent.min_tier || ""}
                    onChange={(v) => setEditEvent({ ...editEvent, min_tier: v })} />
                  <SettingField label="Max. Gaeste" value={String(editEvent.max_guests || 20)}
                    onChange={(v) => setEditEvent({ ...editEvent, max_guests: parseInt(v) })} type="number" />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveEvent} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => setEditEvent(null)} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === FEEDBACK === */}
        {tab === "feedback" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Durchschnitt" value={`${avgRating} / 5`} icon="⭐" />
              <StatCard label="Bewertungen" value={feedbackList.length} icon="💬" />
              <StatCard label="5-Sterne" value={feedbackList.filter((f) => f.rating === 5).length} icon="🌟" />
            </div>

            {/* Verteilung */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-3">Bewertungsverteilung</h2>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = feedbackList.filter((f) => f.rating === star).length;
                  const pct = feedbackList.length > 0 ? (count / feedbackList.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-gray-600">{star} {"⭐".repeat(star)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: s.primary_color }} />
                      </div>
                      <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Liste */}
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Letzte Bewertungen</h2>
              </div>
              <div className="divide-y">
                {feedbackList.map((f) => (
                  <div key={f.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{f.customers?.name || "Anonym"}</span>
                      <span className="text-xs text-gray-500">{new Date(f.created_at).toLocaleDateString("de-DE")}</span>
                    </div>
                    <div className="text-sm">{"⭐".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</div>
                    {f.comment && <p className="text-sm text-gray-600 mt-1">{f.comment}</p>}
                  </div>
                ))}
                {feedbackList.length === 0 && <p className="text-center text-gray-500 py-8">Noch kein Feedback.</p>}
              </div>
            </div>
          </div>
        )}

        {/* === EXPORT === */}
        {tab === "export" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-2">Daten-Export</h2>
              <p className="text-sm text-gray-500 mb-4">Waehle die Felder fuer den CSV-Export (Mailchimp, Brevo, Rapidmail, etc.)</p>

              {/* Filter */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exportOnlyConsented}
                    onChange={(e) => setExportOnlyConsented(e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium">Nur Kunden mit Marketing-Einwilligung (DSGVO)</span>
                </label>
              </div>

              {/* Feld-Auswahl */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "name", label: "Name", desc: "Vorname" },
                  { key: "email", label: "E-Mail", desc: "Primaere Kontaktadresse" },
                  { key: "phone", label: "Telefon", desc: "Optional" },
                  { key: "birthday", label: "Geburtstag", desc: "Fuer Geburtstags-Aktionen" },
                  { key: "points_balance", label: "Punkte (aktuell)", desc: "Aktuelles Guthaben" },
                  { key: "total_points_earned", label: "Punkte (gesamt)", desc: "Lifetime-Punkte" },
                  { key: "marketing_consent", label: "Newsletter-Status", desc: "Ja/Nein" },
                  { key: "created_at", label: "Registriert am", desc: "Anmeldedatum" },
                  { key: "first_location_id", label: "Erste Filiale", desc: "Wo angemeldet" },
                  { key: "visit_count", label: "Anzahl Besuche", desc: "Gesamte Besuche" },
                  { key: "total_spend", label: "Gesamtausgaben", desc: "In EUR" },
                  { key: "last_visit", label: "Letzter Besuch", desc: "Datum" },
                  { key: "favorite_items", label: "Lieblingsgerichte", desc: "Top 3" },
                ].map((field) => (
                  <label key={field.key} className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition ${
                    exportFields[field.key] ? "border-yellow-400 bg-yellow-50" : "hover:bg-gray-50"
                  }`}>
                    <input type="checkbox" checked={exportFields[field.key] || false}
                      onChange={(e) => setExportFields({ ...exportFields, [field.key]: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded" />
                    <div>
                      <span className="text-sm font-medium">{field.label}</span>
                      <p className="text-xs text-gray-400">{field.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Schnellauswahl */}
              <div className="mt-4 flex gap-2 flex-wrap">
                <button onClick={() => setExportFields(Object.fromEntries(Object.keys(exportFields).map((k) => [k, true])))}
                  className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Alle auswaehlen</button>
                <button onClick={() => setExportFields(Object.fromEntries(Object.keys(exportFields).map((k) => [k, false])))}
                  className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Alle abwaehlen</button>
                <button onClick={() => setExportFields({
                  name: true, email: true, phone: false, birthday: true, points_balance: false,
                  total_points_earned: false, marketing_consent: false, created_at: false,
                  first_location_id: false, visit_count: false, total_spend: false, last_visit: false, favorite_items: false,
                })} className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Mailchimp-Preset</button>
                <button onClick={() => setExportFields({
                  name: true, email: true, phone: false, birthday: true, points_balance: true,
                  total_points_earned: true, marketing_consent: false, created_at: true,
                  first_location_id: true, visit_count: true, total_spend: true, last_visit: true, favorite_items: true,
                })} className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Volle Analyse</button>
              </div>
            </div>

            {/* Aktionen */}
            <div className="bg-white rounded-xl p-6">
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={loadExportPreview}
                  className="px-4 py-2 border-2 rounded-lg font-semibold text-sm hover:bg-gray-50"
                  style={{ borderColor: s.primary_color }}
                  disabled={selectedExportFields.length === 0}>
                  {exportLoading ? "Laden..." : "Vorschau laden"}
                </button>
                <button onClick={downloadExportCSV}
                  className="px-6 py-2 text-white rounded-lg font-semibold text-sm"
                  style={{ backgroundColor: s.secondary_color }}
                  disabled={selectedExportFields.length === 0}>
                  CSV herunterladen
                </button>
                <span className="text-sm text-gray-500">
                  {selectedExportFields.length} Felder ausgewaehlt
                  {exportCount > 0 && ` | ${exportCount} Kunden`}
                </span>
              </div>

              {/* Vorschau-Tabelle */}
              {exportPreview && exportPreview.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <p className="text-xs text-gray-500 mb-2">Vorschau (erste 5 Eintraege)</p>
                  <table className="w-full text-xs border">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(exportPreview[0]).map((h) => (
                          <th key={h} className="text-left px-3 py-2 font-medium border-b whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">{String(v ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {exportCount > 5 && (
                    <p className="text-xs text-gray-400 mt-1">... und {exportCount - 5} weitere</p>
                  )}
                </div>
              )}

              {exportPreview && exportPreview.length === 0 && (
                <p className="mt-4 text-sm text-gray-500">Keine Kunden gefunden.</p>
              )}
            </div>

            {/* Tipps */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Import-Tipps</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>Mailchimp:</strong> Audience → Import Contacts → CSV. Felder: Email, Name, Birthday (MM/DD Format)</p>
                <p><strong>Brevo:</strong> Kontakte → Importieren → CSV hochladen. Automatische Feldzuordnung.</p>
                <p><strong>Rapidmail:</strong> Empfaenger → Import → CSV. Trennzeichen: Komma.</p>
                <p><strong>Tipp:</strong> Nutze das &quot;Mailchimp-Preset&quot; fuer einen schnellen Start mit den wichtigsten Feldern.</p>
              </div>
            </div>
          </div>
        )}

        {/* === DESIGN === */}
        {tab === "design" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-4">Branding & Farben</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingField label="Programmname" value={settingsForm.program_name}
                  onChange={(v) => setSettingsForm({ ...settingsForm, program_name: v })} />
                <SettingField label="Pizzeria-Name" value={settingsForm.pizzeria_name}
                  onChange={(v) => setSettingsForm({ ...settingsForm, pizzeria_name: v })} />
                <SettingField label="Willkommenstext" value={settingsForm.welcome_text}
                  onChange={(v) => setSettingsForm({ ...settingsForm, welcome_text: v })} />
                <SettingField label="Tagline" value={settingsForm.tagline}
                  onChange={(v) => setSettingsForm({ ...settingsForm, tagline: v })} />
                <ColorField label="Hauptfarbe" value={settingsForm.primary_color}
                  onChange={(v) => setSettingsForm({ ...settingsForm, primary_color: v })} />
                <ColorField label="Sekundaerfarbe (Buttons)" value={settingsForm.secondary_color}
                  onChange={(v) => setSettingsForm({ ...settingsForm, secondary_color: v })} />
                <ColorField label="Akzentfarbe" value={settingsForm.accent_color}
                  onChange={(v) => setSettingsForm({ ...settingsForm, accent_color: v })} />
                <ColorField label="Wallet Hintergrund" value={settingsForm.wallet_bg_color}
                  onChange={(v) => setSettingsForm({ ...settingsForm, wallet_bg_color: v })} />
                <ColorField label="Wallet Textfarbe" value={settingsForm.wallet_text_color}
                  onChange={(v) => setSettingsForm({ ...settingsForm, wallet_text_color: v })} />
                <SettingField label="Punkte pro EUR" value={settingsForm.points_per_euro}
                  onChange={(v) => setSettingsForm({ ...settingsForm, points_per_euro: v })} type="number" />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button onClick={saveSettings} className="px-6 py-2 text-white rounded-lg font-semibold"
                  style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                {settingsSaved && <span className="text-green-600 text-sm">Gespeichert!</span>}
              </div>
            </div>

            {/* Live-Vorschau */}
            <div className="bg-white rounded-xl p-6">
              <h2 className="font-semibold mb-4">Vorschau</h2>
              <div className="rounded-xl p-6 text-center" style={{
                background: `linear-gradient(135deg, ${settingsForm.primary_color}, ${settingsForm.accent_color})`,
              }}>
                <p className="text-lg font-bold" style={{ color: settingsForm.wallet_text_color }}>{settingsForm.program_name}</p>
                <p className="text-sm" style={{ color: settingsForm.wallet_text_color, opacity: 0.7 }}>by {settingsForm.pizzeria_name}</p>
                <p className="text-4xl font-bold my-3" style={{ color: settingsForm.wallet_text_color }}>42</p>
                <p className="text-sm" style={{ color: settingsForm.wallet_text_color, opacity: 0.7 }}>Punkte</p>
              </div>
              <div className="mt-3 flex gap-2 justify-center">
                <button className="px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settingsForm.secondary_color }}>Button Vorschau</button>
                <div className="px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: settingsForm.primary_color, color: settingsForm.wallet_text_color }}>Badge</div>
              </div>
            </div>
          </div>
        )}

        {/* === TIERS === */}
        {/* === STANDORTE === */}
        {tab === "locations" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Standorte</h2>
                <button
                  onClick={() => setEditLocation({ name: "", address: "" })}
                  className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neuer Standort
                </button>
              </div>
              {locationSaved && <p className="text-green-600 text-sm mb-3">{locationSaved}</p>}
              {locationError && <p className="text-red-600 text-sm mb-3">{locationError}</p>}
              <div className="space-y-3">
                {locationList.map((loc) => (
                  <div key={loc.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="text-2xl">📍</div>
                    <div className="flex-1">
                      <p className="font-semibold">{loc.name}</p>
                      <p className="text-sm text-gray-500">{loc.address || "Keine Adresse hinterlegt"}</p>
                      <p className="text-xs text-gray-400 mt-1">{loc.staff_count} Mitarbeiter zugeordnet</p>
                    </div>
                    <button onClick={() => setEditLocation({ ...loc })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                    <button onClick={() => deleteLocation(loc.id)} className="text-sm text-red-500 hover:underline">Loeschen</button>
                  </div>
                ))}
                {locationList.length === 0 && <p className="text-gray-500 text-sm">Keine Standorte vorhanden.</p>}
              </div>
            </div>

            {editLocation && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editLocation.id ? "Standort bearbeiten" : "Neuer Standort"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editLocation.name || ""}
                    onChange={(v) => setEditLocation({ ...editLocation, name: v })} />
                  <SettingField label="Adresse" value={editLocation.address || ""}
                    onChange={(v) => setEditLocation({ ...editLocation, address: v })} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveLocation} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => { setEditLocation(null); setLocationError(""); }} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === MITARBEITER === */}
        {tab === "staff" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Mitarbeiter</h2>
                <button
                  onClick={() => setEditStaff({ name: "", pin: "", location_id: locationList.length > 0 ? locationList[0].id : null, active: true })}
                  className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neuer Mitarbeiter
                </button>
              </div>
              {staffSaved && <p className="text-green-600 text-sm mb-3">{staffSaved}</p>}
              {staffError && <p className="text-red-600 text-sm mb-3">{staffError}</p>}

              {/* Tabelle */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 px-2">Name</th>
                      <th className="py-2 px-2">PIN</th>
                      <th className="py-2 px-2">Standort</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((st) => (
                      <tr key={st.id} className={`border-b ${!st.active ? "opacity-50" : ""}`}>
                        <td className="py-3 px-2 font-medium">{st.name}</td>
                        <td className="py-3 px-2 font-mono text-gray-600">{st.pin}</td>
                        <td className="py-3 px-2">{st.locations?.name || <span className="text-gray-400">-</span>}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {st.active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </td>
                        <td className="py-3 px-2 flex gap-2">
                          <button onClick={() => setEditStaff({ ...st })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                          <button onClick={() => toggleStaffActive(st)}
                            className={`text-sm hover:underline ${st.active ? "text-red-500" : "text-green-500"}`}>
                            {st.active ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {staffList.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Keine Mitarbeiter vorhanden.</p>}
              </div>
            </div>

            {/* Edit/Create Form */}
            {editStaff && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editStaff.id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editStaff.name || ""}
                    onChange={(v) => setEditStaff({ ...editStaff, name: v })} />
                  <SettingField label="PIN (mind. 4 Zeichen)" value={editStaff.pin || ""}
                    onChange={(v) => setEditStaff({ ...editStaff, pin: v })} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
                    <select
                      value={editStaff.location_id || ""}
                      onChange={(e) => setEditStaff({ ...editStaff, location_id: e.target.value || null })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm">
                      <option value="">-- Kein Standort --</option>
                      {locationList.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveStaff} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => { setEditStaff(null); setStaffError(""); }} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "tiers" && (
          <div className="space-y-6">
            {/* Bestehende Tiers */}
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Loyalty Stufen</h2>
                <button
                  onClick={() => setEditTier({ name: "", min_points: 0, color: "#9ca3af", icon: "🍕", benefits: "", sort_order: tiers.length, active: true })}
                  className="px-3 py-1 text-white rounded-lg text-sm" style={{ backgroundColor: s.secondary_color }}>
                  + Neue Stufe
                </button>
              </div>
              {tierSaved && <p className="text-green-600 text-sm mb-3">{tierSaved}</p>}
              <div className="space-y-3">
                {tiers.map((tier) => (
                  <div key={tier.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <span className="text-2xl">{tier.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: tier.color }}>{tier.name}</p>
                      <p className="text-sm text-gray-500">ab {tier.min_points} Punkte{tier.benefits ? ` - ${tier.benefits}` : ""}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: tier.color }} />
                    <button onClick={() => setEditTier({ ...tier })} className="text-sm text-gray-500 hover:underline">Bearbeiten</button>
                    <button onClick={() => deleteTier(tier.id)} className="text-sm text-red-500 hover:underline">X</button>
                  </div>
                ))}
                {tiers.length === 0 && <p className="text-gray-500 text-sm">Keine Stufen definiert.</p>}
              </div>
            </div>

            {/* Edit/Create Form */}
            {editTier && (
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold mb-4">{editTier.id ? "Stufe bearbeiten" : "Neue Stufe erstellen"}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingField label="Name" value={editTier.name || ""}
                    onChange={(v) => setEditTier({ ...editTier, name: v })} />
                  <SettingField label="Ab Punkte" value={String(editTier.min_points || 0)}
                    onChange={(v) => setEditTier({ ...editTier, min_points: Number(v) })} type="number" />
                  <ColorField label="Farbe" value={editTier.color || "#9ca3af"}
                    onChange={(v) => setEditTier({ ...editTier, color: v })} />
                  <SettingField label="Icon (Emoji)" value={editTier.icon || ""}
                    onChange={(v) => setEditTier({ ...editTier, icon: v })} />
                  <SettingField label="Vorteile / Beschreibung" value={editTier.benefits || ""}
                    onChange={(v) => setEditTier({ ...editTier, benefits: v })} />
                  <SettingField label="Reihenfolge" value={String(editTier.sort_order || 0)}
                    onChange={(v) => setEditTier({ ...editTier, sort_order: Number(v) })} type="number" />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={saveTier} className="px-6 py-2 text-white rounded-lg font-semibold"
                    style={{ backgroundColor: s.secondary_color }}>Speichern</button>
                  <button onClick={() => setEditTier(null)} className="px-4 py-2 border rounded-lg text-gray-600">Abbrechen</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// === HELPER COMPONENTS ===

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function SettingField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
    </div>
  );
}

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg outline-none text-sm font-mono" />
      </div>
    </div>
  );
}
