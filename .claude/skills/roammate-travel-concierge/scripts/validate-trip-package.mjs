#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error("Usage: node validate-trip-package.mjs TRAVEL/{destination-date}");
}

const [, , tripDir] = process.argv;
if (!tripDir) {
  usage();
  process.exit(1);
}

const root = process.cwd();
const issues = [];

function exists(file) {
  return fs.existsSync(path.join(tripDir, file));
}

function readJson(file) {
  const full = path.join(tripDir, file);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    issues.push(`Cannot read ${file}: ${error.message}`);
    return null;
  }
}

function readText(file) {
  const full = path.join(tripDir, file);
  try {
    return fs.readFileSync(full, "utf8");
  } catch (error) {
    issues.push(`Cannot read ${file}: ${error.message}`);
    return "";
  }
}

function runValidator(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    issues.push(`${label} failed:\n${(result.stderr || result.stdout || "").trim()}`);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function splitMarkdownRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => stripMarkdown(cell.trim()));
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ""));
}

function parseMarkdownTable(block) {
  const lines = String(block || "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line, index) => line.trim().startsWith("|") && lines[index + 1] && isTableSeparator(lines[index + 1]));
  if (headerIndex < 0) return [];
  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows = [];
  for (const rawLine of lines.slice(headerIndex + 2)) {
    if (!rawLine.trim().startsWith("|")) break;
    if (isTableSeparator(rawLine)) continue;
    const cells = splitMarkdownRow(rawLine);
    if (cells.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }
  return rows;
}

function parseAllMarkdownTables(block) {
  const lines = String(block || "").split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].trim().startsWith("|") || !isTableSeparator(lines[index + 1])) continue;
    const headers = splitMarkdownRow(lines[index]);
    const rows = [];
    let cursor = index + 2;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim().startsWith("|")) break;
      if (isTableSeparator(line)) continue;
      const cells = splitMarkdownRow(line);
      if (cells.length !== headers.length) continue;
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
    }
    if (rows.length) tables.push(rows);
    index = Math.max(index, cursor - 1);
  }
  return tables;
}

function clockMinutes(value) {
  const match = String(value || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function sourceItineraryDays(text) {
  const matches = [...String(text || "").matchAll(/^###\s+Day\s+(\d+).*$/gm)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const block = text.slice(match.index, next?.index ?? text.length);
    const rows = parseMarkdownTable(block);
    return {
      day: Number(match[1]),
      rows,
      activities: rows
        .map((row) => row["安排"] || row["活动"] || row["内容"])
        .map(stripMarkdown)
        .filter(Boolean),
    };
  });
}

function returnFlightReferences(text) {
  const refs = [];
  for (const rows of parseAllMarkdownTables(text)) {
    for (const row of rows) {
      const codeText = row["班次/车次"] || row["班次"] || row["航班"] || row["车次"] || row["安排"] || "";
      const code = String(codeText).match(/\b[A-Z]{1,3}\d{3,5}\b/)?.[0];
      const direction = `${row["方向"] || ""} ${row["路线"] || ""} ${row["安排"] || ""}`;
      const dep = clockMinutes(row["出发"] || row["起飞"] || row["时间"] || "");
      if (code && dep !== null && /返程|回程|返回|乌鲁木齐.*北京|目的地.*出发/.test(direction)) {
        refs.push({ code, dep, direction: stripMarkdown(direction) });
      }
    }
  }
  return refs;
}

function compactName(value) {
  return stripMarkdown(value)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,、\s/·.-]/g, "")
    .toLowerCase();
}

function mapRelevantActivityName(title) {
  const text = stripMarkdown(title)
    .replace(/\b[A-Z]{1,3}\d{3,5}\b/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,].*$/, "");
  if (!text || /早餐|午餐|晚餐|夜宵|餐食|休息|自由活动|取行李|寄存行李|退房|午休|游船体验|乘区间车|包车返回|继续/.test(text)) return "";
  const parts = text.split(/→|到|至/).map((part) => part
    .replace(/^(抵达|前往|游览|参观|打卡|夜游|返回|出发前往|出发|办理入住)/, "")
    .replace(/(出发|抵达|夜游|游览|参观|打卡|开园即入|购票入园|购票乘区间车|办理入住|休息|自由活动|逛街购物|午餐|晚餐|早餐).*$/, "")
    .trim());
  return parts.find((part) => part && !/^(酒店|市区酒店|酒店附近|附近|基地附近|景区内|市区|成都市区|乌鲁木齐|天池湖边|天鹅湖环湖徒步|照壁山\/林间栈道|哈萨克毡房文化体验)$/.test(part)) || "";
}

function hotelUrl(hotel) {
  return hotel?.bookingUrl || hotel?.booking_url || hotel?.detailUrl || hotel?.jumpUrl || hotel?.url;
}

function guideHotels(data) {
  const payload = data?.hotels || data?.accommodation?.hotels;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object") return asArray(payload.options || payload.items || payload.hotels);
  return [];
}

const requiredReading = ["destination-brief.md", "reputation.md", "itinerary.md"];
for (const file of requiredReading) {
  if (!exists(file)) issues.push(`Missing ${file}.`);
}
if (exists("destination-brief.md")) {
  runValidator(
    "Destination brief validation",
    "node",
    [".claude/skills/roammate-travel-concierge/scripts/validate-stage-report.mjs", "brief", tripDir],
  );
}
if (exists("reputation.md")) {
  runValidator(
    "Reputation validation",
    "node",
    [".claude/skills/roammate-travel-concierge/scripts/validate-stage-report.mjs", "reputation", tripDir],
  );
}
const itineraryText = exists("itinerary.md") ? readText("itinerary.md") : "";
const itineraryDays = sourceItineraryDays(itineraryText);
if (itineraryText && !itineraryDays.length) {
  issues.push("itinerary.md must include parseable ### Day N daily itinerary sections.");
}
if (itineraryText && itineraryDays.length) {
  const lastDay = itineraryDays[itineraryDays.length - 1];
  const returnFlights = returnFlightReferences(itineraryText);
  for (const flight of returnFlights) {
    for (const row of lastDay.rows || []) {
      const rowTime = clockMinutes(row["时间"]);
      const rowText = stripMarkdown(`${row["安排"] || ""} ${row["备注"] || ""}`);
      if (
        rowTime !== null
        && rowTime > flight.dep - 45
        && /值机|前往.*机场|去机场|出发.*机场|机场.*办理/.test(rowText)
      ) {
        issues.push(`itinerary.md schedules airport prep after or too close to return flight ${flight.code} departure: ${row["时间"]} ${rowText}`);
      }
    }
  }
}

let itineraryStructured = null;
if (!exists("itinerary-structured.json")) {
  issues.push("Missing itinerary-structured.json.");
} else {
  itineraryStructured = readJson("itinerary-structured.json");
  runValidator(
    "Itinerary structured validation",
    "node",
    [".claude/skills/itinerary-planner/scripts/validate-itinerary-structured.mjs", tripDir],
  );
}

const obsoleteArtifacts = [
  "itinerary-data.json",
  "map.html",
  "pois.json",
  "sources.md",
  "guidebook.pdf",
];
for (const file of obsoleteArtifacts) {
  if (exists(file)) issues.push(`Obsolete artifact should not be generated: ${file}.`);
}

let ledger = null;
if (!exists("research-ledger.json")) {
  issues.push("Missing research-ledger.json.");
} else {
  ledger = readJson("research-ledger.json");
  runValidator(
    "Research ledger final validation",
    "node",
    [".claude/skills/roammate-travel-concierge/scripts/validate-ledger.mjs", "--final", path.join(tripDir, "research-ledger.json")],
  );
}

let mapData = null;
if (exists("map-data.json")) {
  mapData = readJson("map-data.json");
  runValidator(
    "Map data validation",
    "node",
    [".claude/skills/map-route-builder/scripts/validate_map.mjs", path.join(tripDir, "map-data.json")],
  );
} else {
  issues.push("Missing map-data.json.");
}

const guidebookData = exists("guidebook-data.json") ? readJson("guidebook-data.json") : null;
if (!guidebookData) {
  issues.push("Missing guidebook-data.json.");
}
if (exists("guidebook-data.json") && exists("guidebook.html")) {
  runValidator(
    "Guidebook validation",
    "node",
    [".claude/skills/guidebook-maker/scripts/validate-guidebook.mjs", path.join(tripDir, "guidebook-data.json"), path.join(tripDir, "guidebook.html")],
  );
  runValidator(
    "Guidebook browser QA",
    "node",
    [".claude/skills/guidebook-maker/scripts/qa-guidebook.mjs", path.join(tripDir, "guidebook.html")],
  );
} else {
  issues.push("Missing guidebook.html or guidebook-data.json.");
}

if (exists("guidebook.html")) {
  const html = readText("guidebook.html");
  if (html.includes("Write failed") || html.includes("```") || html.includes("<tool_use_error>")) {
    issues.push("guidebook.html contains generation leftovers.");
  }
}

if (guidebookData && itineraryDays.length) {
  const guideDays = Array.isArray(guidebookData.days) ? guidebookData.days : guidebookData.itinerary?.days;
  if (!Array.isArray(guideDays) || guideDays.length !== itineraryDays.length) {
    issues.push("guidebook-data.json should preserve the itinerary day count.");
  }
  const itineraryPoiCount = itineraryDays.reduce((count, day) => count + asArray(day.activities).length, 0);
  const guideActivityCount = asArray(guideDays).reduce((count, day) => count + asArray(day.activities || day.timeline || day.pois).length, 0);
  if (itineraryPoiCount && !guideActivityCount) {
    issues.push("guidebook-data.json preserves day headings but drops all itinerary activities/POIs.");
  }
}

if (guidebookData && mapData) {
  const hotelsInGuide = guideHotels(guidebookData);
  for (const [index, hotel] of hotelsInGuide.entries()) {
    const label = `guidebook-data hotels[${index}]`;
    if (!hotelUrl(hotel)) issues.push(`${label} missing FlyAI/Feizhu booking URL.`);
    if (!(hotel.price || hotel.priceReference || hotel.price_ref)) issues.push(`${label} missing price reference.`);
    if (!(hotel.roomType || hotel.room_type || hotel.roomTypeNote || hotel.room_type_note)) {
      issues.push(`${label} missing room type/status.`);
    }
  }
}

if (guidebookData && ledger) {
  const factIds = new Set((ledger.facts || []).map((fact) => String(fact.id || "")));
  for (const factId of guidebookData.sourceFactIds || []) {
    if (!factIds.has(String(factId))) {
      issues.push(`guidebook-data.json references missing ledger fact id: ${factId}`);
    }
  }
}

if (mapData && itineraryDays.length) {
  const itineraryPoiNames = new Set();
  for (const day of itineraryDays) {
    for (const title of day.activities || []) {
      const name = mapRelevantActivityName(title);
      if (name) itineraryPoiNames.add(name);
    }
  }
  const mappedOriginals = new Set((mapData.pois || []).flatMap((poi) => [
    compactName(poi.original_name || poi.name || ""),
    compactName(poi.name || ""),
  ]).filter(Boolean));
  const missing = [...itineraryPoiNames].filter((name) => {
    const key = compactName(name);
    return key && ![...mappedOriginals].some((mapped) => key.includes(mapped) || mapped.includes(key));
  });
  if (itineraryPoiNames.size && missing.length > Math.ceil(itineraryPoiNames.size / 2)) {
    issues.push(`More than half of itinerary POIs are absent from map-data.json: ${missing.slice(0, 5).join(", ")}`);
  }
}

if (issues.length) {
  console.error("Trip package validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Trip package validation passed.");
