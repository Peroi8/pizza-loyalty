# Pizza Loyalty System - Komplette Einrichtungsanleitung

## Uebersicht

Dieses System besteht aus:
- **Kunden-Registrierung** (`/`) - Kunden melden sich mit Name + Handynummer an
- **Wallet-Seite** (`/wallet`) - Apple & Google Wallet Karten herunterladen
- **Mitarbeiter-Interface** (`/staff`) - Punkte vergeben & Praemien einloesen
- **Admin-Dashboard** (`/admin`) - Statistiken & Kundenuebersicht

## Kosten-Uebersicht

| Posten | Kosten | Haeufigkeit |
|---|---|---|
| Apple Developer Account | 99 USD | pro Jahr |
| Google Cloud | 0 EUR | kostenlos |
| Supabase Hosting | 0 EUR | Free Tier |
| Vercel Hosting | 0 EUR | Free Tier |
| Domain (optional) | ~12 EUR | pro Jahr |
| **Gesamt** | **~103 EUR** | **pro Jahr** |

---

## Schritt 1: Supabase einrichten (10 Min)

### 1.1 Account erstellen
1. Gehe zu https://supabase.com
2. Klicke "Start your project" -> "Sign up"
3. Registriere dich mit GitHub oder Email

### 1.2 Neues Projekt erstellen
1. Klicke "New Project"
2. Waehle einen Namen: z.B. "pizza-loyalty"
3. Setze ein sicheres Datenbank-Passwort (aufschreiben!)
4. Region: **Frankfurt (eu-central-1)**
5. Klicke "Create new project" -> Warte 2 Min

### 1.3 Datenbank-Tabellen erstellen
1. Im Supabase Dashboard -> linkes Menue -> **SQL Editor**
2. Klicke "New query"
3. Kopiere den GESAMTEN Inhalt von `supabase/migrations/001_initial_schema.sql`
4. Klicke "Run" (gruener Button)
5. Du solltest "Success" sehen

### 1.4 API-Schluessel notieren
1. Gehe zu **Settings** -> **API** (im linken Menue)
2. Kopiere und notiere:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJ...`
   - **service_role secret key**: `eyJ...` (GEHEIM! Nie im Frontend verwenden)

---

## Schritt 2: Apple Developer Account (15 Min + Wartezeit)

> Kosten: 99 USD/Jahr. Ohne Apple Developer Account funktioniert Apple Wallet NICHT.
> Google Wallet funktioniert trotzdem!

### 2.1 Account erstellen
1. Gehe zu https://developer.apple.com/account
2. Melde dich mit deiner Apple ID an
3. Klicke "Enroll" -> "Start Your Enrollment"
4. Waehle: **Individual** oder **Organization** (fuer Unternehmen)
5. Bezahle 99 USD
6. **Warte auf Freischaltung** (1-48 Stunden)

### 2.2 Pass Type ID erstellen
1. Gehe zu https://developer.apple.com/account/resources/identifiers/list/passTypeId
2. Klicke "+" -> "Pass Type IDs"
3. Description: `Pizza Loyalty`
4. Identifier: `pass.com.DEINNAME.loyalty` (z.B. `pass.com.pizzamario.loyalty`)
5. "Continue" -> "Register"

### 2.3 Zertifikat erstellen
1. Klicke auf den gerade erstellten Pass Type ID
2. Klicke "Create Certificate"
3. Du brauchst eine **CSR-Datei**. So erstellst du sie am Mac:
   ```bash
   openssl req -new -newkey rsa:2048 -nodes \
     -keyout certs/signerKey.pem \
     -out certs/signerCertRequest.csr \
     -subj "/CN=Pizza Loyalty/O=Dein Name"
   ```
4. Lade die `signerCertRequest.csr` hoch
5. "Continue" -> "Download"
6. Die heruntergeladene Datei heisst `pass.cer`

### 2.4 Zertifikat konvertieren
```bash
# .cer zu .pem konvertieren
openssl x509 -inform DER -in ~/Downloads/pass.cer -out certs/signerCert.pem

# WWDR-Zertifikat herunterladen (Apple Worldwide Developer Relations)
curl -o certs/WWDR.pem https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
openssl x509 -inform DER -in certs/WWDR.pem -out certs/WWDR.pem
```

### 2.5 Team ID finden
1. Gehe zu https://developer.apple.com/account -> Membership
2. Deine **Team ID** steht dort (10 Zeichen, z.B. `A1B2C3D4E5`)

---

## Schritt 3: Google Wallet einrichten (10 Min)

### 3.1 Google Cloud Projekt erstellen
1. Gehe zu https://console.cloud.google.com
2. Erstelle ein neues Projekt: "pizza-loyalty"

### 3.2 Google Wallet API aktivieren
1. Gehe zu **APIs & Services** -> **Enable APIs**
2. Suche nach "Google Wallet API"
3. Klicke "Enable"

### 3.3 Service Account erstellen
1. Gehe zu **IAM & Admin** -> **Service Accounts**
2. Klicke "Create Service Account"
3. Name: `wallet-service`
4. Klicke "Create and Continue"
5. Rolle: **Owner** (oder spezifischer: Google Wallet API Access)
6. Klicke "Done"

### 3.4 Schluessel herunterladen
1. Klicke auf den erstellten Service Account
2. Tab "Keys" -> "Add Key" -> "Create new key"
3. Format: **JSON**
4. Die Datei wird heruntergeladen
5. Verschiebe sie: `mv ~/Downloads/dein-projekt-xxxxx.json certs/google-service-account.json`

### 3.5 Issuer Account einrichten
1. Gehe zu https://pay.google.com/business/console
2. Richte einen Issuer Account ein (folge den Anweisungen)
3. Notiere deine **Issuer ID** (eine Nummer)
4. Fuege deine Service Account Email als "User" hinzu

---

## Schritt 4: Vercel Account (5 Min)

1. Gehe zu https://vercel.com
2. Registriere dich mit GitHub
3. "New Project" -> (noch nicht verbinden, erst den Code hochladen)

---

## Schritt 5: Code konfigurieren (5 Min)

### 5.1 Environment-Variablen setzen
1. Kopiere `.env.example` zu `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Bearbeite `.env.local` und trage alle Werte ein:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...

   APPLE_PASS_TYPE_ID=pass.com.deinname.loyalty
   APPLE_TEAM_ID=A1B2C3D4E5
   APPLE_PASS_KEY_PASSPHRASE=      # leer lassen wenn kein Passwort gesetzt

   GOOGLE_SERVICE_ACCOUNT_EMAIL=wallet@dein-projekt.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./certs/google-service-account.json
   GOOGLE_WALLET_ISSUER_ID=1234567890

   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ADMIN_PASSWORD=dein-sicheres-passwort
   NEXT_PUBLIC_PIZZERIA_NAME=Dein Pizzeria Name
   ```

### 5.2 Lokal testen
```bash
npm run dev
```
Oeffne:
- http://localhost:3000 - Kunden-Registrierung
- http://localhost:3000/staff - Mitarbeiter-Interface (PIN: 1234)
- http://localhost:3000/admin - Admin Dashboard (Passwort: dein Passwort)

---

## Schritt 6: Auf Vercel deployen (10 Min)

### 6.1 Code auf GitHub hochladen
```bash
git init
git add .
git commit -m "Pizza Loyalty System"
git remote add origin https://github.com/DEIN-USERNAME/pizza-loyalty.git
git push -u origin main
```

### 6.2 Mit Vercel verbinden
1. Gehe zu https://vercel.com/new
2. Waehle dein GitHub Repository "pizza-loyalty"
3. **Environment Variables** hinzufuegen:
   - Alle Variablen aus `.env.local` einzeln eintragen
   - **WICHTIG**: Fuer `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` -> statt Pfad den KEY INHALT direkt als Env-Variable speichern
4. Klicke "Deploy"

### 6.3 Zertifikate fuer Vercel
Da Vercel keinen Dateizugriff hat, musst du die Zertifikate als Base64-Strings speichern:

```bash
# Zertifikate zu Base64 konvertieren
cat certs/signerCert.pem | base64
cat certs/signerKey.pem | base64
cat certs/WWDR.pem | base64
cat certs/google-service-account.json | base64
```

In Vercel als Environment Variables:
- `APPLE_PASS_CERT_BASE64` = (Base64 vom signerCert)
- `APPLE_PASS_KEY_BASE64` = (Base64 vom signerKey)
- `APPLE_WWDR_CERT_BASE64` = (Base64 vom WWDR)
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` = (Base64 vom Google JSON)

> HINWEIS: Du musst die Lib-Dateien (`apple-wallet.ts` und `google-wallet.ts`) anpassen, um die Base64-Variablen zu lesen, wenn sie auf Vercel laufen. Eine einfache Loesung: Pruefe ob die Datei existiert, falls nicht, lese aus der Env-Variable.

### 6.4 Domain verbinden (optional)
1. In Vercel -> Project Settings -> Domains
2. Fuege deine Domain hinzu: z.B. `treuepunkte.deinepizzeria.de`
3. Aendere DNS beim Domain-Provider wie angezeigt
4. Aendere `NEXT_PUBLIC_APP_URL` in Vercel auf deine neue Domain

---

## Schritt 7: Go Live! (15 Min)

### 7.1 Filialen anpassen
Im Supabase SQL-Editor:
```sql
-- Bestehende Beispiel-Filialen loeschen
delete from staff;
delete from locations;

-- Deine echten Filialen eintragen
insert into locations (name, address) values
  ('Filiale 1', 'Adresse der Filiale 1'),
  ('Filiale 2', 'Adresse der Filiale 2');
  -- ... weitere Filialen

-- Mitarbeiter mit PINs anlegen
insert into staff (name, pin, location_id) values
  ('Mario', '1111', (select id from locations where name = 'Filiale 1')),
  ('Luigi', '2222', (select id from locations where name = 'Filiale 1')),
  ('Toad', '3333', (select id from locations where name = 'Filiale 2'));
```

### 7.2 Praemien anpassen
```sql
-- Bestehende Praemien loeschen
delete from rewards;

-- Deine Praemien eintragen
insert into rewards (name, description, points_required) values
  ('Gratis Getraenk', 'Ein Softdrink nach Wahl', 30),
  ('Gratis Dessert', 'Ein Dessert nach Wahl', 50),
  ('10% Rabatt', '10% auf die gesamte Bestellung', 80),
  ('Gratis Pizza', 'Eine Pizza nach Wahl', 100);
```

### 7.3 QR-Codes drucken
Erstelle QR-Codes die auf deine Registrierungs-URL verweisen:
- URL: `https://treuepunkte.deinepizzeria.de` (oder deine Vercel-URL)
- Kostenloser QR-Generator: Google "QR Code Generator"
- Drucke sie auf Flyer oder Aufsteller fuer jede Filiale

### 7.4 Mitarbeiter einweisen
Jeder Mitarbeiter braucht nur:
1. Auf dem Handy/Tablet: `https://deine-url.de/staff` oeffnen
2. Seine PIN eingeben
3. Kundennummer eingeben oder Telefonnummer suchen
4. Betrag eingeben -> Punkte werden automatisch gutgeschrieben
5. Praemie einloesen wenn Kunde genug Punkte hat

---

## Ablauf fuer Kunden

1. Kunde scannt QR-Code am Tresen
2. Gibt Name + Handynummer ein
3. Fuegt Treuekarte zu Apple/Google Wallet hinzu
4. Bei jedem Besuch: Mitarbeiter sucht Kunde und gibt Betrag ein
5. Kunde sieht Punktestand live auf der Wallet-Karte
6. Ab genug Punkten: Mitarbeiter loest Praemie ein

---

## Fehlerbehebung

### "Apple Wallet Pass wird nicht generiert"
- Pruefe ob alle Zertifikate im `certs/` Ordner liegen
- Pruefe `APPLE_PASS_TYPE_ID` und `APPLE_TEAM_ID`
- Starte den Server neu: `npm run dev`

### "Google Wallet Link funktioniert nicht"
- Pruefe ob die Google Wallet API aktiviert ist
- Pruefe die Service Account JSON Datei
- Die Issuer ID muss korrekt sein

### "Supabase Fehler"
- Pruefe ob das SQL-Schema korrekt ausgefuehrt wurde
- Pruefe die Supabase URL und Keys in `.env.local`

### "Vercel Build schlaegt fehl"
- Alle Environment Variables muessen gesetzt sein
- Zertifikate als Base64 speichern (siehe Schritt 6.3)
