"use strict";

/**
 * Durable checkout-session store (Supabase) so a Safepay payment can still be
 * granted after an API restart/redeploy or on a different replica — the
 * in-memory Map in safepay-checkout is only a cache in front of this.
 */

const { supabase } = require("./supabase");

async function saveCheckoutSession({ sessionId, tracker, userId, plan, priceUsd, offerVersion, email }) {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .upsert(
      {
        session_id: sessionId,
        tracker,
        user_id: userId,
        plan,
        price_usd: priceUsd,
        offer_version: offerVersion,
        email,
        status: "open",
      },
      { onConflict: "session_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function findCheckoutSession({ sessionId, tracker }) {
  let query = supabase.from("checkout_sessions").select("*");
  if (sessionId) query = query.eq("session_id", sessionId);
  else if (tracker) query = query.eq("tracker", tracker);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function markCheckoutSessionGranted(sessionId) {
  const { error } = await supabase
    .from("checkout_sessions")
    .update({
      status: "paid",
      entitlement_granted: true,
      paid_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) throw error;
}

module.exports = { saveCheckoutSession, findCheckoutSession, markCheckoutSessionGranted };
