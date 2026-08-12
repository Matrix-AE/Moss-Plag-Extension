"use strict";

/**
 * Email + password accounts with OTP confirmation (Resend).
 * Users and password hashes persist to AUTH_STORE_PATH (JSON file).
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  sendMagicCodeEmail,
} = require("./resend-mail");

const OTP_TTL_MS =
  10 * 60 * 1000;

const ACCESS_TTL_MS =
  15 * 60 * 1000;

const REFRESH_TTL_MS =
  30 * 24 * 60 * 60 * 1000;

const MIN_PASSWORD_LEN = 10;

function defaultStorePath() {
  return (
    process.env.AUTH_STORE_PATH ||
    path.join(
      __dirname,
      "..",
      "data",
      "auth-store.json",
    )
  );
}

function createPasswordAuthService({
  now = () => Date.now(),
  storePath = defaultStorePath(),
  sendOtp = sendMagicCodeEmail,
  production =
    process.env.NODE_ENV ===
    "production",
} = {}) {
  const state =
    loadStore(storePath);

  const otps = new Map();

  const sessions = new Map();

  const refreshByHash =
    new Map();

  const retiredRefresh =
    new Set();

  function persist() {
    saveStore(
      storePath,
      state,
    );
  }

  function findUser(email) {
    const key =
      normalizeEmail(email);

    return (
      state.users.find(
        (u) => u.email === key,
      ) || null
    );
  }

  function register({
    email,
    password,
  }) {
    const normalized =
      normalizeEmail(email);

    if (
      !isEmail(normalized)
    ) {
      return {
        ok: false,
        error: "invalid-email",
        status: 400,
      };
    }

    const passwordResult =
      validatePassword(
        password,
      );

    if (!passwordResult.ok) {
      return {
        ok: false,
        error: "weak-password",
        status: 400,
        minLength:
          MIN_PASSWORD_LEN,
        failedRules:
          passwordResult.failedRules,
      };
    }

    if (
      findUser(normalized)
    ) {
      return {
        ok: false,
        error: "email-taken",
        status: 409,
      };
    }

    const user = {
      userId:
        `user_${crypto.randomBytes(8).toString("hex")}`,

      email: normalized,

      passwordHash:
        hashPassword(password),

      emailVerified: false,

      createdAt: now(),

      updatedAt: now(),
    };

    state.users.push(
      user,
    );

    persist();

    return startOtp({
      email: normalized,
      purpose: "register",
    });
  }

  function login({
    email,
    password,
    deviceId,
  }) {
    const normalized =
      normalizeEmail(email);

    const user =
      findUser(normalized);

    if (!user) {
      return {
        ok: false,
        error:
          "invalid-credentials",
        status: 401,
      };
    }

    if (
      !verifyPassword(
        password,
        user.passwordHash,
      )
    ) {
      return {
        ok: false,
        error:
          "invalid-credentials",
        status: 401,
      };
    }

    const remembered =
      getRememberedDevice({
        userId:
          user.userId,
        deviceId,
      });

    if (
      user.emailVerified &&
      remembered.ok
    ) {
      return issueSession({
        user,
        deviceId:
          remembered.deviceId,
      });
    }

    return startOtp({
      email: normalized,
      purpose:
        user.emailVerified
          ? "login"
          : "register",
    });
  }

  /**
   * Admin-only password login.
   *
   * This intentionally skips OTP.
   * ADMIN_EMAILS remains server-side.
   */
  function adminLogin({
    email,
    password,
    deviceId,
    adminEmails = "",
  }) {
    const normalized =
      normalizeEmail(email);

    const allowlist =
      new Set(
        String(
          adminEmails || "",
        )
          .split(",")
          .map((value) =>
            value
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );

    if (
      !allowlist.has(
        normalized,
      )
    ) {
      return {
        ok: false,
        error:
          "admin-required",
        status: 403,
      };
    }

    const user =
      findUser(normalized);

    if (!user) {
      return {
        ok: false,
        error:
          "invalid-credentials",
        status: 401,
      };
    }

    if (
      !verifyPassword(
        password,
        user.passwordHash,
      )
    ) {
      return {
        ok: false,
        error:
          "invalid-credentials",
        status: 401,
      };
    }

    if (
      !deviceId ||
      String(deviceId).length <
        8
    ) {
      return {
        ok: false,
        error:
          "device-required",
        status: 400,
      };
    }

    return issueSession({
      user,
      deviceId,
    });
  }

  async function startOtp({
    email,
    purpose,
  }) {
    const code = String(
      crypto.randomInt(
        100000,
        999999,
      ),
    );

    const nonce =
      crypto
        .randomBytes(24)
        .toString(
          "base64url",
        );

    otps.set(
      nonce,
      {
        email,
        purpose,
        codeHash:
          sha256(code),
        expiresAt:
          now() +
          OTP_TTL_MS,
        used: false,
      },
    );

    const mailed =
      await sendOtp({
        to: email,
        code,
        expiresInMinutes:
          Math.round(
            OTP_TTL_MS /
              60_000,
          ),
      });

    if (!mailed.ok) {
      otps.delete(nonce);

      return {
        ok: false,
        error:
          "otp-email-failed",
        status: 502,
        detail:
          mailed.error ||
          mailed.detail ||
          "send-failed",
      };
    }

    const result = {
      ok: true,
      nonce,
      purpose,
      email,
      expiresInMs:
        OTP_TTL_MS,
      message:
        "Check your email for the verification code.",
    };

    if (
      !production &&
      process.env.AUTH_RETURN_OTP ===
        "1"
    ) {
      result.devCode = code;
    }

    return result;
  }

  async function requestPasswordReset({
    email,
  }) {
    const normalized =
      normalizeEmail(email);

    if (
      !isEmail(normalized)
    ) {
      return {
        ok: false,
        error:
          "invalid-email",
        status: 400,
      };
    }

    const user =
      findUser(normalized);

    if (!user) {
      return {
        ok: false,
        error:
          "no-account",
        status: 404,
      };
    }

    return startOtp({
      email: normalized,
      purpose: "reset",
    });
  }

  function resetPassword({
    nonce,
    code,
    newPassword,
  }) {
    if (!nonce || !code) {
      return {
        ok: false,
        error:
          "missing-fields",
        status: 400,
      };
    }

    const entry =
      otps.get(nonce);

    if (!entry) {
      return {
        ok: false,
        error:
          "unknown-nonce",
        status: 400,
      };
    }

    if (
      entry.purpose !==
      "reset"
    ) {
      return {
        ok: false,
        error:
          "wrong-purpose",
        status: 400,
      };
    }

    if (entry.used) {
      return {
        ok: false,
        error: "replay",
        status: 400,
      };
    }

    if (
      entry.expiresAt <
      now()
    ) {
      return {
        ok: false,
        error: "expired",
        status: 400,
      };
    }

    if (
      entry.codeHash !==
      sha256(
        String(code).trim(),
      )
    ) {
      return {
        ok: false,
        error:
          "bad-code",
        status: 401,
      };
    }

    const passwordResult =
      validatePassword(
        newPassword,
      );

    if (!passwordResult.ok) {
      return {
        ok: false,
        error:
          "weak-password",
        status: 400,
        minLength:
          MIN_PASSWORD_LEN,
        failedRules:
          passwordResult.failedRules,
      };
    }

    const user =
      findUser(
        entry.email,
      );

    if (!user) {
      return {
        ok: false,
        error:
          "user-missing",
        status: 404,
      };
    }

    entry.used = true;

    user.passwordHash =
      hashPassword(
        newPassword,
      );

    user.emailVerified =
      true;

    user.verifiedAt =
      user.verifiedAt ||
      now();

    user.updatedAt =
      now();

    persist();

    logoutAll(
      user.userId,
    );

    return {
      ok: true,
      email: user.email,
      message:
        "Password updated. Sign in with your new password.",
    };
  }

  function verifyOtp({
    nonce,
    code,
    deviceId,
  }) {
    if (
      !nonce ||
      !code ||
      !deviceId
    ) {
      return {
        ok: false,
        error:
          "missing-fields",
        status: 400,
      };
    }

    const entry =
      otps.get(nonce);

    if (!entry) {
      return {
        ok: false,
        error:
          "unknown-nonce",
        status: 400,
      };
    }

    if (
      entry.purpose ===
      "reset"
    ) {
      return {
        ok: false,
        error:
          "wrong-purpose",
        status: 400,
      };
    }

    if (entry.used) {
      return {
        ok: false,
        error: "replay",
        status: 400,
      };
    }

    if (
      entry.expiresAt <
      now()
    ) {
      return {
        ok: false,
        error: "expired",
        status: 400,
      };
    }

    if (
      entry.codeHash !==
      sha256(
        String(code).trim(),
      )
    ) {
      return {
        ok: false,
        error:
          "bad-code",
        status: 401,
      };
    }

    entry.used = true;

    const user =
      findUser(
        entry.email,
      );

    if (!user) {
      return {
        ok: false,
        error:
          "user-missing",
        status: 404,
      };
    }

    if (
      !user.emailVerified
    ) {
      user.emailVerified =
        true;

      user.verifiedAt =
        now();

      user.updatedAt =
        now();
    }

    rememberDevice({
      user,
      deviceId,
    });

    persist();

    return issueSession({
      user,
      deviceId,
    });
  }

  function authenticateProvider({
    provider,
    subject,
    email,
    emailVerified,
    deviceId,
  }) {
    const normalized =
      normalizeEmail(email);

    if (
      ![
        "google",
        "microsoft",
      ].includes(provider)
    ) {
      return {
        ok: false,
        error:
          "provider-not-supported",
        status: 400,
      };
    }

    if (
      !subject ||
      !deviceId ||
      !isEmail(
        normalized,
      ) ||
      !emailVerified
    ) {
      return {
        ok: false,
        error:
          "provider-identity-invalid",
        status: 401,
      };
    }

    let user =
      state.users.find(
        (candidate) =>
          Array.isArray(
            candidate.identities,
          )
            ? candidate.identities.some(
                (identity) =>
                  identity.provider ===
                    provider &&
                  identity.subject ===
                    subject,
              )
            : false,
      ) ||
      findUser(
        normalized,
      );

    if (!user) {
      user = {
        userId:
          `user_${crypto.randomBytes(8).toString("hex")}`,

        email:
          normalized,

        passwordHash:
          null,

        emailVerified:
          true,

        identities: [],

        createdAt:
          now(),

        updatedAt:
          now(),
      };

      state.users.push(
        user,
      );
    }

    user.identities =
      Array.isArray(
        user.identities,
      )
        ? user.identities
        : [];

    if (
      !user.identities.some(
        (identity) =>
          identity.provider ===
            provider &&
          identity.subject ===
            subject,
      )
    ) {
      user.identities.push({
        provider,
        subject,
        linkedAt: now(),
      });
    }

    user.emailVerified =
      true;

    user.verifiedAt =
      user.verifiedAt ||
      now();

    user.updatedAt =
      now();

    persist();

    return issueSession({
      user,
      deviceId,
    });
  }

  function issueSession({
    user,
    deviceId,
  }) {
    const accessToken =
      crypto.randomBytes(
        24,
      ).toString(
        "base64url",
      );

    const refreshToken =
      crypto.randomBytes(
        32,
      ).toString(
        "base64url",
      );

    const refreshHash =
      sha256(
        refreshToken,
      );

    const session = {
      userId:
        user.userId,

      email:
        user.email,

      deviceId,

      accessToken,

      accessExpiresAt:
        now() +
        ACCESS_TTL_MS,

      refreshHash,

      refreshExpiresAt:
        now() +
        REFRESH_TTL_MS,

      revoked: false,
    };

    sessions.set(
      accessToken,
      session,
    );

    refreshByHash.set(
      refreshHash,
      session,
    );

    return {
      ok: true,
      accessToken,
      refreshToken,
      accessExpiresInMs:
        ACCESS_TTL_MS,
      refreshExpiresInMs:
        REFRESH_TTL_MS,
      userId:
        user.userId,
      email:
        user.email,
      emailVerified:
        true,
    };
  }

  function rememberDevice({
    user,
    deviceId,
  }) {
    const id =
      String(
        deviceId || "",
      ).trim();

    if (
      !id ||
      id.length < 8
    ) {
      return;
    }

    state.rememberedDevices[
      id
    ] = {
      userId:
        user.userId,
      email:
        user.email,
      rememberedAt:
        now(),
      expiresAt:
        now() +
        REFRESH_TTL_MS,
    };
  }

  function getRememberedDevice({
    userId,
    deviceId,
  }) {
    const id =
      String(
        deviceId || "",
      ).trim();

    if (
      !id ||
      id.length < 8
    ) {
      return {
        ok: false,
        error:
          "device-required",
      };
    }

    const remembered =
      state.rememberedDevices[
        id
      ];

    if (
      !remembered ||
      remembered.userId !==
        userId
    ) {
      return {
        ok: false,
        error:
          "not-remembered",
      };
    }

    if (
      remembered.expiresAt <
      now()
    ) {
      delete state
        .rememberedDevices[
        id
      ];

      persist();

      return {
        ok: false,
        error:
          "remembered-expired",
      };
    }

    remembered.rememberedAt =
      now();

    remembered.expiresAt =
      now() +
      REFRESH_TTL_MS;

    persist();

    return {
      ok: true,
      deviceId: id,
    };
  }

  function refresh({
    refreshToken,
    deviceId,
  }) {
    const h =
      sha256(
        refreshToken,
      );

    if (
      retiredRefresh.has(h)
    ) {
      const prior = [
        ...sessions.values(),
      ].find(
        (s) =>
          s.deviceId ===
          deviceId,
      );

      if (prior) {
        logoutAll(
          prior.userId,
        );
      }

      return {
        ok: false,
        error:
          "refresh-reuse",
        status: 401,
      };
    }

    const session =
      refreshByHash.get(h);

    if (!session) {
      return {
        ok: false,
        error:
          "unknown-refresh",
        status: 401,
      };
    }

    if (
      session.revoked
    ) {
      return {
        ok: false,
        error:
          "revoked",
        status: 401,
      };
    }

    if (
      session.refreshExpiresAt <
      now()
    ) {
      return {
        ok: false,
        error:
          "refresh-expired",
        status: 401,
      };
    }

    if (
      session.deviceId !==
      deviceId
    ) {
      return {
        ok: false,
        error:
          "device-binding",
        status: 401,
      };
    }

    retiredRefresh.add(h);

    refreshByHash.delete(
      h,
    );

    sessions.delete(
      session.accessToken,
    );

    const user =
      state.users.find(
        (u) =>
          u.userId ===
          session.userId,
      );

    if (!user) {
      return {
        ok: false,
        error:
          "user-missing",
        status: 404,
      };
    }

    return issueSession({
      user,
      deviceId,
    });
  }

  function authorize({
    accessToken,
  }) {
    const session =
      sessions.get(
        accessToken,
      );

    if (
      !session ||
      session.revoked
    ) {
      return {
        ok: false,
        error:
          "unauthorized",
        status: 401,
      };
    }

    if (
      session.accessExpiresAt <
      now()
    ) {
      return {
        ok: false,
        error:
          "access-expired",
        status: 401,
      };
    }

    return {
      ok: true,
      userId:
        session.userId,
      email:
        session.email,
      deviceId:
        session.deviceId,
    };
  }

  function logoutAll(
    userId,
  ) {
    for (
      const [
        token,
        session,
      ] of sessions
    ) {
      if (
        session.userId ===
        userId
      ) {
        session.revoked =
          true;

        sessions.delete(
          token,
        );

        refreshByHash.delete(
          session.refreshHash,
        );
      }
    }

    return {
      ok: true,
    };
  }

  function listUsersPublic() {
    return state.users.map(
      (u) => ({
        userId:
          u.userId,
        email:
          u.email,
        emailVerified:
          Boolean(
            u.emailVerified,
          ),
        createdAt:
          u.createdAt,
      }),
    );
  }

  function getDeviceTrial({
    deviceId,
  }) {
    const id =
      String(
        deviceId || "",
      ).trim();

    if (
      !id ||
      id.length < 8
    ) {
      return {
        ok: false,
        error:
          "device-required",
        status: 400,
      };
    }

    const claim =
      state.deviceTrials[
        id
      ];

    if (!claim) {
      return {
        ok: true,
        claimed: false,
      };
    }

    return {
      ok: true,
      claimed: true,
      claimedAt:
        claim.claimedAt,
      email:
        claim.email,
      userId:
        claim.userId,
    };
  }

  function claimDeviceTrial({
    deviceId,
    email,
    userId,
  }) {
    const id =
      String(
        deviceId || "",
      ).trim();

    if (
      !id ||
      id.length < 8
    ) {
      return {
        ok: false,
        error:
          "device-required",
        status: 400,
      };
    }

    const existing =
      state.deviceTrials[
        id
      ];

    if (existing) {
      return {
        ok: false,
        error:
          "device-trial-used",
        status: 409,
        claimed: true,
        claimedAt:
          existing.claimedAt,
        email:
          existing.email,
      };
    }

    const normalized =
      normalizeEmail(email);

    const claim = {
      deviceId: id,

      email:
        isEmail(normalized)
          ? normalized
          : "",

      userId:
        String(
          userId || "",
        ).trim() ||
        null,

      claimedAt:
        now(),
    };

    state.deviceTrials[
      id
    ] = claim;

    persist();

    return {
      ok: true,
      claimed: true,
      claimedAt:
        claim.claimedAt,
      email:
        claim.email,
    };
  }

  return {
    register,
    login,
    adminLogin,
    verifyOtp,
    requestPasswordReset,
    resetPassword,
    authenticateProvider,
    refresh,
    authorize,
    logoutAll,
    listUsersPublic,
    getDeviceTrial,
    claimDeviceTrial,
    OTP_TTL_MS,
    ACCESS_TTL_MS,
    REFRESH_TTL_MS,
    MIN_PASSWORD_LEN,
  };
}

function normalizeEmail(
  email,
) {
  return String(
    email || "",
  )
    .trim()
    .toLowerCase();
}

function isEmail(
  value,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function sha256(
  value,
) {
  return crypto
    .createHash("sha256")
    .update(
      String(value),
    )
    .digest("hex");
}

function hashPassword(
  password,
) {
  const salt =
    crypto.randomBytes(
      16,
    ).toString("hex");

  const derived =
    crypto
      .scryptSync(
        String(password),
        salt,
        32,
      )
      .toString("hex");

  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(
  password,
  stored,
) {
  const parts =
    String(stored || "")
      .split("$");

  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt"
  ) {
    return false;
  }

  const [
    ,
    salt,
    expected,
  ] = parts;

  const derived =
    crypto
      .scryptSync(
        String(password),
        salt,
        32,
      )
      .toString("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(
        derived,
        "hex",
      ),
      Buffer.from(
        expected,
        "hex",
      ),
    );
  } catch {
    return false;
  }
}

function validatePassword(
  password,
) {
  const value =
    String(
      password || "",
    );

  const rules = {
    length:
      value.length >=
      MIN_PASSWORD_LEN,

    uppercase:
      /[A-Z]/.test(
        value,
      ),

    lowercase:
      /[a-z]/.test(
        value,
      ),

    number:
      /\d/.test(value),

    symbol:
      /[^A-Za-z0-9\s]/.test(
        value,
      ),

    noWhitespace:
      !/\s/.test(value),
  };

  return {
    ok:
      Object.values(
        rules,
      ).every(Boolean),

    failedRules:
      Object.entries(
        rules,
      )
        .filter(
          ([, passed]) =>
            !passed,
        )
        .map(
          ([name]) => name,
        ),
  };
}

function loadStore(
  storePath,
) {
  try {
    if (
      !fs.existsSync(
        storePath,
      )
    ) {
      return {
        version: 1,
        users: [],
        deviceTrials: {},
        rememberedDevices: {},
      };
    }

    const raw =
      JSON.parse(
        fs.readFileSync(
          storePath,
          "utf8",
        ),
      );

    return {
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
  } catch {
    return {
      version: 1,
      users: [],
      deviceTrials: {},
      rememberedDevices: {},
    };
  }
}

function saveStore(
  storePath,
  state,
) {
  const dir =
    path.dirname(
      storePath,
    );

  fs.mkdirSync(
    dir,
    {
      recursive: true,
    },
  );

  const tmp =
    `${storePath}.${process.pid}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        version: 1,
        users:
          state.users,

        deviceTrials:
          state.deviceTrials ||
          {},

        rememberedDevices:
          state.rememberedDevices ||
          {},
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.renameSync(
    tmp,
    storePath,
  );
}

module.exports = {
  createPasswordAuthService,
  OTP_TTL_MS,
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  MIN_PASSWORD_LEN,
  validatePassword,
  hashPassword,
  verifyPassword,
};