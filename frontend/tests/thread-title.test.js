"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "utils.js"), "utf8"),
  context,
  { filename: "utils.js" },
);

const { threadTitle } = context.CodexPanelUtils;

assert.strictEqual(threadTitle({ name: "Named thread", preview: "Preview" }), "Named thread");
assert.strictEqual(threadTitle({ name: null, preview: "Official preview" }), "Official preview");
