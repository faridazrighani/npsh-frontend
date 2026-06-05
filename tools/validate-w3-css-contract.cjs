#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = {
  css: path.join(root, "style.min.css"),
  liveParameterRepaintLockCss: path.join(root, "engineering-live-parameter-repaint-lock.css"),
  html: path.join(root, "index.html"),
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function count(text, pattern) {
  if (pattern instanceof RegExp) {
    return (text.match(pattern) || []).length;
  }
  return text.split(pattern).length - 1;
}

function findCssFunctions(text, names) {
  const results = [];
  const pattern = new RegExp(`\\b(${names.join("|")})\\(`, "g");
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    results.push({
      name: match[1],
      value: text.slice(match.index, Math.min(end, text.length)),
      index: match.index,
    });
    pattern.lastIndex = Math.max(pattern.lastIndex, end);
  }
  return results;
}

function hasUnspacedMathOperator(value) {
  const stripped = value.replace(/--[a-z0-9_-]+/gi, "customprop");
  for (let i = 0; i < stripped.length; i += 1) {
    const char = stripped[i];
    if (char !== "+" && char !== "-") continue;
    const prev = stripped[i - 1] || "";
    const next = stripped[i + 1] || "";
    const prevNonSpace = stripped.slice(0, i).trimEnd().slice(-1);
    if (!prevNonSpace || "(:,+-".includes(prevNonSpace)) continue;
    if (prev !== " " || next !== " ") return true;
  }
  return false;
}

const css = [files.css, files.liveParameterRepaintLockCss].map(read).join("\n");
const html = read(files.html);
const combined = `${css}\n${html}`;
const failures = [];

const cssOnlyChecks = [
  {
    id: "no-unprefixed-user-drag",
    count: count(css, /(?<!-)user-drag\s*:/g),
    message: "Use draggable=false or vendor-prefixed -webkit-user-drag only; unprefixed user-drag is not valid CSS.",
  },
  {
    id: "no-css-vector-effect-property",
    count: count(css, /\bvector-effect\s*:/g),
    message: "Use vector-effect as an SVG attribute, not as a CSS property in frontend CSS.",
  },
];

for (const check of cssOnlyChecks) {
  if (check.count > 0) failures.push(`${check.id}: ${check.message} Found ${check.count}.`);
}

const deprecatedChecks = [
  {
    id: "no-deprecated-word-break-break-word",
    count: count(combined, /word-break\s*:\s*break-word/g),
    message: "Use overflow-wrap:anywhere with word-break:normal instead of deprecated word-break:break-word.",
  },
  {
    id: "no-deprecated-clip-rect",
    count: count(combined, /clip\s*:\s*rect\s*\(/g),
    message: "Use clip-path:inset(50%) for visually hidden content instead of deprecated clip:rect().",
  },
];

for (const check of deprecatedChecks) {
  if (check.count > 0) failures.push(`${check.id}: ${check.message} Found ${check.count}.`);
}

const functionsToCheck = findCssFunctions(combined, ["calc", "min", "max", "clamp"]);
const unspaced = functionsToCheck.filter((entry) => hasUnspacedMathOperator(entry.value));
if (unspaced.length) {
  failures.push(
    `css-math-operator-spacing: Add whitespace around + and - inside CSS math functions. Found ${unspaced.length}: ${unspaced
      .slice(0, 5)
      .map((entry) => entry.value)
      .join(" | ")}`
  );
}

const warningSummary = {
  cssVariables: count(combined, /var\(/g),
  webkitExtensions: count(combined, /-webkit-/g),
  pointerEventsAuto: count(combined, /pointer-events\s*:\s*auto/g),
};

if (failures.length) {
  console.error("W3 CSS contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Accepted warning counters: ${JSON.stringify(warningSummary)}`);
  process.exit(1);
}

console.log("W3 CSS contract passed.");
console.log(`Accepted warning counters: ${JSON.stringify(warningSummary)}`);
