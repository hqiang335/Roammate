#!/usr/bin/env node
import fs from "node:fs";

function usage() {
  console.error("Usage: node validate-ledger.mjs [--final] research-ledger.json");
}

const args = process.argv.slice(2);
const finalMode = args.includes("--final");
const ledgerPath = args.find((arg) => arg !== "--final");

if (!ledgerPath) {
  usage();
  process.exit(1);
}

const issues = [];
let ledger = null;

try {
  ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
} catch (error) {
  console.error(`Cannot read ${ledgerPath}: ${error.message}`);
  process.exit(1);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAnyUrl(value) {
  if (!value) return false;
  if (typeof value === "string") return /^https?:\/\//.test(value) || value.includes("http://") || value.includes("https://");
  if (Array.isArray(value)) return value.some(hasAnyUrl);
  if (typeof value === "object") return Object.values(value).some(hasAnyUrl);
  return false;
}

function requireString(object, field, label) {
  if (!object[field] || typeof object[field] !== "string") {
    issues.push(`${label} missing string field '${field}'.`);
  }
}

const allowedRunStatus = new Set(["success", "failed", "discarded", "sample", "estimated"]);
const allowedFactStatus = new Set(["accepted", "discarded"]);
const allowedSourceTypes = new Set([
  "Amap verified",
  "FlyAI booking reference",
  "FlyAI semantic reference",
  "Official verified",
  "Web-Rooter cited",
  "Estimated",
]);
const allowedConfidence = new Set(["high", "medium_high", "medium", "low", "unknown"]);

if (!isObject(ledger)) {
  issues.push("Ledger root must be an object.");
} else {
  if (ledger.artifact_type !== "research-ledger") {
    issues.push("Ledger must have artifact_type='research-ledger'.");
  }
  requireString(ledger, "schema_version", "ledger");
  requireString(ledger, "generated_at", "ledger");

  if (!isObject(ledger.trip)) {
    issues.push("Ledger must include trip object.");
  } else {
    requireString(ledger.trip, "destination", "trip");
  }

  const runIds = new Set();
  for (const [index, run] of asArray(ledger.tool_runs).entries()) {
    const label = `tool_runs[${index}]`;
    if (!isObject(run)) {
      issues.push(`${label} must be an object.`);
      continue;
    }
    requireString(run, "id", label);
    requireString(run, "tool", label);
    requireString(run, "status", label);
    if (run.id) runIds.add(run.id);
    if (run.status && !allowedRunStatus.has(run.status)) {
      issues.push(`${label} has invalid status '${run.status}'.`);
    }
    if (run.summary && String(run.summary).length > 900) {
      issues.push(`${label} summary is too long; store concise summaries, not raw output.`);
    }
    if (
      finalMode
      && run.status === "success"
      && /^wr\b|web-rooter/i.test(String(run.tool || ""))
      && !hasAnyUrl(run.citations || run.source_urls || run.urls || run.references_text || run.summary)
    ) {
      issues.push(`${label} Web-Rooter run must preserve usable citations, source_urls, urls, or references_text in final mode.`);
    }
  }

  const factIds = new Set();
  const facts = asArray(ledger.facts);
  if (!Array.isArray(ledger.facts)) {
    issues.push("Ledger must include facts array.");
  }
  for (const [index, fact] of facts.entries()) {
    const label = `facts[${index}]`;
    if (!isObject(fact)) {
      issues.push(`${label} must be an object.`);
      continue;
    }
    for (const field of ["id", "subject", "category", "value", "source_type", "confidence", "freshness", "status"]) {
      requireString(fact, field, label);
    }
    if (fact.id) {
      if (factIds.has(fact.id)) {
        issues.push(`${label} duplicate id '${fact.id}'.`);
      }
      factIds.add(fact.id);
    }
    if (fact.status && !allowedFactStatus.has(fact.status)) {
      issues.push(`${label} has invalid status '${fact.status}'.`);
    }
    if (fact.source_type && !allowedSourceTypes.has(fact.source_type)) {
      issues.push(`${label} has invalid source_type '${fact.source_type}'.`);
    }
    if (fact.confidence && !allowedConfidence.has(fact.confidence)) {
      issues.push(`${label} has invalid confidence '${fact.confidence}'.`);
    }
    if (fact.source_run_id && !runIds.has(fact.source_run_id)) {
      issues.push(`${label} references missing source_run_id '${fact.source_run_id}'.`);
    }
    if (String(fact.value || "").length > 700) {
      issues.push(`${label} value is too long; keep facts concise.`);
    }
    if (finalMode && fact.status === "accepted" && fact.source_type === "Web-Rooter cited" && !hasAnyUrl(fact.source_url || fact.source_urls || fact.citations || fact.references)) {
      issues.push(`${label} Web-Rooter cited fact must include source_url/source_urls/citations/references in final mode.`);
    }
    if (finalMode && fact.status === "accepted" && fact.category === "hotel_candidate") {
      if (!hasAnyUrl(fact.booking_url || fact.detailUrl || fact.jumpUrl || fact.source_url || fact.value)) {
        issues.push(`${label} hotel_candidate must include FlyAI/Feizhu booking URL or source URL.`);
      }
      if (!hasAnyUrl(fact.booking_url || fact.detailUrl || fact.jumpUrl) && fact.source_type === "FlyAI booking reference") {
        issues.push(`${label} FlyAI hotel_candidate must include booking_url/detailUrl/jumpUrl.`);
      }
    }
    if (finalMode && fact.status === "accepted" && asArray(fact.used_by).length === 0) {
      issues.push(`${label} accepted fact must have non-empty used_by in final mode.`);
    }
    if (finalMode && fact.status === "discarded" && !fact.discard_reason) {
      issues.push(`${label} discarded fact must include discard_reason in final mode.`);
    }
  }
}

if (issues.length) {
  console.error("Research ledger validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Research ledger validation passed${finalMode ? " (final)" : ""}.`);
