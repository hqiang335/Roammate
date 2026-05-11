#!/usr/bin/env node
import fs from "node:fs";

const mode = process.argv[2] || "auto";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Number.parseInt(limitArg?.split("=")[1] || "5", 10);
const raw = fs.readFileSync(0, "utf8").trim();

function trimText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function parseJsonInput(value) {
  try {
    return JSON.parse(value);
  } catch {
    const firstObject = value.indexOf("{");
    const lastObject = value.lastIndexOf("}");
    const firstArray = value.indexOf("[");
    const lastArray = value.lastIndexOf("]");
    const objectCandidate = firstObject >= 0 && lastObject > firstObject ? value.slice(firstObject, lastObject + 1) : "";
    const arrayCandidate = firstArray >= 0 && lastArray > firstArray ? value.slice(firstArray, lastArray + 1) : "";
    for (const candidate of [objectCandidate, arrayCandidate]) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next candidate.
      }
    }
  }
  return null;
}

function fail(error) {
  console.log(JSON.stringify({ success: false, error, raw_preview: trimText(raw) }, null, 2));
  process.exitCode = 1;
}

if (!raw) {
  fail("Empty FlyAI output.");
  process.exit();
}

const parsed = parseJsonInput(raw);
if (!parsed) {
  fail("Could not parse FlyAI JSON output.");
  process.exit();
}

function itemList(root) {
  return asArray(
    Array.isArray(root) ? root
      : root?.data?.itemList
      || root?.data?.list
      || root?.data?.items
      || root?.itemList
      || root?.list
      || root?.items
      || root?.data
  );
}

function firstSegment(item) {
  return item?.journeys?.[0]?.segments?.[0] || item?.segments?.[0] || item;
}

function compactTransport(item) {
  const seg = firstSegment(item);
  return {
    code: firstPresent(seg?.marketingTransportNo, seg?.transportNo, seg?.flightNo, seg?.trainNo, item?.flightNo, item?.trainNo, ""),
    carrier: firstPresent(seg?.marketingTransportName, seg?.carrierName, seg?.airlineName, seg?.trainType, item?.airlineName, ""),
    dep: firstPresent(seg?.depDateTime, seg?.departTime, seg?.depTime, item?.departTime, ""),
    dep_station: firstPresent(seg?.depStationShortName, seg?.depStationName, seg?.depStationCode, item?.depStationName, ""),
    arr: firstPresent(seg?.arrDateTime, seg?.arriveTime, seg?.arrTime, item?.arriveTime, ""),
    arr_station: firstPresent(seg?.arrStationShortName, seg?.arrStationName, seg?.arrStationCode, item?.arrStationName, ""),
    duration_minutes: firstPresent(seg?.duration, item?.totalDuration, item?.duration, ""),
    price: firstPresent(item?.ticketPrice, item?.price, item?.lowestPrice, seg?.price, ""),
    url: firstPresent(item?.jumpUrl, item?.bookingUrl, item?.booking_url, item?.detailUrl, item?.url, "")
  };
}

function compactHotel(item) {
  return {
    name: firstPresent(item?.name, item?.hotelName, item?.title, ""),
    star: firstPresent(item?.star, item?.starLevel, ""),
    area: firstPresent(item?.businessDistrict, item?.districtName, item?.interestsPoi, item?.address, ""),
    address: firstPresent(item?.address, ""),
    price: firstPresent(item?.price, item?.lowestPrice, item?.ticketPrice, ""),
    url: firstPresent(item?.detailUrl, item?.jumpUrl, item?.bookingUrl, item?.url, ""),
    image: firstPresent(item?.mainPic, item?.image, item?.cover, ""),
    longitude: firstPresent(item?.longitude, item?.lng, ""),
    latitude: firstPresent(item?.latitude, item?.lat, "")
  };
}

function compactPoi(item) {
  return {
    name: firstPresent(item?.name, item?.title, ""),
    category: firstPresent(item?.category, item?.poiLevel, ""),
    address: firstPresent(item?.address, ""),
    ticket: firstPresent(item?.ticketInfo, item?.price, ""),
    url: firstPresent(item?.jumpUrl, item?.detailUrl, item?.url, ""),
    image: firstPresent(item?.mainPic, item?.image, item?.cover, ""),
    longitude: firstPresent(item?.longitude, item?.lng, ""),
    latitude: firstPresent(item?.latitude, item?.lat, ""),
    note: trimText(firstPresent(item?.description, item?.freePoiStatus, ""), 180)
  };
}

function compactAiSearch(root) {
  const data = root?.data;
  const text = firstPresent(
    typeof data === "string" ? data : "",
    data?.answer,
    data?.content,
    data?.summary,
    data?.result,
    root?.answer,
    root?.content,
    root?.summary,
    root?.result,
    ""
  );
  return { summary: trimText(text, 1800) };
}

let items = [];
if (mode === "flight" || mode === "train" || mode === "transport") {
  items = itemList(parsed).slice(0, limit).map(compactTransport);
} else if (mode === "hotel" || mode === "hotels") {
  items = itemList(parsed).slice(0, limit).map(compactHotel);
} else if (mode === "poi" || mode === "pois") {
  items = itemList(parsed).slice(0, limit).map(compactPoi);
} else if (mode === "ai" || mode === "ai-search") {
  console.log(JSON.stringify({ success: true, mode, ...compactAiSearch(parsed) }, null, 2));
  process.exit();
} else {
  items = itemList(parsed).slice(0, limit);
}

console.log(JSON.stringify({ success: true, mode, count: items.length, items }, null, 2));
