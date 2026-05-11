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

function extractFirstUrl(value) {
  const raw = String(value || "");
  const markdownUrl = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/)?.[1];
  const plainUrl = raw.match(/https?:\/\/[^\s)）]+/)?.[0];
  return (markdownUrl || plainUrl || "").replace(/[。。，，；;、]+$/, "");
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

function cleanText(value) {
  return stripMarkdown(value)
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s*[-—]\s*$/, "")
    .trim();
}

function compactName(value) {
  return cleanText(value)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,、\s/·.-]/g, "")
    .toLowerCase();
}

function splitMarkdownRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ""));
}

function parseMarkdownTable(block) {
  const lines = String(block || "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line, index) => line.trim().startsWith("|") && lines[index + 1] && isTableSeparator(lines[index + 1]));
  if (headerIndex < 0) return [];
  const headers = splitMarkdownRow(lines[headerIndex]).map(stripMarkdown);
  const rows = [];
  for (const rawLine of lines.slice(headerIndex + 2)) {
    if (!rawLine.trim().startsWith("|")) break;
    if (isTableSeparator(rawLine)) continue;
    const rawCells = splitMarkdownRow(rawLine);
    if (rawCells.length !== headers.length) continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = stripMarkdown(rawCells[index]);
      row[`__raw_${header}`] = rawCells[index];
    });
    rows.push(row);
  }
  return rows;
}

function parseMarkdownTables(block) {
  const lines = String(block || "").split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].trim().startsWith("|") || !isTableSeparator(lines[index + 1])) continue;
    const tableLines = [lines[index], lines[index + 1]];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
      tableLines.push(lines[cursor]);
      cursor += 1;
    }
    const rows = parseMarkdownTable(tableLines.join("\n"));
    if (rows.length) tables.push(rows);
    index = cursor;
  }
  return tables;
}

function extractHeadingBlock(text, headingPattern, nextPattern = /^##\s+/gm) {
  if (!text) return "";
  const pattern = headingPattern instanceof RegExp ? headingPattern : new RegExp(`^##\\s+${headingPattern}\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  nextPattern.lastIndex = start;
  const next = nextPattern.exec(text);
  return text.slice(start, next?.index ?? text.length);
}

function extractSubheadingBlock(text, headingPattern) {
  return extractHeadingBlock(text, headingPattern, /^#{2,3}\s+/gm);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(pattern, value) {
  const text = cleanText(value);
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }
  return text.includes(String(pattern || ""));
}

function headingBlocksMatching(text, headingPattern, minLevel = 2, maxLevel = 4) {
  const matches = [...String(text || "").matchAll(/^(#{2,4})\s+(.+)$/gm)];
  return matches
    .map((match, index) => {
      const level = match[1].length;
      const title = cleanText(match[2]);
      const start = match.index + match[0].length;
      const next = matches.slice(index + 1).find((candidate) => candidate[1].length <= level);
      return { level, title, block: String(text || "").slice(start, next?.index ?? String(text || "").length) };
    })
    .filter((item) => item.level >= minLevel && item.level <= maxLevel && matchesPattern(headingPattern, item.title));
}

function bulletItems(block) {
  return String(block || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/)?.[1])
    .filter(Boolean)
    .map(cleanText);
}

function strongLine(block, labelPattern) {
  const pattern = labelPattern instanceof RegExp ? labelPattern : new RegExp(labelPattern);
  for (const rawLine of String(block || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("|")) continue;
    const boldMatch = line.match(/^\s*(?:[-*]\s*)?\*\*([^*]+)\*\*[:：]\s*(.+)$/);
    const plainMatch = line.match(/^\s*(?:[-*]\s*)?([^：:]{2,24})[:：]\s*(.+)$/);
    const match = boldMatch || plainMatch;
    if (!match) continue;
    pattern.lastIndex = 0;
    if (pattern.test(cleanText(match[1]))) return cleanText(match[2]);
  }
  return "";
}

function strongItems(block, labelPattern) {
  const value = strongLine(block, labelPattern);
  if (!value) return [];
  return splitRichList(value);
}

function splitRichList(value) {
  const text = cleanText(value);
  if (!text) return [];
  const parts = text.split(/[；;]\s*/).map((item) => cleanText(item)).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function inlineBlock(text, heading) {
  const block = extractHeadingBlock(text, new RegExp(`^##\\s+${heading}\\s*$`, "m"));
  return cleanText(block.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("|")) || "");
}

function parseTripParams(itineraryText) {
  const params = {};
  const block = extractHeadingBlock(itineraryText, /^##\s+行程参数\s*$/m);
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*(?:\*\*)?([^*：:]+)(?:\*\*)?[:：]\s*(.+)$/);
    if (!match) continue;
    const key = match[1];
    const value = cleanText(match[2]);
    if (/日期/.test(key)) params.dateRange = value;
    if (/出发地/.test(key)) params.origin = value;
    if (/同行人/.test(key)) params.travelers = value;
    if (/交通方式/.test(key)) params.transportMode = value;
    if (/预算/.test(key)) params.budgetLevel = value;
    if (/节奏/.test(key)) params.pace = value;
  }
  return {
    dateRange: params.dateRange,
    origin: params.origin,
    travelers: params.travelers,
    transportMode: params.transportMode,
    budgetLevel: params.budgetLevel,
    pace: params.pace,
  };
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
    title: cleanText(title),
    poiName: cleanText(firstPresent(source.poiName, source.poi_name, source.location, fallbackPoi?.name, source.name, title)),
    transport: cleanText(firstPresent(source.transport, source.traffic)),
    cost: cleanText(firstPresent(source.cost, source.price, source.fee)),
    notes: cleanText(firstPresent(source.notes, source.remark, source.queue_or_friction, source.tips)),
    duration: minutes ? `约${minutes}分钟` : firstPresent(source.duration),
    type: firstPresent(source.type, source.category),
    source: firstPresent(source.source),
  };
}

function inferPoiName(title) {
  const text = cleanText(title);
  if (!text) return "";
  if (/→|出发|抵达|返回|前往|办理入住|退房|早餐|午餐|晚餐|购买伴手礼|返回住宿/.test(text)) return text;
  return text.replace(/[（(].*?[）)]/g, "").replace(/(参观|游览|漫步|打卡|拍照|午餐|晚餐).*$/, "").trim() || text;
}

function parseItineraryDays(itineraryText) {
  const dayMatches = [...itineraryText.matchAll(/^###\s+Day\s+(\d+)(?:\s*[（(]([^）)]*)[）)])?\s*(?:[·.-]\s*)?(.+)$/gm)];
  if (!dayMatches.length) return [];
  return dayMatches.map((match, index) => {
    const next = dayMatches[index + 1];
    const block = itineraryText.slice(match.index, next?.index ?? itineraryText.length);
    const rows = parseMarkdownTable(block);
    const rawTitle = cleanText(match[3]);
    const titleDate = rawTitle.match(/[（(]([^）)]*(?:\d{4}|月|周|星期)[^）)]*)[）)]/)?.[1];
    const theme = cleanText(rawTitle.replace(/[（(][^）)]*(?:\d{4}|月|周|星期)[^）)]*[）)]/g, ""));
    const activities = rows.map((row) => ({
      time: row["时间"],
      title: row["安排"],
      poiName: inferPoiName(row["安排"]),
      transport: row["交通"],
      cost: row["费用"],
      notes: row["备注"],
      source: "itinerary.md 每日行程",
    })).filter((row) => row.title);
    return {
      day: Number(match[1]),
      date: cleanText(firstPresent(match[2], titleDate)),
      theme,
      area: "",
      intensity: "",
      highlights: splitRichList(firstPresent(strongLine(block, /核心体验/), strongLine(block, /核心体验\/首推项目/))),
      meals: strongLine(block, /今日餐食/),
      rest: strongLine(block, /休息|补给/),
      budget: strongLine(block, /预算估算|今日预算/),
      reservations: strongLine(block, /预约提醒|预约/),
      backup: firstPresent(strongLine(block, /雨天\/疲劳备用/), strongLine(block, /备用方案/)),
      reminders: splitRichList(strongLine(block, /重点提醒/)),
      activities,
    };
  });
}

function parseStructuredItineraryDays(structured) {
  if (structured?.artifact_type !== "itinerary-structured" || !Array.isArray(structured.days)) return [];
  return structured.days.map((day, index) => {
    const details = day.dailyDetails || {};
    const activities = asArray(day.timelineRows).map((row) => {
      const cells = row?.cells || {};
      const title = firstPresent(cells["安排"], cells["活动"], cells["内容"]);
      if (!title) return null;
      return {
        time: cells["时间"],
        title,
        poiName: inferPoiName(title),
        transport: cells["交通"],
        cost: firstPresent(cells["费用"], cells["价格"], cells["预算"]),
        notes: firstPresent(cells["备注"], cells["说明"]),
        source: `itinerary-structured.json${row?.line ? `:${row.line}` : ""}`,
        rawMarkdown: row?.rawMarkdown,
        rawCells: row?.rawCells,
      };
    }).filter(Boolean);
    return {
      day: Number(firstPresent(day.day, index + 1)),
      date: day.date,
      theme: firstPresent(day.theme, day.title),
      area: "",
      intensity: "",
      highlights: splitRichList(details["核心体验/首推项目"]),
      meals: details["今日餐食"],
      rest: details["休息与补给"],
      budget: details["预算估算"],
      reservations: details["预约提醒"],
      backup: details["雨天/疲劳备用"],
      reminders: [],
      activities,
      rawMarkdown: day.rawMarkdown,
      source: "itinerary-structured.json",
    };
  }).filter((day) => day.activities.length || day.rawMarkdown);
}

function parseStructuredTripParams(structured) {
  const trip = structured?.trip || {};
  if (!trip || typeof trip !== "object") return {};
  return {
    dateRange: trip["日期"],
    origin: trip["出发地"],
    travelers: trip["同行人"],
    transportMode: trip["交通方式"],
    budgetLevel: trip["预算"],
    pace: trip["节奏"],
  };
}

function structuredPlanRows(structured) {
  return asArray(structured?.sections?.planOverview?.rows)
    .map((row) => row?.cells || row)
    .filter((row) => row && typeof row === "object");
}

function parsePlanOverviewIntoDaysFromStructured(structured, days) {
  const rows = structuredPlanRows(structured);
  if (!rows.length) return days;
  for (const row of rows) {
    const dayNumber = Number(String(row["天数"] || "").match(/\d+/)?.[0]);
    const day = days.find((item) => item.day === dayNumber);
    if (!day) continue;
    day.theme = firstPresent(day.theme, row["主题"]);
    day.area = firstPresent(row["区域"], day.area);
    day.intensity = firstPresent(row["强度"], day.intensity);
    day.highlights = day.highlights?.length ? day.highlights : splitRichList(row["核心体验"]);
    day.reminders = day.reminders?.length ? day.reminders : splitRichList(row["重点提醒"]);
  }
  return days;
}

function parseBudgetFromStructured(structured, tripParams = {}) {
  const rows = asArray(structured?.sections?.budget?.rows)
    .map((row) => row?.cells || row)
    .filter((row) => row && typeof row === "object");
  if (!rows.length) return undefined;
  const totalRow = rows.find((row) => /合计/.test(row["项目"] || ""));
  const amountColumns = Object.keys(rows[0] || {})
    .filter((key) => !/项目|类别|预算项|备注|说明|Note/i.test(key));
  const preferredAmountColumn = amountColumns.find((column) => tripParams.budgetLevel && column.includes(tripParams.budgetLevel))
    || (/舒适/.test(tripParams.budgetLevel || "") ? amountColumns.find((column) => /舒适/.test(column)) : "")
    || (/穷游|经济/.test(tripParams.budgetLevel || "") ? amountColumns.find((column) => /经济|穷游/.test(column)) : "")
    || amountColumns.find((column) => /经济|穷游|金额|费用|预算|价格/.test(column))
    || amountColumns[0];
  return {
    rows: rows.filter((row) => !/合计/.test(row["项目"] || "")).map((row) => ({
      item: firstPresent(row["项目"], row["类别"], row["预算项"]),
      amount: firstPresent(row[preferredAmountColumn], row["经济（穷游）"], row["经济"], row["舒适"], row["金额"], row["费用"]),
      note: firstPresent(row["备注"], row["说明"]),
    })).filter((row) => row.item && row.amount),
    total: totalRow ? `${firstPresent(totalRow[preferredAmountColumn], totalRow["经济（穷游）"], totalRow["经济"], totalRow["舒适"], totalRow["金额"], "")}${totalRow["备注"] ? `（${totalRow["备注"]}）` : ""}` : "",
  };
}

function parseTransportFromStructured(structured) {
  const rows = asArray(structured?.transportRows).map((row) => ({
    type: firstPresent(row.type, "交通"),
    route: [
      row.direction,
      row.code,
      row.depart && row.arrive ? `${row.depart} → ${row.arrive}` : "",
    ].filter(Boolean).join(" · ") || row.rawMarkdown,
    duration: row.duration,
    price: row.priceReference,
    note: row.rawMarkdown,
    url: row.bookingUrl,
    source: "itinerary-structured.json 交通表",
  })).filter((row) => row.route);
  const flights = rows.filter((item) => isFlightTransport(`${item.type} ${item.route}`));
  const trains = rows.filter((item) => isRailTransport(`${item.type} ${item.route}`));
  const local = rows.filter((item) => !flights.includes(item) && !trains.includes(item) && /市内|景区|地铁|公交|打车|网约车|出租|步行|接驳|包车/.test(`${item.type} ${item.route}`));
  const intercity = rows.filter((item) => !flights.includes(item) && !trains.includes(item) && !local.includes(item));
  return rows.length ? { flights, trains: [...trains, ...intercity], local } : undefined;
}

function parseHotelsFromStructured(structured, mapData) {
  const options = asArray(structured?.hotelCandidates).map((hotel) => {
    const name = hotel?.name;
    if (!name) return null;
    const mapHotel = findMapHotel(mapData, name);
    return {
      tier: hotel.tier,
      name,
      area: hotel.area,
      priceReference: hotel.priceReference,
      roomType: firstPresent(mapHotel.room_type, mapHotel.roomType, mapHotel.room_type_note, mapHotel.roomTypeNote, "上游未返回具体房型，需点击链接确认"),
      bookingUrl: firstPresent(hotel.bookingUrl, mapHotel.booking_url, mapHotel.detailUrl, mapHotel.jumpUrl, mapHotel.url),
      longitude: firstPresent(mapHotel.longitude, mapHotel.lng),
      latitude: firstPresent(mapHotel.latitude, mapHotel.lat),
      image: firstPresent(mapHotel.mainPic, mapHotel.image, mapHotel.photo),
      fit: hotel.fit,
      tradeoffs: splitRichList(hotel.tradeoff),
      source: "itinerary-structured.json accepted hotel candidate",
    };
  }).filter(Boolean);
  return options.length ? {
    stayStrategy: "",
    source: "itinerary-structured.json 住宿区域与候选",
    options,
  } : undefined;
}

function parsePlanOverviewIntoDays(itineraryText, days) {
  const rows = parseMarkdownTable(extractHeadingBlock(itineraryText, /^##\s+总体安排\s*$/m));
  for (const row of rows) {
    const dayNumber = Number(String(row["天数"] || "").match(/\d+/)?.[0]);
    const day = days.find((item) => item.day === dayNumber);
    if (!day) continue;
    day.theme = firstPresent(day.theme, row["主题"]);
    day.area = firstPresent(row["区域"], day.area);
    day.intensity = firstPresent(row["强度"], day.intensity);
    day.highlights = day.highlights?.length ? day.highlights : splitRichList(row["核心体验"]);
    day.reminders = day.reminders?.length ? day.reminders : splitRichList(row["重点提醒"]);
  }
  return days;
}

function parseDestinationOverview(destinationBrief, tripParams) {
  const overviewBlock = extractHeadingBlock(destinationBrief, /^##\s+目的地概览\s*$/m);
  const overviewBullets = bulletItems(overviewBlock);
  const stayArea = cleanText(extractHeadingBlock(destinationBrief, /^##\s+怎么到达\s*$/m)
    .split(/\r?\n/)
    .find((line) => /市内交通|住宿|区域/.test(line)) || "");
  return {
    summary: inlineBlock(destinationBrief, "一句话判断"),
    highlights: bulletItems(extractHeadingBlock(destinationBrief, /^##\s+核心体验\s*$/m)).slice(0, 8),
    warnings: bulletItems(extractHeadingBlock(destinationBrief, /^##\s+风险与注意\s*$/m)).slice(0, 8),
    pace: firstPresent(tripParams.pace, overviewBullets.find((item) => /^旅行强度/.test(item))?.replace(/^旅行强度[:：]\s*/, "")),
    stayArea: tripParams.stayArea || stayArea,
    transportMode: tripParams.transportMode,
    budgetLevel: tripParams.budgetLevel,
  };
}

function parseReputationTable(reputationText) {
  const rows = parseMarkdownTable(extractHeadingBlock(reputationText, /^##\s+总体结论\s*$/m));
  const byName = new Map();
  for (const row of rows) {
    const name = row["对象"];
    if (!name) continue;
    byName.set(name, {
      rating: row["等级"],
      suitable: row["适合谁"],
      risk: row["主要风险"],
      confidence: row["可信度"],
    });
  }
  return byName;
}

function parseReputationSections(reputationText) {
  const analysis = extractHeadingBlock(reputationText, /^##\s+逐项分析\s*$/m, /^##\s+/gm);
  const matches = [...analysis.matchAll(/^###\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const name = cleanText(match[1]);
    const block = analysis.slice(match.index, next?.index ?? analysis.length);
    return { name, block };
  }).filter((section) => section.name);
}

function isNonPoiReputationSection(name) {
  return /餐厅|餐饮|美食|住宿|酒店|候选|区域判断|推荐档次|预算|交通/.test(cleanText(name));
}

function matchingByName(map, name) {
  if (map.has(name)) return map.get(name);
  return [...map.entries()].find(([key]) => name.includes(key) || key.includes(name))?.[1] || {};
}

function parsePoiExperiences(reputationText, days) {
  const ratings = parseReputationTable(reputationText);
  const sections = parseReputationSections(reputationText);
  const dayByName = new Map();
  for (const day of days) {
    for (const activity of day.activities || []) {
      for (const name of [activity.poiName, activity.title]) {
        if (name) dayByName.set(name, day.day);
      }
    }
  }
  const cards = sections
    .filter((section) => !isNonPoiReputationSection(section.name))
    .map((section) => {
      const rating = matchingByName(ratings, section.name);
      return {
        name: section.name,
        day: dayByName.get(section.name) || [...dayByName.entries()].find(([key]) => key.includes(section.name) || section.name.includes(key))?.[1] || "",
        rating: rating.rating,
        whyGo: strongItems(section.block, /推荐理由/),
        recommendedDuration: strongLine(section.block, /建议时长/),
        mustDo: strongItems(section.block, /首推体验|必玩|必看/),
        tips: rating.risk ? `主要风险：${rating.risk}` : "",
        queueAndReservation: strongItems(section.block, /预约\/排队\/价格提醒|预约|排队|价格提醒/),
        preparation: strongItems(section.block, /准备材料|亲子老人提醒/),
        familyNotes: strongItems(section.block, /亲子|老人|家庭/),
        avoid: strongItems(section.block, /避雷点|避雷/),
        commonComplaints: strongItems(section.block, /常见差评/),
        suitable: firstPresent(strongLine(section.block, /适合/), rating.suitable),
        notSuitable: strongLine(section.block, /不适合/),
        source: firstPresent(strongLine(section.block, /来源信号/), rating.confidence),
      };
    });
  if (cards.length) return cards;
  return [];
}

function findMapHotel(mapData, name) {
  const target = compactName(name);
  return asArray(mapData?.hotels).find((hotel) => {
    const hotelName = cleanText(firstPresent(hotel.name, hotel.title));
    const compact = compactName(hotelName);
    return hotelName && (hotelName === name || hotelName.includes(name) || name.includes(hotelName) || (target && compact && (target === compact || target.includes(compact) || compact.includes(target))));
  }) || {};
}

function parseHotelStrategy(reputationText, itineraryText) {
  const reputationBlocks = headingBlocksMatching(reputationText, /住宿|酒店|区域判断/, 2, 4).map((item) => item.block);
  const itineraryBlocks = headingBlocksMatching(itineraryText, /住宿区域|住宿策略|交通与住宿/, 2, 4).map((item) => item.block);
  const lines = [
    ...reputationBlocks.flatMap((block) => bulletItems(block)),
    ...itineraryBlocks.flatMap((block) => bulletItems(block)),
  ];
  const preferred = lines.filter((line) => /首选|区域|地铁|步行|酒店|住宿|核心区|商圈|换乘|景区/.test(line));
  return (preferred.length ? preferred : lines).slice(0, 4).join("；");
}

function rowValue(row, labels) {
  for (const label of labels) {
    const direct = row[label];
    if (direct) return direct;
    const key = Object.keys(row).find((candidate) => !candidate.startsWith("__raw_") && matchesPattern(new RegExp(label), candidate));
    if (key && row[key]) return row[key];
  }
  return "";
}

function rawRowValue(row, labels) {
  for (const label of labels) {
    const direct = row[`__raw_${label}`];
    if (direct) return direct;
    const key = Object.keys(row).find((candidate) => candidate.startsWith("__raw_") && matchesPattern(new RegExp(label), candidate.replace(/^__raw_/, "")));
    if (key && row[key]) return row[key];
  }
  return "";
}

function collectHotelRows(reputationText, itineraryText) {
  const blocks = [
    ...headingBlocksMatching(reputationText, /住宿|酒店|候选/, 2, 4),
    ...headingBlocksMatching(itineraryText, /住宿|酒店|候选/, 2, 4),
  ];
  const rows = [];
  for (const section of blocks) {
    for (const table of parseMarkdownTables(section.block)) {
      const hotelRows = table.filter((row) => rowValue(row, ["酒店", "酒店名称", "候选酒店", "名称"]));
      for (const row of hotelRows) rows.push({ row, sectionTitle: section.title });
    }
  }
  const seen = new Set();
  return rows.filter(({ row }) => {
    const name = rowValue(row, ["酒店", "酒店名称", "候选酒店", "名称"]);
    const key = compactName(name);
    if (!key || [...seen].some((existing) => key === existing || (existing.length >= 8 && key.includes(existing)) || (key.length >= 8 && existing.includes(key)))) return false;
    seen.add(key);
    return true;
  });
}

function parseHotels(reputationText, itineraryText, mapData) {
  const rows = collectHotelRows(reputationText, itineraryText);
  const options = rows.map(({ row, sectionTitle }) => {
    const name = rowValue(row, ["酒店", "酒店名称", "候选酒店", "名称"]);
    const mapHotel = findMapHotel(mapData, name);
    const tier = rowValue(row, ["档次", "类型", "定位"]);
    const priceReference = rowValue(row, ["价格参考", "价格/晚", "价格", "参考价", "费用"]);
    const area = rowValue(row, ["位置", "区域", "地址", "商圈"]);
    const roomType = firstPresent(rowValue(row, ["房型", "房型状态", "房型说明"]), "FlyAI未返回具体房型，需点击链接确认");
    const fit = rowValue(row, ["适合", "适合人群", "特点", "推荐理由"]);
    const tradeoffText = rowValue(row, ["取舍", "避雷", "备注", "注意"]);
    return {
      tier,
      name,
      area,
      priceReference,
      roomType,
      bookingUrl: firstPresent(
        extractFirstUrl(rawRowValue(row, ["订票", "飞猪链接", "链接", "查询"])) || extractFirstUrl(rowValue(row, ["订票", "飞猪链接", "链接", "查询"])),
        mapHotel.booking_url,
        mapHotel.detailUrl,
        mapHotel.jumpUrl,
        mapHotel.url,
      ),
      longitude: firstPresent(mapHotel.longitude, mapHotel.lng),
      latitude: firstPresent(mapHotel.latitude, mapHotel.lat),
      image: firstPresent(mapHotel.mainPic, mapHotel.image, mapHotel.photo),
      fit: firstPresent(fit, /穷游|经济/.test(tier || "") ? "预算优先，适合只需要核心区过夜补给。" : "位置、动线和舒适度优先，适合希望降低通勤成本。"),
      tradeoffs: splitRichList(firstPresent(tradeoffText, "价格为代表性样例数据，以实时库存和房型为准。")),
      source: `reputation.md / itinerary.md ${sectionTitle}`,
    };
  }).filter((hotel) => hotel.name);
  if (options.length) {
    return {
      stayStrategy: parseHotelStrategy(reputationText, itineraryText),
      source: "reputation.md 住宿区域策略 + itinerary.md 住宿区域",
      options,
    };
  }
  return undefined;
}

function normalizeHotelsFromMap(mapData) {
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

function parseBudget(itineraryText, tripParams = {}) {
  const block = headingBlocksMatching(itineraryText, /预算汇总/, 2, 3)[0]?.block || "";
  const rows = parseMarkdownTable(block);
  if (rows.length) {
    const totalRow = rows.find((row) => /合计/.test(row["项目"] || ""));
    const amountColumns = Object.keys(rows[0] || {})
      .filter((key) => !key.startsWith("__raw_") && !/项目|类别|预算项|备注|说明|Note/i.test(key));
    const preferredAmountColumn = amountColumns.find((column) => tripParams.budgetLevel && column.includes(tripParams.budgetLevel))
      || (/舒适/.test(tripParams.budgetLevel || "") ? amountColumns.find((column) => /舒适/.test(column)) : "")
      || (/穷游|经济/.test(tripParams.budgetLevel || "") ? amountColumns.find((column) => /经济|穷游/.test(column)) : "")
      || amountColumns.find((column) => /经济|穷游|金额|费用|预算|价格/.test(column))
      || amountColumns[0];
    return {
      rows: rows.filter((row) => !/合计/.test(row["项目"] || "")).map((row) => ({
        item: firstPresent(row["项目"], row["类别"], row["预算项"]),
        amount: firstPresent(row[preferredAmountColumn], row["经济（穷游）"], row["经济"], row["舒适"], row["金额"], row["费用"]),
        note: firstPresent(row["备注"], row["说明"]),
      })).filter((row) => row.item && row.amount),
      total: totalRow ? `${firstPresent(totalRow[preferredAmountColumn], totalRow["经济（穷游）"], totalRow["经济"], totalRow["舒适"], totalRow["金额"], "")}${totalRow["备注"] ? `（${totalRow["备注"]}）` : ""}` : "",
    };
  }
  return undefined;
}

function parseChecklist(itineraryText) {
  const block = extractHeadingBlock(itineraryText, /^##\s+出行前检查\s*$/m);
  const groups = {};
  let current = "";
  for (const rawLine of block.split(/\r?\n/)) {
    const nested = rawLine.match(/^\s{2,}-\s+(.+)$/);
    if (nested && current) {
      groups[current].push(cleanText(nested[1]));
      continue;
    }
    const line = rawLine.match(/^\s*-\s+(.+)$/)?.[1];
    if (!line) continue;
    const label = line.match(/^\*\*([^*]+)\*\*[:：]?\s*(.*)$/);
    if (label) {
      current = cleanText(label[1].replace(/[（(].*?[）)]/g, ""));
      groups[current] ||= [];
      if (label[2]) groups[current].push(cleanText(label[2]));
    } else if (current) {
      groups[current].push(cleanText(line));
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key] = groups[key].filter(Boolean);
    if (!groups[key].length) delete groups[key];
  }
  if (Object.keys(groups).length) return groups;
  return undefined;
}

function inferTransportType(text, kind = "") {
  const value = cleanText(`${kind} ${text}`);
  const returning = /返程|回程|返航|返回|返/.test(value);
  const outbound = /去程|出发|前往|抵达/.test(value);
  const flight = /航班|机场|\b[A-Z]{1,3}\d{3,5}\b/.test(value);
  const rail = /高铁|火车|动车|车次|火车站|高铁站|\b[GDC]\d{1,5}\b/.test(value);
  if (/市内|城内|景区|地铁|公交|打车|网约车|出租|步行|接驳|包车/.test(value)) return "市内交通";
  if (flight) return returning ? "返程航班" : outbound ? "去程航班" : "城际航班";
  if (rail) return returning ? "返程高铁/火车" : outbound ? "去程高铁/火车" : "城际高铁/火车";
  return "城际交通";
}

function isFlightTransport(text) {
  return /航班|\b[A-Z]{1,3}\d{3,5}\b/.test(cleanText(text));
}

function isRailTransport(text) {
  return /高铁|火车|动车|车次|火车站|高铁站|\b[GDC]\d{1,5}\b/.test(cleanText(text));
}

function transportRowFromTable(row, sectionTitle, source) {
  const headerText = Object.keys(row).filter((key) => !key.startsWith("__raw_")).join(" ");
  const cellText = Object.values(row).filter((value) => typeof value === "string").join(" ");
  const hasTransportHeader = /方向|路线|线路|区间|班次|车次|航班|出发|到达|时长|历时|票价|订票|查询/.test(headerText);
  const hasTransportCell = /航班|高铁|火车|动车|车次|机场|车站|地铁|公交|打车|网约车|出租|步行|接驳|包车|\b[A-Z]{1,3}\d{3,5}\b|\b[GDC]\d{1,5}\b/.test(cellText);
  const hotelOnlyTable = /酒店|住宿|房型|价格参考|飞猪链接/.test(headerText) && !/方向|路线|线路|区间|班次|车次|航班|出发|到达|时长|历时/.test(headerText);
  if (hotelOnlyTable || (!hasTransportHeader && !hasTransportCell)) return null;
  const code = rowValue(row, ["航班", "车次", "班次", "交通"]);
  const direction = rowValue(row, ["方向", "路线", "线路", "区间"]);
  const depart = rowValue(row, ["出发", "出发地", "起点"]);
  const arrive = rowValue(row, ["到达", "到达地", "终点"]);
  const duration = rowValue(row, ["时长", "历时", "用时"]);
  const price = rowValue(row, ["经济舱参考价", "二等座参考价", "价格", "费用", "票价"]);
  const note = rowValue(row, ["备注", "说明", "建议"]);
  const route = [
    direction,
    code,
    depart && arrive ? `${depart} → ${arrive}` : "",
  ].filter(Boolean).join(" · ") || cleanText(Object.values(row).filter((value) => typeof value === "string").join(" · "));
  if (!route) return null;
  const text = `${sectionTitle} ${route} ${note}`;
  return {
    type: inferTransportType(text, sectionTitle),
    route,
    duration,
    price,
    note,
    url: extractFirstUrl(rawRowValue(row, ["订票", "查询", "链接", "飞猪", "12306"])) || extractFirstUrl(rowValue(row, ["订票", "查询", "链接", "飞猪", "12306"])),
    source,
  };
}

function transportRowsFromBullets(block, sectionTitle, source) {
  return String(block || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/)?.[1])
    .filter(Boolean)
    .filter((rawItem) => /航班|高铁|火车|车次|机场|车站|市内|地铁|公交|打车|网约车|出租|步行|接驳|包车|\b[A-Z]{1,3}\d{3,5}\b|\b[GDC]\d{1,5}\b/.test(rawItem))
    .map((rawItem) => {
      const item = cleanText(rawItem);
      return {
      type: inferTransportType(`${sectionTitle} ${item}`),
      route: item,
      price: item.match(/¥\s*\d+(?:[-~—至]\d+)?/)?.[0],
      duration: item.match(/约?\d+(?:\.\d+)?\s*(?:小时|h|分钟|min)/i)?.[0],
      url: extractFirstUrl(rawItem),
      source,
    };
    });
}

function dedupeTransportRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = compactName(`${row.type}-${row.route}-${row.url || ""}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseTransport(destinationBrief, itineraryText) {
  const rows = [];
  const sourceBlocks = [
    ...headingBlocksMatching(destinationBrief, /怎么到达|城际交通|市内|景区交通|交通/, 2, 4).map((section) => ({ ...section, source: "destination-brief.md" })),
    ...headingBlocksMatching(itineraryText, /交通|航班|高铁|火车|车次|市内/, 2, 4).map((section) => ({ ...section, source: "itinerary.md" })),
  ];
  for (const section of sourceBlocks) {
    for (const table of parseMarkdownTables(section.block)) {
      for (const row of table) {
        const item = transportRowFromTable(row, section.title, `${section.source} 交通表（代表性样例数据）`);
        if (item) rows.push(item);
      }
    }
    rows.push(...transportRowsFromBullets(section.block, section.title, section.source));
  }

  const deduped = dedupeTransportRows(rows);
  const flights = deduped.filter((item) => isFlightTransport(`${item.type} ${item.route}`));
  const trains = deduped.filter((item) => isRailTransport(`${item.type} ${item.route}`));
  const local = deduped.filter((item) => !flights.includes(item) && !trains.includes(item) && /市内|景区|地铁|公交|打车|网约车|出租|步行|接驳|包车/.test(`${item.type} ${item.route}`));
  const intercity = deduped.filter((item) => !flights.includes(item) && !trains.includes(item) && !local.includes(item) && /城际|交通|机场|车站/.test(`${item.type} ${item.route}`));

  if (flights.length || trains.length || local.length || intercity.length) {
    return { flights, trains: [...trains, ...intercity], local };
  }
  return undefined;
}

const mapData = readJson("map-data.json") || {};
const ledger = readJson("research-ledger.json") || {};
const itineraryStructured = readJson("itinerary-structured.json") || {};
const destinationBrief = readText("destination-brief.md");
const itineraryText = readText("itinerary.md");
const reputationText = readText("reputation.md");

const tripParams = { ...parseTripParams(itineraryText), ...parseStructuredTripParams(itineraryStructured) };
const structuredDays = parseStructuredItineraryDays(itineraryStructured);
const days = structuredDays.length
  ? parsePlanOverviewIntoDaysFromStructured(itineraryStructured, structuredDays)
  : parsePlanOverviewIntoDays(itineraryText, parseItineraryDays(itineraryText));
const destination = firstPresent(mapData.destination, ledger.destination, path.basename(tripDir).split("-")[0]);
const overview = parseDestinationOverview(destinationBrief, tripParams);

const guidebookData = {
  destination,
  dateRange: tripParams.dateRange || mapData.trip_dates,
  duration: days.length ? `${days.length}天` : undefined,
  travelers: tripParams.travelers,
  origin: tripParams.origin,
  generatedAt: new Date().toISOString().slice(0, 10),
  itinerarySource: structuredDays.length ? "itinerary-structured.json" : "itinerary.md",
  overview,
  days,
  poiExperiences: parsePoiExperiences(reputationText, days),
  transport: parseTransportFromStructured(itineraryStructured) || parseTransport(destinationBrief, itineraryText),
  hotels: parseHotelsFromStructured(itineraryStructured, mapData) || parseHotels(reputationText, itineraryText, mapData),
  budget: parseBudgetFromStructured(itineraryStructured, tripParams) || parseBudget(itineraryText, tripParams),
  checklist: parseChecklist(itineraryText),
};

for (const key of Object.keys(guidebookData)) {
  if (guidebookData[key] === undefined || guidebookData[key] === "" || (Array.isArray(guidebookData[key]) && !guidebookData[key].length)) {
    delete guidebookData[key];
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(guidebookData, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: outputPath,
  days: days.length,
  poiExperiences: guidebookData.poiExperiences?.length || 0,
  hotels: guidebookData.hotels?.options?.length || 0,
  budgetRows: guidebookData.budget?.rows?.length || 0,
}, null, 2));
