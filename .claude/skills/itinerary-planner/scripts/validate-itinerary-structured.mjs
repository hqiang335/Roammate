#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node validate-itinerary-structured.mjs TRAVEL/{destination-date}");
  console.error("   or: node validate-itinerary-structured.mjs TRAVEL/{destination-date}/itinerary-structured.json");
}

const [, , inputArg] = process.argv;
if (!inputArg) {
  usage();
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const inputIsJson = path.basename(inputPath) === "itinerary-structured.json";
const tripDir = inputIsJson ? path.dirname(inputPath) : inputPath;
const dataPath = inputIsJson ? inputPath : path.join(tripDir, "itinerary-structured.json");
const itineraryPath = path.join(tripDir, "itinerary.md");
const issues = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    issues.push(`Cannot read ${path.basename(file)}: ${error.message}`);
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function stripMarkdown(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectTextValues(value, output = []) {
  if (value === undefined || value === null) return output;
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTextValues(item, output);
    return output;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectTextValues(item, output);
  }
  return output;
}

function splitMarkdownRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => stripMarkdown(cell.trim()));
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ""));
}

function parseFirstTable(block) {
  const lines = String(block || "").split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].trim().startsWith("|") || !isTableSeparator(lines[index + 1])) continue;
    const headers = splitMarkdownRow(lines[index]);
    const rows = [];
    let cursor = index + 2;
    for (; cursor < lines.length; cursor += 1) {
      if (!lines[cursor].trim().startsWith("|")) break;
      if (isTableSeparator(lines[cursor])) continue;
      const cells = splitMarkdownRow(lines[cursor]);
      if (cells.length === headers.length) {
        rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
      }
    }
    return rows;
  }
  return [];
}

function sourceDays(text) {
  const matches = [...String(text || "").matchAll(/^###\s+Day\s+(\d+).*$/gm)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const block = text.slice(match.index, next?.index ?? text.length);
    const rows = parseFirstTable(block);
    return {
      day: Number(match[1]),
      rows,
      activities: rows.map((row) => row["安排"] || row["活动"] || row["内容"]).filter(Boolean),
    };
  });
}

function markdownUrls(text) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s)）]+/g)]
    .map((match) => match[0].replace(/[。。，，；;、]+$/, ""));
}

function transportCodes(text) {
  return [...new Set([...String(text || "").matchAll(/\b(?:[A-Z]{1,3}\d{3,5}|[GDC]\d{1,5})\b/g)].map((match) => match[0]))];
}

function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return String(value || "").trim().length > 0;
}

const data = readJson(dataPath);
const itineraryText = readText(itineraryPath);

if (data) {
  if (data.artifact_type !== "itinerary-structured") {
    issues.push("itinerary-structured.json must have artifact_type='itinerary-structured'.");
  }
  if (!data.source?.file || data.source.file !== "itinerary.md") {
    issues.push("itinerary-structured.json must identify itinerary.md as its source file.");
  }
  if (!Array.isArray(data.days) || !data.days.length) {
    issues.push("itinerary-structured.json must include non-empty days.");
  }
  const labels = ["今日餐食", "休息与补给", "核心体验/首推项目", "预算估算", "预约提醒", "雨天/疲劳备用"];
  for (const day of data.days || []) {
    const label = `Day ${day?.day || "?"}`;
    if (!day?.rawMarkdown) issues.push(`${label}: missing rawMarkdown source block.`);
    if (!Array.isArray(day?.timelineRows) || !day.timelineRows.length) {
      issues.push(`${label}: missing timelineRows from itinerary.md table.`);
    }
    for (const [index, row] of (day?.timelineRows || []).entries()) {
      const rowLabel = `${label} timelineRows[${index}]`;
      if (!hasContent(row?.cells?.["安排"] || row?.cells?.["活动"] || row?.cells?.["内容"])) {
        issues.push(`${rowLabel}: missing activity/arrangement cell.`);
      }
      if (!row?.rawMarkdown) issues.push(`${rowLabel}: missing rawMarkdown row.`);
    }
    for (const dailyLabel of labels) {
      if (!hasContent(day?.dailyDetails?.[dailyLabel])) {
        issues.push(`${label}: missing daily detail field ${dailyLabel}.`);
      }
    }
  }
  if (!hasContent(data.sections?.budget)) {
    issues.push("itinerary-structured.json should preserve the budget table from itinerary.md.");
  }
  if (!hasContent(data.sections?.transportAndLodging)) {
    issues.push("itinerary-structured.json should preserve transport/lodging section structure from itinerary.md.");
  }
}

if (data && itineraryText) {
  const source = sourceDays(itineraryText);
  if (source.length && source.length !== (data.days || []).length) {
    issues.push(`Day count mismatch: itinerary.md has ${source.length}, itinerary-structured.json has ${(data.days || []).length}.`);
  }
  const dataText = collectTextValues(data).join("\n");
  for (const day of source) {
    for (const activity of day.activities) {
      if (activity && !dataText.includes(activity)) {
        issues.push(`Structured itinerary missing source activity from Day ${day.day}: ${activity}`);
      }
    }
  }
  for (const url of markdownUrls(itineraryText)) {
    if (!dataText.includes(url)) {
      issues.push(`Structured itinerary missing URL from itinerary.md: ${url}`);
    }
  }
  for (const code of transportCodes(itineraryText)) {
    if (!dataText.includes(code)) {
      issues.push(`Structured itinerary missing transport code from itinerary.md: ${code}`);
    }
  }
}

if (issues.length) {
  console.error("Itinerary structured validation failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Itinerary structured validation passed.");
