import { getSupabaseAdmin } from "./supabase";
import type { Transaction } from "./supabase";
import { loadSettings, loadTiers, getTierForPoints } from "./settings";

const POINTS_PER_EURO = parseInt(process.env.NEXT_PUBLIC_POINTS_PER_EURO || "1");

export function calculatePoints(amountEur: number): number {
  return Math.floor(amountEur * POINTS_PER_EURO);
}

// Aktive Promotionen fuer heute pruefen und Multiplikator berechnen
export async function getActiveMultiplier(
  locationId?: string,
  customerId?: string
): Promise<{ multiplier: number; bonusPoints: number; promoNames: string[] }> {
  const db = getSupabaseAdmin();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay(); // 0=So, 1=Mo, ...

  const { data: promos } = await db
    .from("promotions")
    .select("*")
    .eq("active", true);

  if (!promos || promos.length === 0) {
    return { multiplier: 1, bonusPoints: 0, promoNames: [] };
  }

  let totalMultiplier = 1;
  let totalBonus = 0;
  const activePromoNames: string[] = [];

  // Lade Kunden-Tier wenn noetig
  let customerTierName: string | null = null;
  if (customerId) {
    const tiers = await loadTiers();
    const { data: cust } = await db
      .from("customers")
      .select("total_points_earned")
      .eq("id", customerId)
      .single();
    if (cust) {
      const tier = getTierForPoints(cust.total_points_earned, tiers);
      customerTierName = tier?.name || null;
    }
  }

  for (const promo of promos) {
    // Datums-Check
    if (promo.start_date && today < promo.start_date) continue;
    if (promo.end_date && today > promo.end_date) continue;

    // Wochentags-Check
    const days = promo.days_of_week as number[];
    if (days && days.length > 0 && !days.includes(dayOfWeek)) continue;

    // Filial-Check
    const locIds = promo.location_ids as string[];
    if (locIds && locIds.length > 0 && locationId && !locIds.includes(locationId)) continue;

    // Tier-Check
    if (promo.min_tier && customerTierName) {
      // Einfacher Check: wenn min_tier gesetzt, muss der Kunde mindestens diesen Tier haben
      const tiers = await loadTiers();
      const promoTier = tiers.find((t) => t.name === promo.min_tier);
      const custTier = tiers.find((t) => t.name === customerTierName);
      if (promoTier && custTier && custTier.min_points < promoTier.min_points) continue;
    }

    // Birthday-Promo: pruefen ob Kunde heute Geburtstag hat
    if (promo.type === "birthday" && customerId) {
      const { data: cust } = await db
        .from("customers")
        .select("birthday")
        .eq("id", customerId)
        .single();
      if (!cust?.birthday) continue;
      const bday = new Date(cust.birthday);
      if (bday.getMonth() !== now.getMonth() || bday.getDate() !== now.getDate()) continue;
    }

    // Promotion anwenden
    if (promo.type === "multiplier") {
      totalMultiplier = Math.max(totalMultiplier, promo.multiplier || 1);
      activePromoNames.push(promo.name);
    } else if (promo.type === "bonus_points" || promo.type === "birthday") {
      totalBonus += promo.bonus_points || 0;
      activePromoNames.push(promo.name);
    }
  }

  return { multiplier: totalMultiplier, bonusPoints: totalBonus, promoNames: activePromoNames };
}

export async function earnPoints(
  customerId: string,
  amountEur: number,
  staffId?: string,
  locationId?: string
): Promise<{ transaction: Transaction; newBalance: number; promoNames?: string[] }> {
  const db = getSupabaseAdmin();
  const basePoints = calculatePoints(amountEur);

  if (basePoints <= 0) throw new Error("Betrag muss groesser als 0 sein");

  // Promotion-Multiplikator pruefen
  const promo = await getActiveMultiplier(locationId, customerId);
  const points = Math.floor(basePoints * promo.multiplier) + promo.bonusPoints;

  // Punkte gutschreiben
  const { data: customer, error: custError } = await db
    .from("customers")
    .select("points_balance, total_points_earned")
    .eq("id", customerId)
    .single();

  if (custError || !customer) throw new Error("Kunde nicht gefunden");

  const newBalance = customer.points_balance + points;
  const newTotal = customer.total_points_earned + points;

  const { error: updateError } = await db
    .from("customers")
    .update({ points_balance: newBalance, total_points_earned: newTotal })
    .eq("id", customerId);

  if (updateError) throw new Error("Fehler beim Aktualisieren der Punkte");

  // Transaktion speichern
  const note = promo.promoNames.length > 0
    ? `Aktionen: ${promo.promoNames.join(", ")} (Basis: ${basePoints}, Gesamt: ${points})`
    : null;

  const { data: transaction, error: txError } = await db
    .from("transactions")
    .insert({
      customer_id: customerId,
      type: "earn",
      amount_eur: amountEur,
      points,
      staff_id: staffId || null,
      location_id: locationId || null,
      note,
    })
    .select()
    .single();

  if (txError) throw new Error("Fehler beim Speichern der Transaktion");

  // Erste Filiale tracken
  if (locationId) {
    await setFirstLocationIfNeeded(customerId, locationId);
  }

  // Challenge-Fortschritt aktualisieren
  await updateChallengeProgress(customerId, locationId, amountEur);

  return { transaction, newBalance, promoNames: promo.promoNames };
}

// === CHALLENGE PROGRESS ===
async function updateChallengeProgress(
  customerId: string,
  locationId?: string,
  amountEur?: number
): Promise<void> {
  const db = getSupabaseAdmin();

  const { data: challenges } = await db
    .from("challenges")
    .select("*")
    .eq("active", true);

  if (!challenges || challenges.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  for (const challenge of challenges) {
    // Datums-Check
    if (challenge.start_date && today < challenge.start_date) continue;
    if (challenge.end_date && today > challenge.end_date) continue;

    // Lade oder erstelle customer_challenge
    const { data: existing } = await db
      .from("customer_challenges")
      .select("*")
      .eq("customer_id", customerId)
      .eq("challenge_id", challenge.id)
      .single();

    if (existing?.completed) continue;

    const progress = (existing?.progress as Record<string, unknown>) || {};
    let completed = false;

    if (challenge.type === "visit_all_locations" && locationId) {
      const locations = (progress.locations as string[]) || [];
      if (!locations.includes(locationId)) {
        locations.push(locationId);
      }
      progress.locations = locations;

      // Pruefen ob alle Filialen besucht
      const { data: allLocs } = await db.from("locations").select("id");
      completed = locations.length >= (allLocs?.length || challenge.target);
    } else if (challenge.type === "visit_count") {
      const count = ((progress.count as number) || 0) + 1;
      progress.count = count;
      completed = count >= challenge.target;
    } else if (challenge.type === "spend_amount" && amountEur) {
      const spent = ((progress.spent as number) || 0) + amountEur;
      progress.spent = spent;
      completed = spent >= challenge.target;
    }

    // Upsert
    await db.from("customer_challenges").upsert(
      {
        customer_id: customerId,
        challenge_id: challenge.id,
        progress,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        ...(existing ? { id: existing.id } : {}),
      },
      { onConflict: "customer_id,challenge_id" }
    );

    // Bonus-Punkte bei Abschluss
    if (completed && !existing?.completed) {
      const { data: cust } = await db
        .from("customers")
        .select("points_balance, total_points_earned")
        .eq("id", customerId)
        .single();

      if (cust) {
        await db
          .from("customers")
          .update({
            points_balance: cust.points_balance + challenge.reward_points,
            total_points_earned: cust.total_points_earned + challenge.reward_points,
          })
          .eq("id", customerId);

        await db.from("transactions").insert({
          customer_id: customerId,
          type: "earn",
          points: challenge.reward_points,
          note: `Challenge abgeschlossen: ${challenge.name}`,
        });
      }
    }
  }
}

export async function saveOrderItems(
  transactionId: string,
  items: { name: string; quantity: number; price: number }[]
): Promise<void> {
  if (!items || items.length === 0) return;
  const db = getSupabaseAdmin();

  const rows = items.map((item) => ({
    transaction_id: transactionId,
    item_name: item.name,
    quantity: item.quantity,
    price: item.price,
  }));

  await db.from("order_items").insert(rows);
}

export async function setFirstLocationIfNeeded(
  customerId: string,
  locationId: string
): Promise<void> {
  const db = getSupabaseAdmin();
  await db
    .from("customers")
    .update({ first_location_id: locationId })
    .eq("id", customerId)
    .is("first_location_id", null);
}

export async function redeemPoints(
  customerId: string,
  rewardId: string,
  staffId?: string,
  locationId?: string
): Promise<{ transaction: Transaction; newBalance: number }> {
  const db = getSupabaseAdmin();

  const { data: reward, error: rewError } = await db
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("active", true)
    .single();

  if (rewError || !reward) throw new Error("Praemie nicht gefunden");

  const { data: customer, error: custError } = await db
    .from("customers")
    .select("points_balance")
    .eq("id", customerId)
    .single();

  if (custError || !customer) throw new Error("Kunde nicht gefunden");

  if (customer.points_balance < reward.points_required) {
    throw new Error(
      `Nicht genug Punkte. Benoetigt: ${reward.points_required}, Vorhanden: ${customer.points_balance}`
    );
  }

  const newBalance = customer.points_balance - reward.points_required;

  const { error: updateError } = await db
    .from("customers")
    .update({ points_balance: newBalance })
    .eq("id", customerId);

  if (updateError) throw new Error("Fehler beim Aktualisieren der Punkte");

  const { data: transaction, error: txError } = await db
    .from("transactions")
    .insert({
      customer_id: customerId,
      type: "redeem",
      points: -reward.points_required,
      reward_id: rewardId,
      staff_id: staffId || null,
      location_id: locationId || null,
      note: `Eingeloest: ${reward.name}`,
    })
    .select()
    .single();

  if (txError) throw new Error("Fehler beim Speichern der Transaktion");

  return { transaction, newBalance };
}

// === REFERRAL ===
export function generateReferralCode(name: string): string {
  const clean = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${clean}${rand}`;
}

export async function processReferral(
  newCustomerId: string,
  referralCode: string
): Promise<{ success: boolean; message: string }> {
  const db = getSupabaseAdmin();
  const settings = await loadSettings();
  const bonus = parseInt(settings.referral_bonus_points) || 50;

  // Referrer finden
  const { data: referrer } = await db
    .from("customers")
    .select("id, name, points_balance, total_points_earned")
    .eq("referral_code", referralCode.toUpperCase())
    .single();

  if (!referrer) return { success: false, message: "Ungültiger Empfehlungscode" };
  if (referrer.id === newCustomerId) return { success: false, message: "Eigener Code nicht nutzbar" };

  // Pruefen ob schon genutzt
  const { data: existingRef } = await db
    .from("referrals")
    .select("id")
    .eq("referred_id", newCustomerId)
    .single();

  if (existingRef) return { success: false, message: "Bereits empfohlen" };

  // Referral speichern
  await db.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: newCustomerId,
    referrer_bonus: bonus,
    referred_bonus: bonus,
  });

  // Referred_by setzen
  await db.from("customers").update({ referred_by: referrer.id }).eq("id", newCustomerId);

  // Bonus fuer beide
  const { data: newCust } = await db
    .from("customers")
    .select("points_balance, total_points_earned")
    .eq("id", newCustomerId)
    .single();

  if (newCust) {
    await db.from("customers").update({
      points_balance: newCust.points_balance + bonus,
      total_points_earned: newCust.total_points_earned + bonus,
    }).eq("id", newCustomerId);

    await db.from("transactions").insert({
      customer_id: newCustomerId,
      type: "earn",
      points: bonus,
      note: `Willkommensbonus (empfohlen von ${referrer.name})`,
    });
  }

  // Bonus fuer Referrer
  await db.from("customers").update({
    points_balance: referrer.points_balance + bonus,
    total_points_earned: referrer.total_points_earned + bonus,
  }).eq("id", referrer.id);

  await db.from("transactions").insert({
    customer_id: referrer.id,
    type: "earn",
    points: bonus,
    note: `Empfehlungsbonus`,
  });

  return { success: true, message: `${bonus} Bonus-Punkte fuer beide!` };
}

// === FEEDBACK ===
export async function submitFeedback(
  customerId: string,
  rating: number,
  comment?: string,
  transactionId?: string,
  locationId?: string
): Promise<{ success: boolean; bonusPoints: number }> {
  const db = getSupabaseAdmin();
  const settings = await loadSettings();
  const bonus = parseInt(settings.feedback_bonus_points) || 5;

  // Maximal 1 Feedback pro Tag pro Kunde
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await db
    .from("feedback")
    .select("id")
    .eq("customer_id", customerId)
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  if (existing && existing.length > 0) {
    return { success: false, bonusPoints: 0 };
  }

  await db.from("feedback").insert({
    customer_id: customerId,
    transaction_id: transactionId || null,
    rating,
    comment: comment || null,
    bonus_points: bonus,
    location_id: locationId || null,
  });

  // Bonus-Punkte
  const { data: cust } = await db
    .from("customers")
    .select("points_balance, total_points_earned")
    .eq("id", customerId)
    .single();

  if (cust) {
    await db.from("customers").update({
      points_balance: cust.points_balance + bonus,
      total_points_earned: cust.total_points_earned + bonus,
    }).eq("id", customerId);

    await db.from("transactions").insert({
      customer_id: customerId,
      type: "earn",
      points: bonus,
      note: `Feedback-Bonus (${rating} Sterne)`,
    });
  }

  return { success: true, bonusPoints: bonus };
}

export async function getCustomerByPhone(phone: string): Promise<import("./supabase").Customer | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .single();
  return data;
}
