"use strict";

const {
  upsertUser,
  findUserByEmail,
} = require("./users");

async function main() {
  const testUserId =
    `db_test_${Date.now()}`;

  const email =
    `db-test-${Date.now()}@example.com`;

  await upsertUser({
    userId:
      testUserId,
    email,
    emailVerified:
      true,
  });

  const user =
    await findUserByEmail(
      email,
    );

  console.log(
    "Database repository test passed:",
    user,
  );
}

main().catch((error) => {
  console.error(
    "Database repository test failed:",
    error,
  );

  process.exit(1);
});