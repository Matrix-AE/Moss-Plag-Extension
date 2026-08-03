"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const editorconfigPath = path.join(root, ".editorconfig");

function main() {
  if (!fs.existsSync(editorconfigPath)) {
    console.error("Missing .editorconfig");
    process.exit(1);
  }
  const text = fs.readFileSync(editorconfigPath, "utf8");
  const required = [
    "root = true",
    "charset = utf-8",
    "end_of_line = lf",
    "insert_final_newline = true",
    "indent_style = space",
    "indent_size = 2",
  ];
  for (const item of required) {
    if (!text.includes(item)) {
      console.error(`EditorConfig missing required setting: ${item}`);
      process.exit(1);
    }
  }
  console.log("EditorConfig check passed");
}

if (require.main === module) {
  main();
}

module.exports = { main };
