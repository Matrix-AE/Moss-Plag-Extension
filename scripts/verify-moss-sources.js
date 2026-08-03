"use strict";

const assert = require("node:assert/strict");

async function main() {
  const checks = [
    {
      url: "https://theory.stanford.edu/~aiken/moss/",
      must: [
        "non-commercial",
        "100 submissions",
        "Similix",
        "14 days",
        "not a proof of plagiarism",
        "moss@moss.stanford.edu",
      ],
    },
    {
      url: "http://moss.stanford.edu/general/scripts.html",
      must: ["userid", "email-based service has been discontinued", "987654321"],
    },
    {
      url: "http://moss.stanford.edu/general/scripts/mossnet",
      must: [
        "moss.stanford.edu",
        "7690",
        'print $sock "moss $userid\\n"',
        "directory $opt_d",
        "file $id",
      ],
    },
  ];

  for (const item of checks) {
    const response = await fetch(item.url, { redirect: "follow" });
    assert.equal(response.ok, true, `fetch failed: ${item.url} status ${response.status}`);
    const text = await response.text();
    for (const needle of item.must) {
      assert.ok(text.includes(needle), `${item.url} missing: ${needle}`);
    }
    console.log(`PASS source-recheck ${item.url}`);
  }

  console.log("P004-V01 source recheck passed without MOSS TCP traffic");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
