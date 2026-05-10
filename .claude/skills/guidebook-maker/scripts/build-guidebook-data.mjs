#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node build-guidebook-data.mjs TRAVEL/{destination-date} [guidebook-data.json]");
}

const [, , tripDirArg, outputArg] = process.argv;
if (!tripDirArg) {
  usage();
  process.exit(1);
}

const tripDir = path.resolve(tripDirArg);
const outputPath = outputArg ? path.resolve(outputArg) : path.join(tripDir, "guidebook-data.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(tripDir, file), "utf8"));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(path.join(tripDir, file), "utf8");
  } catch {
    return "";
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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

function extractBlock(text, heading) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  const next = /^##\s+/gm;
  next.lastIndex = start;
  const nextMatch = next.exec(text);
  return text.slice(start, nextMatch?.index ?? text.length);
}

function bullets(block) {
  return String(block || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/)?.[1])
    .filter(Boolean)
    .map(stripMarkdown);
}

function inlineBlock(text, heading) {
  const block = extractBlock(text, heading);
  return stripMarkdown(block.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("|")) || "");
}

function dateRangeFromData(data) {
  const start = firstPresent(data?.start_date, data?.startDate, data?.trip?.start_date, data?.trip?.startDate);
  const end = firstPresent(data?.end_date, data?.endDate, data?.trip?.end_date, data?.trip?.endDate);
  return firstPresent(data?.dateRange, data?.date_range, data?.dates, data?.trip?.dateRange, data?.trip?.date_range, data?.trip?.dates, start && end ? `${start} 至 ${end}` : start);
}

function normalizeActivity(activity, fallbackPoi = null) {
  if (!activity && !fallbackPoi) return null;
  const source = activity || fallbackPoi || {};
  const title = firstPresent(source.title, source.activity, source.arrangement, source.name, fallbackPoi?.name);
  if (!title) return null;
  const minutes = firstPresent(source.duration_min, source.duration_minutes, source.estimated_duration_minutes, source.comfortable_duration_minutes);
  return {
    time: firstPresent(source.time, source.period, source.slot),
    title,
    poiName: firstPresent(source.poiName, source.poi_name, source.location, fallbackPoi?.name, source.name),
    transport: firstPresent(source.transport, source.traffic),
    cost: firstPresent(source.cost, source.price, source.fee),
    notes: firstPresent(source.notes, source.remark, source.queue_or_friction, source.tips),
    duration: minutes ? `约${minutes}分钟` : firstPresent(source.duration),
    type: firstPresent(source.type, source.category),
    source: firstPresent(source.source),
  };
}

function normalizeDays(itineraryData) {
  return asArray(itineraryData?.days).map((day, index) => {
    const pois = asArray(day.pois);
    const timeline = asArray(firstPresent(day.activities, day.timeline));
    const activities = (timeline.length ? timeline : pois).map((activity, activityIndex) => normalizeActivity(activity, pois[activityIndex])).filter(Boolean);
    return {
      day: Number(firstPresent(day.day, index + 1)),
      date: day.date,
      theme: firstPresent(day.theme, day.title, `第 ${index + 1} 天`),
      area: firstPresent(day.area, day.region),
      intensity: firstPresent(day.intensity, day.pace),
      highlights: asArray(firstPresent(day.highlights, day.coreExperience, day.core_experience)),
      meals: firstPresent(day.meals, day.food),
      rest: firstPresent(day.rest, day.restNotes, day.rest_notes),
      budget: firstPresent(day.budget, day.daily_budget_cny, day.dailyBudget),
      reservations: firstPresent(day.reservations, day.bookingReminders, day.booking_reminders, day.reservation_checklist),
      backup: firstPresent(day.backup, day.rainPlan, day.rain_plan, day.alternative),
      reminders: asArray(firstPresent(day.reminders, day.warnings, day.keyReminder, day.key_reminder, day.tips)),
      activities,
      pois,
    };
  });
}

function normalizePoiExperiences(days) {
  const seen = new Set();
  const cards = [];
  for (const day of days) {
    for (const poi of asArray(day.pois)) {
      if (!poi?.name || seen.has(poi.name)) continue;
      seen.add(poi.name);
      const minutes = firstPresent(poi.comfortable_duration_minutes, poi.estimated_duration_minutes);
      cards.push({
        name: poi.name,
        day: day.day,
        recommendedDuration: minutes ? `约${minutes}分钟` : firstPresent(poi.duration, poi.recommendedDuration),
        mustDo: asArray(firstPresent(poi.must_do, poi.mustDo)),
        queueAndReservation: asArray(firstPresent(poi.queue_or_friction, poi.reservation_note)),
        preparation: asArray(poi.preparation),
        familyNotes: asArray(firstPresent(poi.family_notes, poi.familyNotes)),
        avoid: asArray(poi.avoid),
        tips: firstPresent(poi.notes, poi.tips),
        source: firstPresent(poi.source),
      });
    }
  }
  return cards;
}

function normalizeHotels(mapData) {
  const options = asArray(mapData?.hotels)
    .filter((hotel) => hotel && !hotel.error && firstPresent(hotel.name, hotel.title))
    .slice(0, 6)
    .map((hotel) => ({
      tier: firstPresent(hotel.tier, hotel.query_profile, hotel.type, "候选"),
      name: firstPresent(hotel.name, hotel.title),
      area: firstPresent(hotel.area, hotel.address, hotel.interestsPoi),
      priceReference: firstPresent(hotel.price, hotel.priceReference, hotel.price_ref),
      roomType: firstPresent(hotel.room_type, hotel.roomType, hotel.room_type_note, "FlyAI未返回具体房型"),
      bookingUrl: firstPresent(hotel.booking_url, hotel.detailUrl, hotel.jumpUrl, hotel.url),
      longitude: firstPresent(hotel.longitude, hotel.lng),
      latitude: firstPresent(hotel.latitude, hotel.lat),
      fit: firstPresent(hotel.fit, hotel.reason, hotel.selling_point),
      tradeoffs: asArray(firstPresent(hotel.tradeoffs, hotel.drawbacks, hotel.notes)),
      source: firstPresent(hotel.source, "FlyAI booking reference"),
    }));
  return options.length ? {
    stayStrategy: "以行程核心区域和晚间补给便利为主，优先选择交通清楚、价格和房型可在飞猪复核的候选。",
    source: "map-data.json + FlyAI booking reference",
    options,
  } : undefined;
}

function normalizeTransport(itineraryData) {
  const transport = itineraryData?.transport || itineraryData?.transportation || {};
  const flights = asArray(firstPresent(transport.flights, itineraryData?.flights));
  const trains = asArray(firstPresent(transport.trains, itineraryData?.trains));
  const local = asArray(firstPresent(transport.local, transport.local_transport, itineraryData?.local_transport));
  if (!flights.length && !trains.length && !local.length) return undefined;
  return { flights, trains, local };
}

function normalizeBudget(itineraryData) {
  const budget = firstPresent(itineraryData?.budget, itineraryData?.total_budget, itineraryData?.budget_summary);
  if (!budget || typeof budget !== "object") return undefined;
  const labels = {
    transport: "交通",
    accommodation: "住宿",
    attractions: "门票/体验",
    tickets: "门票/体验",
    meals: "餐饮",
    food: "餐饮",
    misc: "机动",
    buffer: "机动",
  };
  const explicit = asArray(firstPresent(budget.items, budget.rows));
  const rows = explicit.length ? explicit : Object.entries(budget)
    .filter(([key, value]) => !["total", "note"].includes(key) && value !== undefined && value !== null && typeof value !== "object")
    .map(([key, value]) => ({ category: labels[key] || key, amount: String(value) }));
  return {
    rows: rows.map((row) => ({
      item: firstPresent(row.item, row.name, row.category, row.label),
      amount: firstPresent(row.amount, row.cost, row.value),
      note: firstPresent(row.note, row.notes),
    })).filter((row) => row.item && row.amount),
    total: firstPresent(budget.total, budget.note),
  };
}

function normalizeChecklist(itineraryData) {
  const checklist = {};
  const reservations = asArray(firstPresent(itineraryData?.reservation_checklist, itineraryData?.reservations));
  const packing = asArray(firstPresent(itineraryData?.packing_tips, itineraryData?.packing));
  const apps = asArray(firstPresent(itineraryData?.apps, itineraryData?.recommended_apps));
  if (reservations.length) checklist["预约"] = reservations.map((item) => typeof item === "string" ? item : [item.item, item.deadline, item.platform].filter(Boolean).join(" · "));
  if (packing.length) checklist["装备"] = packing.map((item) => typeof item === "string" ? item : Object.values(item).filter(Boolean).join(" · "));
  if (apps.length) checklist["APP"] = apps;
  return Object.keys(checklist).length ? checklist : undefined;
}

const itineraryData = readJson("itinerary-data.json") || {};
const mapData = readJson("map-data.json") || {};
const ledger = readJson("research-ledger.json") || {};
const destinationBrief = readText("destination-brief.md");

const days = normalizeDays(itineraryData);
const destination = firstPresent(itineraryData.destination, itineraryData.trip?.destination, mapData.destination, ledger.destination, path.basename(tripDir).split("-")[0]);
const overview = {
  summary: firstPresent(inlineBlock(destinationBrief, "一句话判断"), itineraryData.summary),
  highlights: bullets(extractBlock(destinationBrief, "核心体验")).slice(0, 6),
  warnings: bullets(extractBlock(destinationBrief, "风险与注意")).slice(0, 6),
  pace: firstPresent(itineraryData.pace, itineraryData.trip?.pace),
  stayArea: firstPresent(itineraryData.stay_area, itineraryData.accommodation?.area),
  transportMode: firstPresent(itineraryData.transport_mode, itineraryData.trip?.transport_mode),
  budgetLevel: firstPresent(itineraryData.budget_level, itineraryData.trip?.budget_level),
};

const guidebookData = {
  destination,
  dateRange: dateRangeFromData(itineraryData) || mapData.trip_dates,
  duration: firstPresent(itineraryData.duration, itineraryData.trip?.duration),
  travelers: firstPresent(itineraryData.travelers, itineraryData.trip?.travelers),
  origin: firstPresent(itineraryData.origin, itineraryData.trip?.origin),
  generatedAt: new Date().toISOString().slice(0, 10),
  overview,
  days,
  poiExperiences: normalizePoiExperiences(days),
  transport: normalizeTransport(itineraryData),
  hotels: normalizeHotels(mapData),
  budget: normalizeBudget(itineraryData),
  checklist: normalizeChecklist(itineraryData),
};

for (const key of Object.keys(guidebookData)) {
  if (guidebookData[key] === undefined || guidebookData[key] === "" || (Array.isArray(guidebookData[key]) && !guidebookData[key].length)) {
    delete guidebookData[key];
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(guidebookData, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, days: days.length, poiExperiences: guidebookData.poiExperiences?.length || 0, hotels: guidebookData.hotels?.options?.length || 0 }, null, 2));
