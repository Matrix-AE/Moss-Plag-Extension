"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  upsertUser,
} = require("./users");

const storePath =
  process.env.AUTH_STORE_PATH ||
  path.join(
    __dirname,
    "..",
    "data",
    "auth-store.json",
  );

async function main() {
  if (!fs.existsSync(storePath)) {
    console.error(
      `Auth store not found: ${storePath}`,
    );

    console.error(
      "Create/register at least one local account first.",
    );

    process.exit(1);
  }

  let raw;

  try {
    raw = JSON.parse(
      fs.readFileSync(
        storePath,
        "utf8",
      ),
    );
  } catch (error) {
    console.error(
      "Could not read auth store:",
      error.message,
    );

    process.exit(1);
  }

  const users =
    Array.isArray(raw.users)
      ? raw.users
      : [];

  if (!users.length) {
    console.log(
      "No users found in auth store.",
    );

    return;
  }

  console.log(
    `Found ${users.length} local user(s).`,
  );

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await upsertUser({
        userId:
          user.userId,

        email:
          user.email,

        emailVerified:
          Boolean(
            user.emailVerified,
          ),
      });

      success += 1;

      console.log(
        `✓ ${user.email}`,
      );
    } catch (error) {
      failed += 1;

      console.error(
        `✗ ${user.email}`,
        error.message ||
          error,
      );
    }
  }

  console.log("");
  console.log(
    `Migration complete: ${success} succeeded, ${failed} failed.`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Migration failed:",
    error,
  );

  process.exit(1);
});