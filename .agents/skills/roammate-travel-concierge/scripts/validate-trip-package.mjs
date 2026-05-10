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

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

const itineraryData = exists("itinerary-data.json") ? readJson("itinerary-data.json") : null;
if (!itineraryData) {
  issues.push("Missing itinerary-data.json.");
} else if (!Array.isArray(itineraryData.days) || itineraryData.days.length === 0) {
  issues.push("itinerary-data.json must include non-empty days array.");
}

let mapData = null;
if (exists("map-data.json") && exists("map.html")) {
  mapData = readJson("map-data.json");
  runValidator(
    "Map validation",
    "node",
    [".claude/skills/map-route-builder/scripts/validate_map.mjs", path.join(tripDir, "map-data.json"), path.join(tripDir, "map.html")],
  );
  if (exists("pois.json")) {
    const legacy = readJson("pois.json");
    if (legacy && mapData && !sameJson(legacy, mapData)) {
      issues.push("pois.json must match map-data.json while kept as V1 legacy alias.");
    }
  }
} else if (!exists("map-error.md")) {
  issues.push("Need either valid map-data.json + map.html or map-error.md.");
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

if (!exists("sources.md")) {
  issues.push("Missing sources.md.");
}

if (exists("map.html")) {
  const html = readText("map.html");
  if (html.includes("map-placeholder") || html.includes("需要高德 Web JS API Key")) {
    issues.push("map.html appears to be a placeholder.");
  }
}

if (exists("guidebook.html")) {
  const html = readText("guidebook.html");
  if (html.includes("Write failed") || html.includes("```") || html.includes("<tool_use_error>")) {
    issues.push("guidebook.html contains generation leftovers.");
  }
}

if (guidebookData && itineraryData) {
  const guideDays = Array.isArray(guidebookData.days) ? guidebookData.days : guidebookData.itinerary?.days;
  if (!Array.isArray(guideDays) || guideDays.length !== itineraryData.days.length) {
    issues.push("guidebook-data.json should preserve the itinerary day count.");
  }
  const itineraryPoiCount = (itineraryData.days || []).reduce((count, day) => count + asArray(day.pois || day.activities).length, 0);
  const guideActivityCount = asArray(guideDays).reduce((count, day) => count + asArray(day.activities || day.timeline || day.pois).length, 0);
  if (itineraryPoiCount && !guideActivityCount) {
    issues.push("guidebook-data.json preserves day headings but drops all itinerary activities/POIs.");
  }
}

if (guidebookData && mapData) {
  const mapHotels = asArray(mapData.hotels).filter((hotel) => hotel && !hotel.error);
  const hotelsInGuide = guideHotels(guidebookData);
  if (mapHotels.length && !hotelsInGuide.length) {
    issues.push("map-data.json contains hotel candidates, but guidebook-data.json does not preserve them.");
  }
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

if (mapData && itineraryData) {
  const itineraryPoiNames = new Set();
  for (const day of itineraryData.days || []) {
    for (const poi of day.pois || day.activities || []) {
      if (poi?.name) itineraryPoiNames.add(String(poi.name));
      if (poi?.title) itineraryPoiNames.add(String(poi.title));
    }
  }
  const mappedOriginals = new Set((mapData.pois || []).map((poi) => String(poi.original_name || poi.name || "")));
  const missing = [...itineraryPoiNames].filter((name) => name && !mappedOriginals.has(name));
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
