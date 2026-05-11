#!/usr/bin/env node
import fs from "node:fs";

function usage() {
  console.error("Usage: node validate_map.mjs map-data.json");
}

const [, , dataPath, ...extraArgs] = process.argv;
if (!dataPath || extraArgs.length) {
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

function nonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function hotelUrl(hotel) {
  return hotel?.booking_url || hotel?.detailUrl || hotel?.jumpUrl || hotel?.url;
}

function hasLocation(item) {
  if (Array.isArray(item?.location) && item.location.length === 2) return true;
  const coordinates = item?.coordinates;
  return coordinates
    && Number.isFinite(Number(coordinates.longitude ?? coordinates.lng))
    && Number.isFinite(Number(coordinates.latitude ?? coordinates.lat));
}

const data = readJson(dataPath);

if (data) {
  if (data.artifact_type !== "map-data") {
    issues.push("map-data JSON must have artifact_type='map-data'.");
  }
  if (!Array.isArray(data.pois) || data.pois.length === 0) {
    issues.push("map-data JSON must contain a non-empty pois array.");
  } else {
    const located = data.pois.filter(hasLocation);
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

if (issues.length) {
  console.error("Map validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Map validation passed.");
