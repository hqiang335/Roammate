#!/usr/bin/env node
import fs from "node:fs";

const input = fs.readFileSync(0, "utf8").trim();
const limit = Number(process.env.WR_COMPACT_LIMIT || 3);
const textLimit = Number(process.env.WR_COMPACT_TEXT_CHARS || 800);

function trimText(value, max = textLimit) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { success: false, error: "Could not parse Web-Rooter JSON output.", raw_preview: trimText(raw, 500) };
  }
}

function compactResult(result) {
  return {
    title: trimText(result?.title, 120),
    url: result?.url || "",
    rank: result?.rank,
    engine: result?.engine,
    citation_id: result?.metadata?.citation_id || result?.citation_id || "",
  };
}

function compactCitation(citation) {
  return {
    id: citation?.id || "",
    title: trimText(citation?.title, 120),
    url: citation?.url || "",
    domain: citation?.domain || "",
  };
}

function compactCrawl(item) {
  return {
    title: trimText(item?.title, 120),
    url: item?.url || "",
    text_preview: trimText(item?.content || item?.text || item?.content_preview || "", textLimit),
  };
}

const payload = parsePayload(input);

const output = {
  success: Boolean(payload.success),
  query: payload.query || "",
  error: payload.error || payload.systemMessage || "",
  results: Array.isArray(payload.results) ? payload.results.slice(0, limit).map(compactResult) : [],
  citations: Array.isArray(payload.citations) ? payload.citations.slice(0, limit).map(compactCitation) : [],
  crawled_content: Array.isArray(payload.crawled_content) ? payload.crawled_content.slice(0, 1).map(compactCrawl) : [],
  visit: payload.data ? {
    title: trimText(payload.data.title || payload.title, 120),
    url: payload.data.url || payload.url || "",
    text_preview: trimText(payload.data.text || payload.content || payload.content_preview || "", textLimit),
  } : undefined,
};

if (!output.visit) delete output.visit;
if (!output.results.length) delete output.results;
if (!output.citations.length) delete output.citations;
if (!output.crawled_content.length) delete output.crawled_content;

console.log(JSON.stringify(output, null, 2));
