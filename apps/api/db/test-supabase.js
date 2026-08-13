"use strict";

const {
  supabase,
} = require("./supabase");

async function main() {
  const {
    data,
    error,
  } = await supabase
    .from("users")
    .select("id")
    .limit(1);

  if (error) {
    console.error(
      "Supabase connection failed:",
      error,
    );

    process.exit(1);
  }

  console.log(
    "Supabase connection OK",
  );

  console.log(
    `users table returned ${data.length} row(s).`,
  );
}

main().catch((error) => {
  console.error(
    "Supabase test failed:",
    error,
  );

  process.exit(1);
});