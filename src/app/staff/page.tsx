"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AppSettings, LoyaltyTier } from "@/lib/settings";
import { DEFAULT_SETTINGS, getTierForPoints, getNextTier } from "@/lib/settings";
import { Html5Qrcode } from "html5-qrcode";

interface Staff {
  id: string;
  name: string;
  location_id: string;
  locations: { name: string };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  points_balance: number;
  total_points_earned: number;
}

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptData {
  items: ReceiptItem[];
  total: number;
  date?: string;
  receiptNumber?: string;
  confidence: "high" | "medium" | "low";
}

// Bild verkleinern fuer Upload (spart Bandbreite)
function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
}

export default function StaffPage() {
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setS(d.settings);
        if (d.tiers) setTiers(d.tiers);
      })
      .catch(() => {});
  }, []);

  // Kunden-Suche
  const [searchTerm, setSearchTerm] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searchError, setSearchError] = useState("");

  // QR-Scanner fuer Kundensuche
  const [qrScanning, setQrScanning] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const stopQrScanner = useCallback(async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
      } catch {}
      qrScannerRef.current = null;
    }
    setQrScanning(false);
  }, []);

  async function startQrScanner() {
    setSearchError("");
    setCustomer(null);
    setQrScanning(true);

    // Kleiner Delay damit das DOM-Element da ist
    await new Promise((r) => setTimeout(r, 300));

    try {
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // QR-Code erkannt: CIAO:{customerId}
          if (decodedText.startsWith("CIAO:")) {
            const customerId = decodedText.replace("CIAO:", "");
            await stopQrScanner();

            // Kunden laden
            const res = await fetch(`/api/customers?search=${encodeURIComponent(customerId)}`);
            const data = await res.json();
            if (data.customer) {
              setCustomer(data.customer);
              setSearchTerm(data.customer.name);
            } else {
              setSearchError("Kunde nicht gefunden");
            }
          }
        },
        () => {} // Ignoriere Fehler beim Scannen (= kein QR erkannt)
      );
    } catch (err) {
      setSearchError("Kamera-Zugriff fehlgeschlagen. Bitte Berechtigung erteilen.");
      setQrScanning(false);
    }
  }

  // Cleanup beim Unmount
  useEffect(() => {
    return () => { stopQrScanner(); };
  }, [stopQrScanner]);

  // Punkte vergeben - Modus
  const [scanMode, setScanMode] = useState(false);

  // Manuell
  const [amount, setAmount] = useState("");
  const [earnSuccess, setEarnSuccess] = useState("");
  const [earnError, setEarnError] = useState("");

  // Scanner
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error);
      return;
    }
    setStaff(data.staff);
  }

  async function searchCustomer() {
    setSearchError("");
    setCustomer(null);
    setEarnSuccess("");
    setReceiptData(null);
    setReceiptError("");
    setReceiptPreview("");

    const res = await fetch(
      `/api/customers?search=${encodeURIComponent(searchTerm)}`
    );
    const data = await res.json();
    if (!res.ok) {
      setSearchError("Kunde nicht gefunden");
      return;
    }
    setCustomer(data.customer);
  }

  // === KASSENZETTEL SCANNEN ===
  async function handleReceiptCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptError("");
    setReceiptData(null);
    setReceiptLoading(true);

    try {
      // Bild lesen
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Vorschau setzen
      setReceiptPreview(dataUrl);

      // Verkleinern
      const resized = await resizeImage(dataUrl, 1200);

      // An API senden
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: resized }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReceiptError(data.error || "Fehler beim Scannen");
        return;
      }

      setReceiptData(data);
      // Betrag aus Scan vorbefuellen
      setAmount(data.total.toFixed(2));
    } catch {
      setReceiptError("Fehler beim Verarbeiten des Bildes");
    } finally {
      setReceiptLoading(false);
      // Input zuruecksetzen damit man nochmal scannen kann
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // === PUNKTE VERGEBEN (manuell oder aus Scan) ===
  async function handleEarn(e: React.FormEvent) {
    e.preventDefault();
    if (!customer || !staff) return;
    setEarnSuccess("");
    setEarnError("");

    const amountEur = receiptData ? receiptData.total : parseFloat(amount);
    if (!amountEur || amountEur <= 0) {
      setEarnError("Betrag muss groesser als 0 sein");
      return;
    }

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        type: "earn",
        amountEur,
        staffId: staff.id,
        locationId: staff.location_id,
        items: receiptData?.items || undefined,
        receiptNumber: receiptData?.receiptNumber || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      const pts = data.transaction?.points || Math.floor(amountEur);
      const itemCount = receiptData?.items?.length || 0;
      const promoInfo = data.promoNames?.length
        ? ` | Aktionen: ${data.promoNames.join(", ")}`
        : "";
      setEarnSuccess(
        `+${pts} Punkte! Neuer Stand: ${data.newBalance}${
          itemCount > 0 ? ` (${itemCount} Gerichte gespeichert)` : ""
        }${promoInfo}`
      );
      setCustomer({ ...customer, points_balance: data.newBalance });
      setAmount("");
      setReceiptData(null);
      setReceiptPreview("");

      // Wallet aktualisieren
      fetch("/api/wallet/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
    } else {
      setEarnError(data.error || "Fehler");
    }
  }

  // === LOGIN SCREEN ===
  if (!staff) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">👨‍🍳</div>
            <h1 className="text-xl font-bold">Mitarbeiter-Login</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Passwort eingeben"
              className="w-full px-4 py-3 border rounded-lg text-center text-lg tracking-wide focus:ring-2 focus:ring-yellow-400 outline-none"
              required
            />
            {loginError && (
              <p className="text-red-600 text-sm text-center">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full text-white py-3 rounded-lg font-semibold transition"
              style={{ backgroundColor: s.secondary_color }}
            >
              Anmelden
            </button>
          </form>
        </div>
      </main>
    );
  }

  // === HAUPTANSICHT ===
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold">{staff.name}</p>
            <p className="text-sm text-gray-500">
              {staff.locations?.name || "Filiale"}
            </p>
          </div>
          <button
            onClick={() => setStaff(null)}
            className="text-sm text-gray-500 hover:underline"
          >
            Abmelden
          </button>
        </div>

        {/* Kunden-Suche */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="font-semibold mb-3">Kunde suchen</h2>

          {/* QR-Scanner Button */}
          {!qrScanning && !customer && (
            <button
              onClick={startQrScanner}
              className="w-full mb-3 py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-yellow-400 transition flex items-center justify-center gap-3"
            >
              <span className="text-3xl">📱</span>
              <div className="text-left">
                <p className="font-semibold text-gray-800">QR-Code scannen</p>
                <p className="text-xs text-gray-500">Kunde zeigt seinen Code aus der Wallet</p>
              </div>
            </button>
          )}

          {/* QR-Scanner Kamera */}
          {qrScanning && (
            <div className="mb-3">
              <div id="qr-reader" ref={qrContainerRef} className="rounded-xl overflow-hidden" />
              <button
                onClick={stopQrScanner}
                className="w-full mt-2 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Scanner schliessen
              </button>
            </div>
          )}

          {/* Manuelle Suche */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="oder Name, E-Mail, Telefon eingeben"
              className="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
              onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
            />
            <button
              onClick={searchCustomer}
              className="text-white px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: s.secondary_color }}
            >
              Suchen
            </button>
          </div>
          {searchError && (
            <p className="text-red-600 text-sm mt-2">{searchError}</p>
          )}
        </div>

        {/* Kunde gefunden */}
        {customer && (
          <>
            {/* Kundeninfo + Punkte + Tier */}
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-lg">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.phone || ""}</p>
                  {(() => {
                    const tier = getTierForPoints(customer.total_points_earned, tiers);
                    return tier ? (
                      <span className="text-xs font-medium" style={{ color: tier.color }}>
                        {tier.icon} {tier.name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div
                  className="px-4 py-2 rounded-lg text-center"
                  style={{ backgroundColor: s.primary_color }}
                >
                  <p className="text-2xl font-bold text-gray-900">
                    {customer.points_balance}
                  </p>
                  <p className="text-xs text-gray-700">Punkte</p>
                </div>
              </div>

              {/* Modus-Toggle */}
              <div className="flex rounded-lg border overflow-hidden mb-4">
                <button
                  onClick={() => {
                    setScanMode(false);
                    setReceiptData(null);
                    setReceiptError("");
                    setReceiptPreview("");
                  }}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    !scanMode
                      ? "text-gray-900"
                      : "bg-gray-50 text-gray-500"
                  }`}
                  style={!scanMode ? { backgroundColor: "#f5c61c" } : undefined}
                >
                  Manuell
                </button>
                <button
                  onClick={() => setScanMode(true)}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    scanMode
                      ? "text-gray-900"
                      : "bg-gray-50 text-gray-500"
                  }`}
                  style={scanMode ? { backgroundColor: "#f5c61c" } : undefined}
                >
                  📷 Bon scannen
                </button>
              </div>

              {/* === MANUELLER MODUS === */}
              {!scanMode && (
                <form onSubmit={handleEarn} className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Betrag in EUR"
                    className="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    + Punkte
                  </button>
                </form>
              )}

              {/* === SCANNER MODUS === */}
              {scanMode && (
                <div className="space-y-3">
                  {/* Kamera-Button */}
                  {!receiptData && !receiptLoading && (
                    <label className="block">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-yellow-400 transition">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="font-medium text-gray-700">
                          Kassenzettel fotografieren
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Tippe hier um die Kamera zu oeffnen
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleReceiptCapture}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* Lade-Anzeige */}
                  {receiptLoading && (
                    <div className="text-center py-8">
                      {receiptPreview && (
                        <img
                          src={receiptPreview}
                          alt="Kassenzettel"
                          className="w-32 h-auto mx-auto rounded-lg mb-4 opacity-50"
                        />
                      )}
                      <div className="animate-pulse">
                        <div className="text-2xl mb-2">🔍</div>
                        <p className="font-medium text-gray-700">
                          Kassenzettel wird analysiert...
                        </p>
                        <p className="text-sm text-gray-500">
                          AI liest den Bon
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Scan-Ergebnis */}
                  {receiptData && (
                    <div className="space-y-3">
                      {/* Confidence Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Erkennung:
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${
                            receiptData.confidence === "high"
                              ? "bg-green-100 text-green-700"
                              : receiptData.confidence === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {receiptData.confidence === "high"
                            ? "Sicher"
                            : receiptData.confidence === "medium"
                            ? "Pruefen"
                            : "Unsicher"}
                        </span>
                      </div>

                      {/* Erkannte Gerichte */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          ERKANNTE GERICHTE
                        </p>
                        <div className="space-y-1">
                          {receiptData.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>
                                {item.quantity > 1 ? `${item.quantity}x ` : ""}
                                {item.name}
                              </span>
                              <span className="font-medium">
                                {(item.price * item.quantity).toFixed(2)} EUR
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gesamtbetrag */}
                      <div
                        className="rounded-lg p-4 text-center"
                        style={{ backgroundColor: s.primary_color }}
                      >
                        <p className="text-sm text-gray-700">Gesamtbetrag</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {receiptData.total.toFixed(2)} EUR
                        </p>
                        <p className="text-sm text-gray-700">
                          = {Math.floor(receiptData.total)} Punkte
                        </p>
                      </div>

                      {/* Aktionen */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleEarn}
                          className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
                        >
                          Bestaetigen
                        </button>
                        <button
                          onClick={() => {
                            setReceiptData(null);
                            setReceiptPreview("");
                            setReceiptError("");
                          }}
                          className="px-4 py-3 border rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          Neu
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fehler */}
                  {receiptError && (
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-red-600 text-sm mb-2">
                        {receiptError}
                      </p>
                      <button
                        onClick={() => {
                          setScanMode(false);
                          setReceiptError("");
                        }}
                        className="text-sm underline text-gray-600"
                      >
                        Manuell eingeben
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Erfolg / Fehler */}
              {earnSuccess && (
                <p className="text-green-600 text-sm mt-3">{earnSuccess}</p>
              )}
              {earnError && (
                <p className="text-red-600 text-sm mt-3">{earnError}</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
