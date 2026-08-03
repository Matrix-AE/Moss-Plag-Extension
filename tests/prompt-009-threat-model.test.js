"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const docPath = path.join(
  path.resolve(__dirname, ".."),
  "docs",
  "security",
  "threat-model.md",
);
const doc = fs.readFileSync(docPath, "utf8");

test("P009-T01 threat model has required sections", () => {
  for (const heading of [
    "# Security Threat Model and Control Backlog",
    "## Trust Boundaries",
    "## Ranked Threats",
    "## Launch-Blocking Set",
    "## Control Backlog Snapshot",
    "## Verification Record",
  ]) {
    assert.match(doc, new RegExp(`^${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "m"));
  }
});

test("P009-T02 trust boundaries B1-B6 are present", () => {
  for (const id of ["B1", "B2", "B3", "B4", "B5", "B6"]) {
    assert.match(doc, new RegExp(`\\| ${id} \\|`));
  }
  assert.match(doc, /Client-selected provider hosts\/ports are forbidden/);
  assert.match(doc, /Control characters in protocol fields are rejected/);
});

test("P009-T03 fourteen threats are uniquely identified", () => {
  const ids = [...doc.matchAll(/^\| (T-\d{2}) \|/gm)].map((m) => m[1]);
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, 14);
});

test("P009-T04 every high-severity threat has prevention detection tests owner", () => {
  const rows = [...doc.matchAll(/^\| (T-\d{2}) \| ([^|]+) \| H \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
  assert.ok(rows.length >= 10);
  for (const row of rows) {
    for (let i = 3; i <= 7; i += 1) {
      assert.ok(row[i].trim().length > 0, `${row[1]} missing column`);
    }
  }
});

test("P009-T05 launch-blocking set matches required H threats", () => {
  assert.match(
    doc,
    /T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-13/,
  );
});

test("P009-T06 no secrets and local links resolve", () => {
  assert.doesNotMatch(doc, /sk_(?:live|test)_/);
  assert.doesNotMatch(doc, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  const links = [...doc.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)/g)].map((m) => m[1]);
  for (const relative of links) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(docPath), relative)));
  }
});
