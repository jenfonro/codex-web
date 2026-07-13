"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const responseSource = fs.readFileSync(path.join(root, "src", "pages", "codex", "response-stack.jsx"), "utf8");
const rendererSource = fs.readFileSync(path.join(root, "src", "pages", "codex", "renderer.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "src", "pages", "codex", "index.js"), "utf8");
const indexHTML = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const shadowCSS = fs.readFileSync(path.join(root, "src", "pages", "codex", "panel-shadow.css"), "utf8");
const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.ok(packageJSON.dependencies.react, "response stack must use React");
assert.ok(packageJSON.dependencies["react-dom"], "response stack must use react-dom");
assert.ok(packageJSON.dependencies["framer-motion"], "response stack must use Framer Motion");
assert.ok(packageJSON.scripts["build:response-stack"], "frontend build must produce the response stack bundle");

assert.ok(responseSource.includes('from "react"'), "response stack must be authored as React");
assert.ok(responseSource.includes('from "react-dom/client"'), "response stack must create React roots");
assert.ok(responseSource.includes('from "framer-motion"'), "response stack must use Framer Motion");
assert.ok(responseSource.includes("data-codex-response-stack-content"), "response stack must put activity and final content in one React-owned stack");
assert.ok(responseSource.includes("useMotionValue"), "response stack must drive reveal with Framer motion values");
assert.ok(responseSource.includes("useTransform"), "response stack must derive the reveal mask from motion progress");
assert.ok(responseSource.includes("hiddenOffset"), "response stack must compensate hidden activity height");
assert.ok(responseSource.includes("marginBottom"), "response stack must make layout contribution match the visible reveal");
assert.ok(responseSource.includes("flushSync"), "response stack must collapse layout and reset visual offset in the same frame");
assert.ok(!responseSource.includes("animateActivityFollowers"), "response stack must not hand-pick following DOM nodes");
assert.ok(!responseSource.includes("activityFollowerElements"), "response stack must not guess followers outside its React tree");
assert.ok(!responseSource.includes("codex-turn-activity-visual"), "response stack must not use the old duplicate visual layer");
assert.ok(!responseSource.includes("gridTemplateRows"), "response stack must not animate grid layout");
assert.ok(!responseSource.includes("maxHeight"), "response stack must not use max-height animation");
assert.ok(!responseSource.includes("opacity: 0"), "response stack must not use faded whole-block previews");
assert.ok(!responseSource.includes("height: \"auto\""), "response stack must not use height auto animation");
assert.ok(!responseSource.includes("transition: transitionEnabled"), "response stack must not animate layout height");
assert.ok(!responseSource.includes("cloneNode"), "response stack must not use fixed overlay clones");

assert.ok(rendererSource.includes("data-codex-response-stack"), "renderer must emit a response stack island");
assert.ok(rendererSource.includes("data-codex-response-section-template"), "renderer must pass all response sections to React templates");
assert.ok(rendererSource.includes('type: "activity"'), "renderer must represent activity as a response section");
assert.ok(rendererSource.includes("renderResponseStackTemplate"), "renderer must serialize response sections through inert templates");
assert.ok(!rendererSource.includes("data-codex-turn-activity-island"), "renderer must not emit the old activity-only island");
assert.ok(!rendererSource.includes("CodexActivityIsland"), "renderer must not unmount the old activity-only island");

assert.ok(indexSource.includes("CodexResponseStack?.mountAll"), "main panel render must mount React response stacks");
assert.ok(!indexSource.includes("CodexActivityIsland"), "main panel render must not mount activity-only islands");
assert.ok(indexHTML.includes("codex-response-stack.js"), "HTML must load the response stack bundle");
assert.ok(!indexHTML.includes("codex-activity-island.js"), "HTML must not load the old activity island bundle");

assert.ok(shadowCSS.includes(".codex-response-stack-content"), "CSS must style the response stack owner");
assert.ok(shadowCSS.includes(".codex-response-activity-content"), "CSS must style the real activity content reveal");
assert.ok(!shadowCSS.includes("transition: grid-template-rows"), "activity CSS must not animate grid layout each frame");
assert.ok(!shadowCSS.includes("grid-template-rows: 0fr"), "activity CSS must not use grid accordion layout animation");
assert.ok(!shadowCSS.includes("transition: height"), "activity CSS must not animate layout height");
assert.ok(!shadowCSS.includes("will-change: height"), "activity CSS must not promote layout height animation");
