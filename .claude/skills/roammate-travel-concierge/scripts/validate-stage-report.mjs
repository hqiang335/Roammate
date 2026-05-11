#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node validate-stage-report.mjs <brief|reputation> TRAVEL/{destination-date}");
}

const [, , stage, tripDirArg] = process.argv;
if (!stage || !tripDirArg) {
  usage();
  process.exit(1);
}

const tripDir = path.resolve(tripDirArg);
const issues = [];

function read(file) {
  const full = path.join(tripDir, file);
  try {
    return fs.readFileSync(full, "utf8");
  } catch (error) {
    issues.push(`Cannot read ${file}: ${error.message}`);
    return "";
  }
}

function hasHeading(text, heading) {
  return new RegExp(`^#{1,3}\\s+${heading}\\s*$`, "m").test(text);
}

function hasTableAfter(text, heading) {
  const match = new RegExp(`^#{1,3}\\s+${heading}\\s*$`, "m").exec(text);
  if (!match) return false;
  const rest = text.slice(match.index + match[0].length);
  return /\n\s*\|.+\|\s*\n\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?/.test(rest);
}

function validateBrief() {
  const text = read("destination-brief.md");
  for (const heading of ["一句话判断", "目的地概览", "最佳旅行时间", "怎么到达", "核心体验", "风险与注意"]) {
    if (!hasHeading(text, heading)) issues.push(`destination-brief.md missing heading: ${heading}`);
  }
  if (/价格|航班|高铁|酒店|门票|天气/.test(text) && !/样例|参考|预计|约|需复核|波动|代表性日期/.test(text)) {
    issues.push("destination-brief.md mentions volatile facts but does not visibly mark them as sample/reference/estimated.");
  }
}

function validateReputation() {
  const text = read("reputation.md");
  for (const heading of ["总体结论", "逐项分析"]) {
    if (!hasHeading(text, heading)) issues.push(`reputation.md missing heading: ${heading}`);
  }
  if (!hasTableAfter(text, "总体结论")) {
    issues.push("reputation.md must include a table under 总体结论.");
  }
  if (/酒店|住宿/.test(text) && !hasHeading(text, "酒店区域与候选")) {
    issues.push("reputation.md mentions lodging but is missing 酒店区域与候选.");
  }
  if (/来源信号|Key evidence|Web-Rooter|Official|Amap|FlyAI/.test(text) === false) {
    issues.push("reputation.md should include concise source signals for recommendation-sensitive judgments.");
  }
}

if (stage === "brief") {
  validateBrief();
} else if (stage === "reputation") {
  validateReputation();
} else {
  issues.push(`Unknown stage: ${stage}`);
}

if (issues.length) {
  console.error(`${stage} stage validation failed:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`${stage} stage validation passed.`);
