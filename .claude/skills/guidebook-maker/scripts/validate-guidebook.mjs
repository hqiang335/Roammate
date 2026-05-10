#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node validate-guidebook.mjs guidebook-data.json guidebook.html");
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

function readOptionalText(file) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  } catch {
    return "";
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getHotels(data) {
  const payload = data?.hotels || data?.accommodation?.hotels;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object") return asArray(payload.options || payload.items || payload.hotels);
  return [];
}

function getDays(data) {
  return asArray(data?.days || data?.itinerary?.days);
}

function getPoiExperiences(data) {
  const explicit = asArray(data?.poiExperiences || data?.poi_experiences || data?.experienceCards || data?.pois);
  if (explicit.length) return explicit;
  const fromDays = [];
  for (const day of getDays(data)) {
    for (const poi of asArray(day?.pois)) {
      if (poi?.name) fromDays.push(poi);
    }
  }
  return fromDays;
}

function hasContent(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasContent);
  return String(value).trim().length > 0;
}

function hotelUrl(hotel) {
  return hotel?.bookingUrl || hotel?.booking_url || hotel?.detailUrl || hotel?.jumpUrl || hotel?.url;
}

function transportUrl(item) {
  return item?.url || item?.bookingUrl || item?.booking_url || item?.ticketUrl || item?.ticket_url || item?.detailUrl || item?.jumpUrl;
}

function getTransportItems(data) {
  const transport = data?.transport || {};
  return [
    ...asArray(transport.items || transport.routes),
    ...asArray(transport.flights),
    ...asArray(transport.trains),
    ...asArray(transport.local),
    ...asArray(data?.routes),
  ].filter(Boolean);
}

function getBudgetRows(data) {
  const budget = data?.budget || {};
  return asArray(budget.items || budget.rows || data?.budgetItems)
    .filter((row) => row?.item || row?.name || row?.category || row?.label);
}

function markdownUrls(text) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s)）]+/g)]
    .map((match) => match[0].replace(/[。。，，；;、]+$/, ""));
}

function hotelRoomType(hotel) {
  return hotel?.roomType || hotel?.room_type || hotel?.roomTypeNote || hotel?.room_type_note;
}

function hotelPrice(hotel) {
  return hotel?.price || hotel?.priceReference || hotel?.price_ref;
}

function numberFromCurrency(value) {
  const match = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function tripNights(data) {
  const raw = String(data?.duration || data?.trip?.duration || "");
  const match = raw.match(/(\d+)\s*夜/);
  return match ? Number(match[1]) : null;
}

function atlasDataFromHtml(html) {
  const match = html.match(/window\.__ROAMMATE_ATLAS__\s*=\s*(.*?);<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
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

function sourceDocuments(dataPath) {
  const dir = path.dirname(dataPath);
  return [
    { file: "destination-brief.md", title: "完整目的地简报" },
    { file: "itinerary.md", title: "完整行程原文" },
    { file: "reputation.md", title: "完整口碑与避雷原文" },
  ].map((doc) => ({
    ...doc,
    text: readOptionalText(path.join(dir, doc.file)),
  })).filter((doc) => doc.text.trim());
}

const data = readJson(dataPath);
const html = readText(htmlPath);
const docs = sourceDocuments(dataPath);
const atlasData = atlasDataFromHtml(html);
const itineraryText = readOptionalText(path.join(path.dirname(dataPath), "itinerary.md"));
const destinationBriefText = readOptionalText(path.join(path.dirname(dataPath), "destination-brief.md"));
const reputationText = readOptionalText(path.join(path.dirname(dataPath), "reputation.md"));

if (data) {
  if (!data.destination && !data.trip?.destination) {
    issues.push("guidebook-data must include destination or trip.destination.");
  }
  if (!getDays(data).length) {
    issues.push("guidebook-data must include days or itinerary.days.");
  }
}

if (html) {
  const lower = html.trim().toLowerCase();
  if (!lower.startsWith("<!doctype html>")) {
    issues.push("guidebook.html must start with <!doctype html>.");
  }
  if (!lower.endsWith("</html>")) {
    issues.push("guidebook.html must end with </html>.");
  }
  if (Buffer.byteLength(html) < 3500) {
    issues.push("guidebook.html is unusually small; it may be truncated.");
  }
  for (const token of ["```", "Write failed", "html_content =", "<tool_use_error>"]) {
    if (html.includes(token)) {
      issues.push(`guidebook.html contains invalid leftover token: ${token}`);
    }
  }
  for (const required of ["Roammate Travel Atlas", "行程总览", "总体安排", "每日安排", "地图与交通"]) {
    if (!html.includes(required)) {
      issues.push(`guidebook.html missing required base section: ${required}`);
    }
  }
  if (html.includes("sources-panel") || html.includes("来源未单独列出")) {
    issues.push("guidebook.html should not render the standalone 来源与可信度 fallback section.");
  }
  if (/推荐航班|备选航班|高铁备选|推荐高铁|城际交通/.test(itineraryText) && !html.includes("交通参考")) {
    issues.push("itinerary.md contains concrete flight/train references, but guidebook.html is missing 交通参考.");
  }
  const foodSignal = /(今日餐食|美食|火锅|小吃|餐厅|川菜馆|不辣|微辣|吃正餐|景区内餐厅)/.test(`${destinationBriefText}\n${itineraryText}\n${reputationText}`);
  if (foodSignal && html.includes("暂无结构化餐饮建议")) {
    issues.push("Source documents contain food and dining warnings, but guidebook.html still shows 暂无结构化餐饮建议.");
  }
  const transportCodes = [...new Set([...itineraryText.matchAll(/\b(?:[A-Z]{1,3}\d{3,5}|[GDC]\d{1,5})\b/g)].map((match) => match[0]))].slice(0, 8);
  for (const code of transportCodes) {
    if (!html.includes(code)) {
      issues.push(`guidebook.html missing concrete transport code from itinerary.md: ${code}`);
    }
  }
  const itineraryTransportUrls = markdownUrls(itineraryText)
    .filter((url) => {
      const line = itineraryText.split(/\r?\n/).find((candidate) => candidate.includes(url)) || "";
      return /推荐航班|备选航班|高铁备选|推荐高铁|航班|高铁|火车|车次|飞猪|12306/.test(line);
    });
  for (const url of itineraryTransportUrls) {
    if (!html.includes(url)) {
      issues.push(`guidebook.html missing transport booking/query URL from itinerary.md: ${url}`);
    }
  }
  for (const required of ["window.__ROAMMATE_ATLAS__", "atlasMap", "data-day-tab", "drawer"]) {
    if (!html.includes(required)) {
      issues.push(`guidebook.html missing dashboard atlas interaction hook: ${required}`);
    }
  }
  if (docs.length && !html.includes("完整资料库")) {
    issues.push("Sibling Markdown files exist but guidebook.html is missing 完整资料库.");
  }
  if (docs.length && !html.includes("原文归档")) {
    issues.push("Sibling Markdown files exist but guidebook.html should present them as a collapsed archive, not as the main reading path.");
  }
  if (docs.length && !html.includes('<details class="panel source-doc"')) {
    issues.push("Source documents should be rendered as collapsed <details> panels by default.");
  }
  for (const doc of docs) {
    const firstHeading = doc.text.split(/\r?\n/).find((line) => /^#\s+/.test(line));
    const headingText = stripMarkdown(firstHeading?.replace(/^#\s+/, "") || "");
    if (!html.includes(doc.file)) {
      issues.push(`guidebook.html missing source document file label: ${doc.file}`);
    }
    if (headingText && !html.includes(headingText)) {
      issues.push(`guidebook.html missing source document heading from ${doc.file}: ${headingText}`);
    }
  }
}

if (data && html) {
  if (getPoiExperiences(data).length && !html.includes("重点景点怎么玩")) {
    issues.push("POI experience data exists but guidebook.html is missing 重点景点怎么玩.");
  }
  if (hasContent(data.checklist) && !html.includes("行前检查")) {
    issues.push("Checklist data exists but guidebook.html is missing 行前检查.");
  }
  if (hasContent(data.budget) && !html.includes("预算")) {
    issues.push("Budget data exists but guidebook.html is missing 预算.");
  }
  const budgetRows = getBudgetRows(data);
  if (budgetRows.length && !atlasData?.budget?.rows?.length) {
    issues.push("Budget rows exist in guidebook-data.json, but normalized atlas budget rows are empty.");
  }
  for (const row of budgetRows) {
    const label = row.item || row.name || row.category || row.label;
    if (label && !html.includes(String(label))) {
      issues.push(`Budget row missing from guidebook.html: ${label}`);
    }
  }
  if ((hasContent(data.transport) || hasContent(data.hotels) || hasContent(data.map)) && !html.includes("地图与交通")) {
    issues.push("Transport/map/hotel data exists but guidebook.html is missing 地图与交通.");
  }
  for (const [index, hotel] of getHotels(data).entries()) {
    const label = `hotels[${index}]`;
    const url = hotelUrl(hotel);
    if (!hasContent(hotelPrice(hotel))) {
      issues.push(`${label} missing price reference.`);
    }
    if (!hasContent(hotelRoomType(hotel))) {
      issues.push(`${label} missing room type/status. Do not invent room types; record if FlyAI did not return one.`);
    }
    if (!hasContent(url)) {
      issues.push(`${label} missing FlyAI/Feizhu URL.`);
    } else if (!html.includes(String(url))) {
      issues.push(`${label} FlyAI/Feizhu URL missing from guidebook.html.`);
    }
  }
  const accommodationBudget = numberFromCurrency(data.budget?.accommodation);
  const nights = tripNights(data);
  const hotelPrices = getHotels(data).map((hotel) => numberFromCurrency(hotelPrice(hotel))).filter((value) => Number.isFinite(value));
  if (accommodationBudget && nights && hotelPrices.length) {
    const representative = Math.min(...hotelPrices) * nights;
    const ratio = Math.abs(accommodationBudget - representative) / Math.max(representative, accommodationBudget);
    if (ratio > 0.35) {
      issues.push(`Accommodation budget (${data.budget.accommodation}) conflicts with hotel portfolio (${Math.min(...hotelPrices)} × ${nights} nights). Use one lodging data source.`);
    }
  }
  for (const [index, item] of getTransportItems(data).entries()) {
    const url = transportUrl(item);
    if (url && !html.includes(String(url))) {
      issues.push(`transport[${index}] booking/query URL missing from guidebook.html: ${url}`);
    }
  }
  for (const day of getDays(data)) {
    if (day?.theme && !html.includes(String(day.theme))) {
      issues.push(`Day theme missing from guidebook.html: ${day.theme}`);
    }
    const dayActivities = asArray(day?.activities || day?.timeline || day?.pois);
    for (const activity of dayActivities) {
      const title = activity?.title || activity?.name || activity?.arrangement || activity?.activity;
      if (title && !html.includes(String(title).split("<br>")[0])) {
        issues.push(`Day activity missing from guidebook.html: ${title}`);
      }
    }
  }
  for (const poi of getPoiExperiences(data)) {
    if (poi?.name && !html.includes(String(poi.name))) {
      issues.push(`POI experience missing from guidebook.html: ${poi.name}`);
    }
  }
  for (const route of atlasData?.map?.routes || []) {
    if (route?.mode === "待核实" || (!route?.mode && !route?.duration && !route?.duration_min && !route?.cost)) {
      issues.push(`Guidebook route lacks transport details: ${route.from || "起点"} → ${route.to || "终点"}.`);
    }
    if (route?.source === "amap_direction_walking" && Number(route.duration_min) > 45) {
      issues.push(`Guidebook route uses misleading long walking segment: ${route.from || "起点"} → ${route.to || "终点"} (${route.duration_min} min).`);
    }
  }
  const hasHotelMapClaim = html.includes("酒店同屏") || html.includes("酒店位置") || html.includes("<i>住</i>");
  const hotelMarkers = atlasData?.map?.hotels || [];
  if (hasHotelMapClaim && hotelMarkers.length && !hotelMarkers.some((hotel) => Array.isArray(hotel.location))) {
    issues.push("Guidebook claims hotel map display, but hotel candidates have no map coordinates.");
  }
}

if (issues.length) {
  console.error("Guidebook validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Guidebook validation passed.");
