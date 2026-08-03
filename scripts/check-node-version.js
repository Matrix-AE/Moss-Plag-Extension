"use strict";

const MIN_MAJOR = 22;
const PACKAGE_MANAGER = "npm";

function parseNodeMajor(version) {
  const match = String(version).match(/^v?(\d+)\./);
  return match ? Number(match[1]) : NaN;
}

function checkRuntime(nodeVersion = process.version, userAgent = process.env.npm_config_user_agent || "") {
  const major = parseNodeMajor(nodeVersion);
  if (!Number.isFinite(major) || major < MIN_MAJOR) {
    const error = new Error(
      `Unsupported Node.js ${nodeVersion}. This monorepo requires Node.js >= ${MIN_MAJOR} (Active LTS line).`,
    );
    error.code = "unsupported-node";
    throw error;
  }

  const usingNpm = /\bnpm\//.test(userAgent) || userAgent === "";
  const usingForbidden = /\b(yarn|pnpm|bun)\//.test(userAgent);
  if (usingForbidden || (!usingNpm && userAgent)) {
    const error = new Error(
      `Unsupported package manager in user agent "${userAgent}". Use ${PACKAGE_MANAGER} via Corepack only.`,
    );
    error.code = "unsupported-package-manager";
    throw error;
  }

  return {
    ok: true,
    nodeMajor: major,
    packageManager: PACKAGE_MANAGER,
    minMajor: MIN_MAJOR,
  };
}

if (require.main === module) {
  try {
    const result = checkRuntime();
    console.log(
      `Runtime check passed: Node ${process.version} (major ${result.nodeMajor}), package manager ${result.packageManager}`,
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { MIN_MAJOR, PACKAGE_MANAGER, checkRuntime, parseNodeMajor };
