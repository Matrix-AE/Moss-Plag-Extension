"use strict";

/**
 * Provider adapter boundary.
 * Upstream MIT `node-moss` may be imported later only with provenance + attribution
 * under packages/provider-adapter/vendor/ — never into apps/extension or packages/ui.
 */
function assertEncryptedTransport(config) {
  if (!config || config.transport !== "encrypted-allowlisted") {
    const error = new Error("Production provider transport must be encrypted-allowlisted.");
    error.code = "transport-forbidden";
    throw error;
  }
  if (config.host === "moss.stanford.edu" && Number(config.port) === 7690 && config.allowRawTcp === true) {
    const error = new Error("Raw public Moss TCP is forbidden for product traffic.");
    error.code = "raw-tcp-forbidden";
    throw error;
  }
  return true;
}

function assertNumericUserId(userId) {
  if (!/^[0-9]{3,}$/.test(String(userId || ""))) {
    const error = new Error("Moss userid must be numeric.");
    error.code = "userid-format";
    throw error;
  }
  return true;
}

module.exports = {
  assertEncryptedTransport,
  assertNumericUserId,
};
