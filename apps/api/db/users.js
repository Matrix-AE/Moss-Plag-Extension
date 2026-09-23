"use strict";

const { supabase } = require("./supabase");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

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
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
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
  const normalizedEmail = normalizeEmail(email);

  if (!userId) {
    throw new Error("user-id-required");
  }

  if (!normalizedEmail) {
    throw new Error("email-required");
  }

  /*
   * First check whether this user_id already exists.
   */
  const existingById = await findUserById(userId);

  if (existingById) {
    const { data, error } = await supabase
      .from("users")
      .update({
        email: normalizedEmail,
        email_verified: Boolean(emailVerified),
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

  /*
   * The user_id does not exist, so check the email.
   *
   * The users table has a unique constraint on email. Reuse
   * the existing row instead of attempting a second insert.
   */
  const existingByEmail =
    await findUserByEmail(normalizedEmail);

  if (existingByEmail) {
    const { data, error } = await supabase
      .from("users")
      .update({
        email_verified: Boolean(emailVerified),
        updated_at: new Date().toISOString(),
      })
      .eq(
        "user_id",
        existingByEmail.user_id,
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /*
   * Neither the user_id nor email exists, so create the user.
   */
  const { data, error } = await supabase
    .from("users")
    .insert({
      user_id: userId,
      email: normalizedEmail,
      email_verified: Boolean(emailVerified),
      updated_at: new Date().toISOString(),
    })
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