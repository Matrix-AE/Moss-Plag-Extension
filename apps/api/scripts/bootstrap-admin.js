"use strict";

const crypto =
  require("node:crypto");

const fs =
  require("node:fs");

const path =
  require("node:path");

const {
  hashPassword,
  validatePassword,
} =
  require("../auth/password-auth");

const email =
  String(
    process.argv[2] || "",
  )
    .trim()
    .toLowerCase();

const password =
  String(
    process.env
      .ADMIN_BOOTSTRAP_PASSWORD ||
      "",
  );

const storePath =
  process.env.AUTH_STORE_PATH ||
  path.join(
    __dirname,
    "..",
    "data",
    "auth-store.json",
  );

if (!email) {
  console.error(
    "Usage: node apps/api/scripts/bootstrap-admin.js your@email.com",
  );

  process.exit(1);
}

if (!password) {
  console.error(
    "Missing ADMIN_BOOTSTRAP_PASSWORD.",
  );

  process.exit(1);
}

if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  )
) {
  console.error(
    "Invalid email address.",
  );

  process.exit(1);
}

const passwordCheck =
  validatePassword(
    password,
  );

if (
  !passwordCheck.ok
) {
  console.error(
    "Password does not satisfy the PairProof password requirements.",
  );

  console.error(
    "Failed rules:",
    passwordCheck.failedRules.join(
      ", ",
    ),
  );

  process.exit(1);
}

let state = {
  version: 1,
  users: [],
  deviceTrials: {},
  rememberedDevices: {},
};

if (
  fs.existsSync(
    storePath,
  )
) {
  try {
    const raw =
      JSON.parse(
        fs.readFileSync(
          storePath,
          "utf8",
        ),
      );

    state = {
      version: 1,

      users:
        Array.isArray(
          raw.users,
        )
          ? raw.users
          : [],

      deviceTrials:
        raw.deviceTrials &&
        typeof raw.deviceTrials ===
          "object" &&
        !Array.isArray(
          raw.deviceTrials,
        )
          ? raw.deviceTrials
          : {},

      rememberedDevices:
        raw.rememberedDevices &&
        typeof raw.rememberedDevices ===
          "object" &&
        !Array.isArray(
          raw.rememberedDevices,
        )
          ? raw.rememberedDevices
          : {},
    };
  } catch (error) {
    console.error(
      "Could not read auth store:",
      error.message,
    );

    process.exit(1);
  }
}

const existing =
  state.users.find(
    (user) =>
      String(user.email)
        .trim()
        .toLowerCase() ===
      email,
  );

const now =
  Date.now();

if (existing) {
  existing.passwordHash =
    hashPassword(
      password,
    );

  existing.emailVerified =
    true;

  existing.verifiedAt =
    existing.verifiedAt ||
    now;

  existing.updatedAt =
    now;

  console.log(
    `Updated existing account: ${email}`,
  );
} else {
  const user = {
    userId:
      `user_${crypto.randomBytes(8).toString("hex")}`,

    email,

    passwordHash:
      hashPassword(
        password,
      ),

    emailVerified:
      true,

    verifiedAt:
      now,

    createdAt:
      now,

    updatedAt:
      now,
  };

  state.users.push(
    user,
  );

  console.log(
    `Created admin account: ${email}`,
  );
}

const directory =
  path.dirname(
    storePath,
  );

fs.mkdirSync(
  directory,
  {
    recursive: true,
  },
);

const tempPath =
  `${storePath}.${process.pid}.tmp`;

fs.writeFileSync(
  tempPath,
  JSON.stringify(
    state,
    null,
    2,
  ),
  "utf8",
);

fs.renameSync(
  tempPath,
  storePath,
);

console.log(
  `Auth store: ${storePath}`,
);

console.log(
  "Email verified: true",
);

console.log(
  "You can now log into the admin console.",
);