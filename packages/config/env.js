"use strict";

/**
 * Environment configuration contracts for server-side apps.
 * Extension may only read PUBLIC_* values from a separately generated allowlist.
 */

const SECRET_KEYS = Object.freeze([
  "DATABASE_URL",
  "SESSION_SECRET",
  "KMS_KEY_ID",
  "PAYMENT_WEBHOOK_SECRET",
  "OBJECT_STORAGE_SECRET_KEY",
  "PROVIDER_EGRESS_CLIENT_CERT",
]);

const PUBLIC_EXTENSION_KEYS = Object.freeze([
  "PUBLIC_API_BASE_URL",
  "PUBLIC_UPLOAD_BASE_URL",
  "PUBLIC_SUPPORT_EMAIL",
  "PUBLIC_ENVIRONMENT",
]);

function redact(value) {
  if (value == null || value === "") {
    return value;
  }
  return "[REDACTED]";
}

function isSecretKey(key) {
  return SECRET_KEYS.includes(key) || /SECRET|PASSWORD|TOKEN|PRIVATE_KEY|MOSS_USER/i.test(key);
}

function validateApiEnv(env) {
  const errors = [];
  const required = [
    "APP_ENV",
    "PUBLIC_API_BASE_URL",
    "DATABASE_URL",
    "SESSION_SECRET",
    "OBJECT_STORAGE_BUCKET",
    "OBJECT_STORAGE_SECRET_KEY",
    "QUEUE_URL",
    "PROVIDER_TRANSPORT",
    "PROVIDER_HOST",
  ];
  for (const key of required) {
    if (!env[key] || String(env[key]).trim() === "") {
      errors.push({ code: "missing", key, message: `${key} is required.` });
    }
  }
  if (env.APP_ENV === "production") {
    if (env.PROVIDER_TRANSPORT !== "encrypted-allowlisted") {
      errors.push({
        code: "insecure-transport",
        key: "PROVIDER_TRANSPORT",
        message: "Production requires encrypted-allowlisted provider transport.",
      });
    }
    if (env.PROVIDER_HOST === "moss.stanford.edu" && String(env.PROVIDER_PORT) === "7690") {
      errors.push({
        code: "raw-tcp-endpoint",
        key: "PROVIDER_HOST",
        message: "Production must not use public raw Moss TCP endpoint.",
      });
    }
    if (env.SESSION_SECRET && String(env.SESSION_SECRET).length < 32) {
      errors.push({
        code: "weak-secret",
        key: "SESSION_SECRET",
        message: "SESSION_SECRET must be at least 32 characters in production.",
      });
    }
    if (env.ALLOW_INSECURE_DEFAULTS === "true") {
      errors.push({
        code: "insecure-default",
        key: "ALLOW_INSECURE_DEFAULTS",
        message: "Insecure defaults are forbidden in production.",
      });
    }
  }
  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors.map((entry) => ({
        ...entry,
        sample: isSecretKey(entry.key) ? redact(env[entry.key]) : undefined,
      })),
    };
  }
  return {
    ok: true,
    value: {
      appEnv: env.APP_ENV,
      publicApiBaseUrl: env.PUBLIC_API_BASE_URL,
      providerTransport: env.PROVIDER_TRANSPORT,
      providerHost: env.PROVIDER_HOST,
      hostedChecksIncluded: Number(env.HOSTED_CHECKS_INCLUDED || 40),
      deviceLimit: Number(env.DEVICE_LIMIT || 2),
    },
  };
}

function validateExtensionPublicEnv(env) {
  const errors = [];
  for (const key of Object.keys(env)) {
    if (!PUBLIC_EXTENSION_KEYS.includes(key)) {
      errors.push({
        code: "non-public-key",
        key,
        message: `${key} is not allowlisted for extension bundles.`,
      });
    }
  }
  for (const key of ["PUBLIC_API_BASE_URL", "PUBLIC_ENVIRONMENT"]) {
    if (!env[key]) {
      errors.push({ code: "missing", key, message: `${key} is required for extension public config.` });
    }
  }
  if (errors.length) {
    return { ok: false, errors };
  }
  return { ok: true, value: env };
}

function scanForCommittedCanaries(text) {
  const rules = [
    { name: "CANARY_SESSION_SECRET_DO_NOT_COMMIT", pattern: /CANARY_SESSION_SECRET_DO_NOT_COMMIT/ },
    { name: "CANARY_PAYMENT_WEBHOOK_SECRET", pattern: /CANARY_PAYMENT_WEBHOOK_SECRET/ },
    { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
    { name: "private-key-header", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  ];
  return rules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
}

module.exports = {
  PUBLIC_EXTENSION_KEYS,
  SECRET_KEYS,
  isSecretKey,
  redact,
  scanForCommittedCanaries,
  validateApiEnv,
  validateExtensionPublicEnv,
};
