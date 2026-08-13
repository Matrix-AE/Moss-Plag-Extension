"use strict";

const { supabase } = require("./supabase");

async function getEntitlement(userId) {
  const { data, error } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertEntitlement({
  userId,
  status,
  totalRuns,
  remainingRuns,
  maxFilesPerRun,
  offerVersion = null,
  purchasedAt = null,
}) {
  const { data, error } = await supabase
    .from("entitlements")
    .upsert(
      {
        user_id: userId,
        status,
        total_runs: totalRuns,
        remaining_runs: remainingRuns,
        max_files_per_run:
          maxFilesPerRun,
        offer_version:
          offerVersion,
        purchased_at:
          purchasedAt,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function consumeRun(userId) {
  const current =
    await getEntitlement(userId);

  if (!current) {
    throw new Error(
      "entitlement-not-found",
    );
  }

  if (
    current.status !== "active"
  ) {
    throw new Error(
      "entitlement-inactive",
    );
  }

  if (
    current.remaining_runs < 1
  ) {
    throw new Error(
      "quota-exhausted",
    );
  }

  const newRemaining =
    current.remaining_runs - 1;

  const { data, error } =
    await supabase
      .from("entitlements")
      .update({
        remaining_runs:
          newRemaining,

        updated_at:
          new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq(
        "remaining_runs",
        current.remaining_runs,
      )
      .select()
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "entitlement-update-conflict",
    );
  }

  return data;
}

module.exports = {
  getEntitlement,
  upsertEntitlement,
  consumeRun,
};