"use strict";

const { supabase } = require("./supabase");

async function createSubscription({
  userId,
  plan,
  status = "active",
  priceUsd,
  purchasedAt = new Date().toISOString(),
  offerVersion = null,
  paymentProvider = null,
  paymentReference = null,
}) {
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan,
      status,
      price_usd: priceUsd,
      purchased_at: purchasedAt,
      offer_version: offerVersion,
      payment_provider: paymentProvider,
      payment_reference: paymentReference,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getUserSubscriptions(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("purchased_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

async function updateSubscription(
  subscriptionId,
  changes,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      ...changes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  createSubscription,
  getUserSubscriptions,
  updateSubscription,
};