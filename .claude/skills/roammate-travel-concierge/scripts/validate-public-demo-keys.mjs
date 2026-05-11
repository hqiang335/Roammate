#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const travelDir = path.join(root, "TRAVEL");
const DEMO_AMAP_WEB_JS_KEY = "fbb979dc813d025582af9ec422d33750";
const DEMO_AMAP_SECURITY_JS_CODE = "e244a2946f6a6943e42edf7f9e363133";
const issues = [];

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name === "guidebook.html") output.push(full);
  }
  return output;
}

function relative(file) {
  return path.relative(root, file);
}

for (const file of walk(travelDir)) {
  const html = fs.readFileSync(file, "utf8");
  const scriptKeys = [...html.matchAll(/webapi\.amap\.com\/maps\?[^"'<>\s]*\bkey=([a-f0-9]{32})/gi)]
    .map((match) => match[1]);
  const atlasKeys = [...html.matchAll(/"amapKey"\s*:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter(Boolean);
  const securityCodes = [...html.matchAll(/securityJsCode\s*:\s*"([^"]+)"/g)]
    .map((match) => match[1]);
  const keys = [...new Set([...scriptKeys, ...atlasKeys])];

  for (const key of keys) {
    if (key !== DEMO_AMAP_WEB_JS_KEY) {
      issues.push(`${relative(file)} uses non-demo Amap Web JS API key: ${key}`);
    }
  }
  if (scriptKeys.length && !securityCodes.length) {
    issues.push(`${relative(file)} loads Amap Web JS API without roammate-demo securityJsCode.`);
  }
  for (const code of new Set(securityCodes)) {
    if (code !== DEMO_AMAP_SECURITY_JS_CODE) {
      issues.push(`${relative(file)} uses non-demo Amap securityJsCode.`);
    }
  }
}

if (issues.length) {
  console.error("Public demo key validation failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Public demo key validation passed.");
