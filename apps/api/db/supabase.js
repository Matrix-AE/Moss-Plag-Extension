"use strict";

const {
  createClient,
} = require("@supabase/supabase-js");

const url =
  process.env.SUPABASE_URL;

const secretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!url) {
  throw new Error(
    "SUPABASE_URL is not configured",
  );
}

if (!secretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY is not configured",
  );
}

const supabase =
  createClient(
    url,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

module.exports = {
  supabase,
};