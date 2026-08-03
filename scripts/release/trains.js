"use strict";

// Release trains ship independently. Store submission and backend deployment must never be
// promoted by the same approval (ADR-0010 topology, Prompt 022 constraint).
const TRAINS = {
  client: {
    label: "Extension store submission",
    channel: "chrome-web-store",
    approvalEnvironment: "store-submission",
    workspaces: ["apps/extension"],
  },
  server: {
    label: "Backend deployment",
    channel: "hosted-relay",
    approvalEnvironment: "production-backend",
    workspaces: ["apps/api", "apps/worker-submit", "apps/worker-cleanup"],
  },
  packages: {
    label: "Internal shared packages",
    channel: "internal-only",
    approvalEnvironment: "none",
    workspaces: [
      "packages/domain",
      "packages/contracts",
      "packages/config",
      "packages/testing",
      "packages/ui",
      "packages/provider-adapter",
    ],
  },
};

const TRAIN_NAMES = Object.keys(TRAINS);

function workspacesFor(train) {
  const entry = TRAINS[train];
  if (!entry) {
    throw new Error(`unknown release train: ${train}`);
  }
  return entry.workspaces;
}

module.exports = { TRAINS, TRAIN_NAMES, workspacesFor };
