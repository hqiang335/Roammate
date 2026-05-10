#!/usr/bin/env node
import fs from "node:fs";

function usage() {
  console.error("Usage: node validate_map.mjs map-data.json map.html");
}

const [, , dataPath, htmlPath] = process.argv;
if (!dataPath || !htmlPath) {
  usage();
  process.exit(1);
}

const issues = [];

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    issues.push(`Cannot read JSON ${path}: ${error.message}`);
    return null;
  }
}

function readText(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
    issues.push(`Cannot read HTML ${path}: ${error.message}`);
    return "";
  }
}

function nonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function hotelUrl(hotel) {
  return hotel?.booking_url || hotel?.detailUrl || hotel?.jumpUrl || hotel?.url;
}

const data = readJson(dataPath);
const html = readText(htmlPath);

if (data) {
  if (data.artifact_type !== "map-data") {
    issues.push("map-data JSON must have artifact_type='map-data'.");
  }
  if (!Array.isArray(data.pois) || data.pois.length === 0) {
    issues.push("map-data JSON must contain a non-empty pois array.");
  } else {
    const located = data.pois.filter((poi) => Array.isArray(poi.location) && poi.location.length === 2);
    if (located.length === 0) {
      issues.push("At least one POI must have a [lng, lat] location.");
    }
    if (located.length > 1 && (!Array.isArray(data.routes) || data.routes.length === 0)) {
      issues.push("Multiple located POIs require route segments.");
    }
  }
  if (Array.isArray(data.hotels)) {
    for (const [index, hotel] of data.hotels.entries()) {
      if (hotel?.error) continue;
      const label = `hotels[${index}]`;
      if (!nonEmpty(hotel?.name)) issues.push(`${label} missing hotel name.`);
      if (!nonEmpty(hotel?.price)) issues.push(`${label} missing real FlyAI price reference.`);
      if (!nonEmpty(hotelUrl(hotel))) issues.push(`${label} missing FlyAI/Feizhu booking URL.`);
      if (!nonEmpty(hotel?.tier)) issues.push(`${label} missing tier/portfolio label.`);
      if (!nonEmpty(hotel?.room_type) && !nonEmpty(hotel?.room_type_note)) {
        issues.push(`${label} missing room_type or room_type_note. Do not invent room types; record when FlyAI does not return one.`);
      }
      if (!nonEmpty(hotel?.source)) issues.push(`${label} missing source label.`);
    }
  }
}

if (html) {
  if (!html.includes("webapi.amap.com/maps")) {
    issues.push("map.html must load the Amap Web JS API.");
  }
  if (!html.includes("new AMap.Map")) {
    issues.push("map.html must initialize a real AMap.Map.");
  }
  if (html.includes("map-placeholder") || html.includes("需要高德 Web JS API Key")) {
    issues.push("map.html looks like a handwritten placeholder, not a real generated map.");
  }
  if (!html.trim().toLowerCase().endsWith("</html>")) {
    issues.push("map.html must end with </html>.");
  }
}

if (issues.length) {
  console.error("Map validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Map validation passed.");
