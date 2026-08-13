"use strict";

const { supabase } = require("./supabase");

async function findUserById(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", String(email).trim().toLowerCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertUser({
  userId,
  email,
  emailVerified = false,
}) {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        user_id: userId,
        email: String(email).trim().toLowerCase(),
        email_verified: Boolean(emailVerified),
        updated_at: new Date().toISOString(),
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

async function updateUser(userId, changes) {
  const { data, error } = await supabase
    .from("users")
    .update({
      ...changes,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  findUserById,
  findUserByEmail,
  upsertUser,
  updateUser,
};