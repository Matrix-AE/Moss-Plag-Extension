"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { TRAIN_NAMES } = require("./trains.js");

const BUMPS = ["major", "minor", "patch"];

function parseChangeset(text, id) {
  const errors = [];
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text.trim() + "\n");
  if (!match) {
    return { id, errors: [{ code: "malformed", message: `${id}: missing --- front matter block` }] };
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const pair = /^([a-z][a-z-]*):\s*(.*)$/.exec(line.trim());
    if (!pair) {
      errors.push({ code: "malformed-field", message: `${id}: cannot parse "${line.trim()}"` });
      continue;
    }
    fields[pair[1]] = pair[2].trim();
  }

  const summary = match[2].trim();
  const security = fields.security === "true";
  const breaking = fields.bump === "major";

  if (!TRAIN_NAMES.includes(fields.train)) {
    errors.push({ code: "unknown-train", message: `${id}: train must be one of ${TRAIN_NAMES.join(", ")}` });
  }
  if (!BUMPS.includes(fields.bump)) {
    errors.push({ code: "unknown-bump", message: `${id}: bump must be one of ${BUMPS.join(", ")}` });
  }
  if (!summary) {
    errors.push({ code: "empty-summary", message: `${id}: release note summary is required` });
  }
  if ((breaking || security) && fields.approval !== "human-required") {
    errors.push({
      code: "missing-approval",
      message: `${id}: breaking or security changes must declare "approval: human-required"`,
    });
  }

  return {
    id,
    train: fields.train,
    bump: fields.bump,
    security,
    breaking,
    approval: fields.approval || "standard",
    summary,
    errors,
  };
}

function readChangesets(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((name) => parseChangeset(fs.readFileSync(path.join(dir, name), "utf8"), name));
}

function bumpVersion(current, bump) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!parts) {
    throw new Error(`not a semantic version: ${current}`);
  }
  const [major, minor, patch] = parts.slice(1).map(Number);
  if (bump === "major") {
    return `${major + 1}.0.0`;
  }
  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function highestBump(bumps) {
  for (const candidate of BUMPS) {
    if (bumps.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

function planReleases(changesets, currentVersions) {
  const errors = changesets.flatMap((entry) => entry.errors);
  const plans = [];
  for (const train of TRAIN_NAMES) {
    const applicable = changesets.filter((entry) => entry.train === train && !entry.errors.length);
    if (!applicable.length) {
      continue;
    }
    const bump = highestBump(applicable.map((entry) => entry.bump));
    const from = currentVersions[train];
    plans.push({
      train,
      bump,
      from,
      to: bumpVersion(from, bump),
      humanApprovalRequired: applicable.some((entry) => entry.breaking || entry.security),
      changesets: applicable.map((entry) => entry.id),
      notes: applicable.map((entry) => ({ id: entry.id, summary: entry.summary, security: entry.security })),
    });
  }
  return { ok: errors.length === 0, errors, plans };
}

module.exports = { BUMPS, bumpVersion, highestBump, parseChangeset, planReleases, readChangesets };
