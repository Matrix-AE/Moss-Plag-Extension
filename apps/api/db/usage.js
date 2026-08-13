"use strict";

const { supabase } = require("./supabase");

async function recordUsage({
  userId,
  jobId = null,
  runsConsumed = 1,
}) {
  const { data, error } = await supabase
    .from("usage")
    .insert({
      user_id: userId,
      job_id: jobId,
      runs_consumed: runsConsumed,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getUserUsage(userId) {
  const { data, error } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

module.exports = {
  recordUsage,
  getUserUsage,
};