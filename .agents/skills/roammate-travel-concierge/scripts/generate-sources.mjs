#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node generate-sources.mjs TRAVEL/{destination-date}/research-ledger.json [sources.md]");
}

const [, , ledgerPath, outputPathArg] = process.argv;
if (!ledgerPath) {
  usage();
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractUrls(value, output = new Set()) {
  if (!value) return output;
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s)\]}>"']+/g)) {
      output.add(match[0]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) extractUrls(item, output);
  } else if (typeof value === "object") {
    for (const nested of Object.values(value)) extractUrls(nested, output);
  }
  return output;
}

function sourceTitle(source, fallback) {
  if (!source || typeof source !== "object") return fallback;
  return source.title || source.name || source.label || source.id || fallback;
}

function bullet(label, detail, urls) {
  const uniqueUrls = [...extractUrls(urls)];
  const linkText = uniqueUrls.length ? uniqueUrls.map((url) => `<${url}>`).join(" ") : "无URL";
  return `- **${label}**${detail ? `：${detail}` : ""} ${linkText}`;
}

const ledger = readJson(ledgerPath);
const outputPath = outputPathArg || path.join(path.dirname(ledgerPath), "sources.md");
const lines = [];

lines.push(`# ${ledger.trip?.destination || "旅行"}来源索引`);
lines.push("");
lines.push(`Generated from \`${path.basename(ledgerPath)}\` on ${ledger.generated_at || new Date().toISOString().slice(0, 10)}.`);
lines.push("");

lines.push("## 工具调用");
for (const run of asArray(ledger.tool_runs)) {
  const urls = extractUrls([run.citations, run.source_urls, run.urls, run.references_text, run.summary]);
  const detail = [run.tool, run.query, run.source_label, run.status].filter(Boolean).join(" | ");
  lines.push(bullet(run.id || "tool_run", detail, [...urls]));
}
lines.push("");

lines.push("## 采纳事实");
for (const fact of asArray(ledger.facts).filter((item) => item?.status !== "discarded")) {
  const urls = extractUrls([
    fact.source_url,
    fact.source_urls,
    fact.citations,
    fact.references,
    fact.booking_url,
    fact.detailUrl,
    fact.jumpUrl,
    fact.value,
  ]);
  const detail = [fact.subject, fact.category, fact.source_type, fact.confidence].filter(Boolean).join(" | ");
  lines.push(bullet(fact.id || "fact", detail, [...urls]));
}
lines.push("");

lines.push("## 原始引用");
for (const run of asArray(ledger.tool_runs)) {
  for (const citation of asArray(run.citations)) {
    const label = sourceTitle(citation, run.id || "citation");
    lines.push(bullet(label, citation.snippet || citation.source || "", citation.url || citation));
  }
}
lines.push("");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.error(JSON.stringify({ output: outputPath, bytes: fs.statSync(outputPath).size }, null, 2));
