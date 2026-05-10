#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error("Usage: node finalize-trip-package.mjs TRAVEL/{destination-date}");
}

const [, , tripDir] = process.argv;
if (!tripDir) {
  usage();
  process.exit(1);
}

const root = process.cwd();
const fullTripDir = path.resolve(root, tripDir);

function has(file) {
  return fs.existsSync(path.join(fullTripDir, file));
}

function fail(message, hints = []) {
  console.error(`Finalization blocked: ${message}`);
  for (const hint of hints) console.error(`- ${hint}`);
  process.exit(1);
}

if (!fs.existsSync(fullTripDir) || !fs.statSync(fullTripDir).isDirectory()) {
  fail(`trip directory does not exist: ${tripDir}`);
}

const missingBeforeFinal = [];
for (const file of ["guidebook-data.json", "guidebook.html"]) {
  if (!has(file)) missingBeforeFinal.push(file);
}

if (missingBeforeFinal.length) {
  fail(
    `missing final guidebook artifact(s): ${missingBeforeFinal.join(", ")}`,
    [
      "Do not treat sources.md as final delivery.",
      "Create guidebook-data.json from the researched trip facts.",
      "Run: node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs " +
        `${tripDir}/guidebook-data.json ${tripDir}/guidebook.html`,
      "Then rerun: npm run finalize:trip -- " + tripDir,
    ],
  );
}

if (!has("research-ledger.json")) {
  fail("missing research-ledger.json", ["The source ledger must exist before final package validation."]);
}

const sourceResult = spawnSync(
  "node",
  [
    ".claude/skills/roammate-travel-concierge/scripts/generate-sources.mjs",
    path.join(tripDir, "research-ledger.json"),
    path.join(tripDir, "sources.md"),
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);

if (sourceResult.status !== 0) {
  fail("source index generation failed", ["Fix research-ledger.json, then rerun finalize:trip."]);
}

const validationResult = spawnSync(
  "node",
  [".claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs", tripDir],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);

if (validationResult.status !== 0) {
  fail("trip package validation failed", ["Fix every validation issue before final delivery."]);
}

console.log("Final trip package is ready.");
