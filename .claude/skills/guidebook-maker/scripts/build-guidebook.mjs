#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function usage() {
  console.error("Usage: node build-guidebook.mjs guidebook-data.json guidebook.html");
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  usage();
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readOptionalJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function readOptionalText(file) {
  if (!fs.existsSync(file)) return "";
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function loadEnv() {
  const candidates = [
    { file: path.join(process.cwd(), ".env"), override: true },
    { file: path.join(os.homedir(), ".codex", ".env"), override: false },
  ];
  for (const { file, override } of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [rawKey, ...rest] = line.split("=");
      const key = rawKey.trim();
      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key && value && (override || !process.env[key])) process.env[key] = value;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function compactText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("；");
  if (value && typeof value === "object") return Object.values(value).filter(Boolean).join("；");
  return value ? String(value) : "";
}

function normalizeInlineBreaks(value) {
  return String(value ?? "").replace(/<br\s*\/?>/gi, " · ");
}

function stripMarkdown(value) {
  return normalizeInlineBreaks(value)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstUrl(value) {
  const raw = String(value || "");
  const markdownUrl = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/)?.[1];
  const plainUrl = raw.match(/https?:\/\/[^\s)）]+/)?.[0];
  return (markdownUrl || plainUrl || "").replace(/[。。，，；;、]+$/, "");
}

function markdownInline(value) {
  let html = escapeHtml(normalizeInlineBreaks(value));
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => stripMarkdown(cell));
}

function collectMarkdownBullets(block, heading) {
  const lines = block.split(/\r?\n/);
  const items = [];
  let active = false;
  for (const line of lines) {
    if (line.includes(`**${heading}**`)) {
      active = true;
      continue;
    }
    if (!active) continue;
    if (/^\s*(---|###\s+|\*\*[^*]+\*\*)/.test(line)) break;
    const match = line.match(/^\s*-\s+(.*)$/);
    if (match) items.push(stripMarkdown(match[1]));
  }
  return items;
}

function collectMarkdownInlineField(block, heading) {
  const direct = block.match(new RegExp(`^\\\\s*-?\\\\s*\\\\*\\\\*${heading}\\\\*\\\\*[:：]\\\\s*(.+)$`, "m"));
  if (direct) return stripMarkdown(direct[1]);
  const line = block.match(new RegExp(`^\\\\s*${heading}[:：]\\\\s*(.+)$`, "m"));
  return line ? stripMarkdown(line[1]) : "";
}

function extractHeadingBlock(text, headingPattern, nextPattern = /^##\s+/gm) {
  if (!text) return "";
  const pattern = headingPattern instanceof RegExp ? headingPattern : new RegExp(`^#+\\\\s+${headingPattern}\\\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  nextPattern.lastIndex = start;
  const next = nextPattern.exec(text);
  return text.slice(start, next?.index ?? text.length);
}

function parseMarkdownTable(block) {
  const lines = String(block || "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line, index) => line.trim().startsWith("|") && lines[index + 1] && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]));
  if (headerIndex < 0) return [];
  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) break;
    const cells = splitMarkdownRow(line);
    if (cells.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }
  return rows;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  const isTableLine = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isTableSeparator = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const parseTableLine = (line) => {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => cell.trim());
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length + 2);
      html.push(`<h${level}>${markdownInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = parseTableLine(line);
      index += 2;
      const rows = [];
      while (index < lines.length && isTableLine(lines[index])) {
        rows.push(parseTableLine(lines[index]));
        index += 1;
      }
      html.push(`<div class="md-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${markdownInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${markdownInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[index]) : /^\s*[-*]\s+/.test(lines[index]))) {
        const item = lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        const checkbox = item.match(/^\[( |x|X)\]\s+(.*)$/);
        if (checkbox) {
          const checked = checkbox[1].toLowerCase() === "x" ? " checked" : "";
          items.push(`<li><input type="checkbox"${checked} disabled> ${markdownInline(checkbox[2])}</li>`);
        } else {
          items.push(`<li>${markdownInline(item)}</li>`);
        }
        index += 1;
      }
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${quote.map((item) => `<p>${markdownInline(item)}</p>`).join("")}</blockquote>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,6})\s+/.test(lines[index])
      && !/^```/.test(lines[index].trim())
      && !/^---+$/.test(lines[index].trim())
      && !isTableLine(lines[index])
      && !/^\s*[-*]\s+/.test(lines[index])
      && !/^\s*\d+\.\s+/.test(lines[index])
      && !/^\s*>/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${paragraph.map((item) => markdownInline(item.trim())).join("<br>")}</p>`);
  }

  return html.join("\n");
}

function stripArchiveProvenanceSections(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const kept = [];
  let skipLevel = 0;
  const sourceHeading = /^(#{2,6})\s*(来源与可信度|搜索与来源|数据来源|来源|Sources?|References?)\s*$/i;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+/);
    if (skipLevel && heading && heading[1].length <= skipLevel) skipLevel = 0;
    const sourceMatch = line.match(sourceHeading);
    if (!skipLevel && sourceMatch) {
      skipLevel = sourceMatch[1].length;
      continue;
    }
    if (!skipLevel) kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function loadSourceDocuments(dir) {
  return [
    { file: "destination-brief.md", title: "完整目的地简报", anchor: "doc-destination-brief" },
    { file: "itinerary.md", title: "完整行程原文", anchor: "doc-itinerary" },
    { file: "reputation.md", title: "完整口碑与避雷原文", anchor: "doc-reputation" },
  ].map((doc) => ({
    ...doc,
    text: stripArchiveProvenanceSections(readOptionalText(path.join(dir, doc.file))),
  })).filter((doc) => doc.text.trim());
}

function knownPoiNames(data, itineraryData) {
  const names = new Set();
  for (const poi of asArray(data.pois)) {
    if (poi?.name) names.add(String(poi.name));
  }
  for (const day of asArray(data.days)) {
    for (const poi of asArray(day?.pois)) {
      if (poi?.name) names.add(String(poi.name));
    }
  }
  for (const day of asArray(itineraryData?.days)) {
    for (const poi of asArray(firstPresent(day?.pois, day?.activities))) {
      if (poi?.name) names.add(String(poi.name));
      if (poi?.title) names.add(String(poi.title));
    }
  }
  return [...names].sort((a, b) => b.length - a.length);
}

function inferPoiName(text, knownNames = []) {
  if (!text) return "";
  return knownNames.find((name) => text.includes(name) || name.includes(text)) || "";
}

function comparableText(value) {
  return stripMarkdown(value)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,、\s]/g, "")
    .toLowerCase();
}

function isMoreSpecificTitle(candidate, current) {
  const candidateText = stripMarkdown(candidate);
  const currentText = stripMarkdown(current);
  return candidateText && currentText && candidateText.includes(currentText) && candidateText.length > currentText.length;
}

function titlesMatch(a, b) {
  const left = comparableText(a);
  const right = comparableText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return (left.length >= 5 && right.includes(left)) || (right.length >= 5 && left.includes(right));
}

function minutesFromClock(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationFromTimeRange(value) {
  const text = String(value || "");
  const match = text.match(/(\d{1,2}):(\d{2})\s*[—–-]\s*(次日)?\s*(\d{1,2}):(\d{2})/);
  if (!match) return "";
  let start = Number(match[1]) * 60 + Number(match[2]);
  let end = Number(match[4]) * 60 + Number(match[5]);
  if (match[3] || end < start) end += 24 * 60;
  const minutes = end - start;
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `约${rest}分钟`;
  return rest ? `约${hours}小时${rest}分钟` : `约${hours}小时`;
}

function inferTransportMode(title = "", type = "") {
  const text = `${title} ${type}`;
  if (/高铁|动车|火车|广州南|成都东|成都西|车站/.test(text)) return "高铁/火车";
  if (/机场.*→.*机场|白云机场.*天府机场|天府机场.*白云机场|双流机场.*白云机场|白云机场.*双流机场/.test(text)) return "飞机";
  if (/机场|酒店|景区|基地|市区|商圈/.test(text) && String(title).includes("→")) return "地铁/打车";
  if (/地铁|打车|出租|网约车|公交|景区直通车|自驾|包车/.test(text)) return text.match(/景区直通车|地铁\/打车|地铁|打车|出租|网约车|公交|自驾|包车/)?.[0] || "";
  return "";
}

function scoreActivityMatch(primary, candidate) {
  let score = 0;
  if (primary.time && candidate.time && primary.time === candidate.time) score += 5;
  if (titlesMatch(primary.title, candidate.title)) score += 4;
  if (primary.poiName && candidate.poiName && titlesMatch(primary.poiName, candidate.poiName)) score += 2;
  const primaryStart = minutesFromClock(primary.time);
  const candidateStart = minutesFromClock(candidate.time);
  if (primaryStart !== null && candidateStart !== null && Math.abs(primaryStart - candidateStart) <= 15) score += 2;
  return score;
}

function mergeActivityLists(primaryRaw, fallbackRaw, knownNames = []) {
  const primary = primaryRaw.map((activity) => normalizeActivity(activity, knownNames)).filter((activity) => activity.title);
  const fallback = fallbackRaw.map((activity) => normalizeActivity(activity, knownNames)).filter((activity) => activity.title);
  if (!primary.length) return fallback;
  const usedFallback = new Set();
  const merged = primary.map((activity) => {
    let bestIndex = -1;
    let bestScore = 0;
    fallback.forEach((candidate, index) => {
      if (usedFallback.has(index)) return;
      const score = scoreActivityMatch(activity, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const candidate = bestScore >= 4 ? fallback[bestIndex] : null;
    if (candidate) usedFallback.add(bestIndex);
    const title = isMoreSpecificTitle(candidate?.title, activity.title) ? candidate.title : activity.title;
    return {
      time: firstPresent(activity.time, candidate?.time),
      title,
      poiName: firstPresent(activity.poiName, candidate?.poiName, title),
      transport: firstPresent(activity.transport, candidate?.transport, inferTransportMode(title, activity.type)),
      cost: firstPresent(activity.cost, candidate?.cost),
      notes: firstPresent(activity.notes, candidate?.notes),
      duration: firstPresent(activity.duration, candidate?.duration, durationFromTimeRange(activity.time || candidate?.time)),
      source: firstPresent(activity.source, candidate?.source),
      tags: [...new Set([...asArray(candidate?.tags), ...asArray(activity.tags)])],
      type: firstPresent(activity.type, candidate?.type),
    };
  });
  fallback.forEach((activity, index) => {
    if (!usedFallback.has(index) && !merged.some((item) => titlesMatch(item.title, activity.title))) {
      merged.push(activity);
    }
  });
  return merged;
}

function parseItineraryMarkdown(text, knownNames = []) {
  if (!text) return new Map();
  const matches = [...text.matchAll(/^###\s+Day\s+(\d+)\s*[·.-]\s*(.+)$/gm)];
  const days = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const block = text.slice(match.index, next?.index ?? text.length);
    const day = Number(match[1]);
    const title = stripMarkdown(match[2]);
    const tableLines = block.split(/\r?\n/);
    const activities = [];
    const headerIndex = tableLines.findIndex((line) => /^\|\s*时间\s*\|\s*安排\s*\|\s*交通\s*\|\s*费用\s*\|\s*备注\s*\|/.test(line));
    if (headerIndex >= 0) {
      for (const line of tableLines.slice(headerIndex + 2)) {
        if (!line.trim().startsWith("|")) break;
        if (/^\|\s*[-:| ]+\s*\|$/.test(line.trim())) continue;
        const cells = splitMarkdownRow(line);
        if (cells.length < 5) continue;
        const titleText = cells[1];
        if (!cells[0] && /^[-•]/.test(titleText)) continue;
        activities.push({
          time: cells[0],
          title: titleText,
          poiName: inferPoiName(titleText, knownNames) || titleText,
          transport: cells[2],
          cost: cells[3],
          notes: cells[4],
        });
      }
    }
    days.set(day, {
      day,
      theme: title.replace(/（.*?）$/, "").trim(),
      activities,
      meals: collectMarkdownBullets(block, "今日餐食"),
      rest: collectMarkdownBullets(block, "休息与补给"),
      budget: collectMarkdownBullets(block, "今日预算"),
      reservations: collectMarkdownBullets(block, "预约提醒"),
      backup: [
        ...collectMarkdownBullets(block, "雨天/疲劳备用"),
        ...collectMarkdownBullets(block, "备用方案"),
      ],
      reminders: collectMarkdownBullets(block, "重点提醒"),
    });
  }
  return days;
}

function parseTransportMarkdown(text) {
  if (!text) return [];
  const block = extractHeadingBlock(text, /^##\s+交通与住宿参考\s*$/m, /^##\s+/gm)
    || extractHeadingBlock(text, /^###\s+城际交通\s*$/m, /^###\s+/gm)
    || text;
  const rows = [];
  let direction = "";
  let source = "";
  for (const rawLine of block.split(/\r?\n/)) {
    const line = stripMarkdown(rawLine);
    const url = extractFirstUrl(rawLine);
    const directionMatch = line.match(/^(去程|返程|高铁|火车|飞机|航班)[^：:]*[：:]?$/);
    if (directionMatch) direction = directionMatch[1];
    if (/^来源[:：]/.test(line)) {
      source = line.replace(/^来源[:：]\s*/, "");
      continue;
    }
    const item = line.match(/^-\s*(推荐航班|备选航班|高铁备选|火车备选|推荐高铁|备选高铁)[:：]\s*(.+)$/);
    if (!item) continue;
    const label = item[1];
    const body = item[2];
    const code = body.match(/^([A-Z]{1,3}\d{3,5}|G\d{1,5}|D\d{1,5}|C\d{1,5})/)?.[1] || "";
    const time = body.match(/[（(]([^）)]+\d{1,2}:\d{2}[^）)]*)[）)]/)?.[1] || "";
    const duration = body.match(/(?:飞行时间|行程时间)\s*([^，,；;]+)/)?.[1] || "";
    const price = body.match(/(?:参考价格|价格)\s*(¥[^，,；;]+)/)?.[1] || "";
    rows.push({
      type: `${direction ? `${direction} · ` : ""}${/高铁|火车/.test(label) ? "高铁" : "航班"}`,
      route: [code, time].filter(Boolean).join(" · ") || body,
      duration,
      cost: price,
      source: source || "itinerary.md",
      url,
    });
  }
  return rows;
}

function parseItineraryOverview(text) {
  const block = extractHeadingBlock(text, /^##\s+总体安排\s*$/m, /^##\s+/gm);
  return parseMarkdownTable(block).slice(0, 8).map((row) => ({
    day: row["天数"],
    theme: row["主题"],
    area: row["区域"],
    intensity: row["强度"],
    core: row["核心体验"],
    reminder: row["重点提醒"],
  }));
}

function parseReputationMarkdown(text) {
  if (!text) return new Map();
  const matches = [...text.matchAll(/^###\s+(.+)$/gm)];
  const map = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const name = stripMarkdown(match[1]);
    const block = text.slice(match.index, next?.index ?? text.length);
    if (/餐厅推荐|不辣|川菜体验/.test(name)) continue;
    map.set(name, {
      name,
      whyGo: collectMarkdownBullets(block, "推荐理由"),
      mustDo: collectMarkdownBullets(block, "首推体验"),
      recommendedDuration: collectMarkdownInlineField(block, "建议时长"),
      commonComplaints: collectMarkdownBullets(block, "常见差评"),
      avoid: collectMarkdownBullets(block, "避雷点"),
      suitable: collectMarkdownInlineField(block, "适合"),
      notSuitable: collectMarkdownInlineField(block, "不适合"),
      preparation: collectMarkdownBullets(block, "准备材料/亲子老人提醒"),
      queueAndReservation: collectMarkdownBullets(block, "预约/排队/价格提醒"),
      source: collectMarkdownInlineField(block, "来源信号"),
    });
  }
  return map;
}

function list(items) {
  const rows = asArray(items).map(compactText).filter(Boolean);
  if (!rows.length) return "";
  return `<ul>${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function chip(text, tone = "") {
  if (!text) return "";
  return `<span class="chip ${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function link(url, label = "查看") {
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function normalizeTrip(data) {
  const trip = data.trip || data;
  return {
    destination: firstPresent(trip.destination, data.destination, "目的地"),
    title: firstPresent(trip.title, data.title),
    dateRange: firstPresent(trip.dateRange, trip.date_range, trip.dates, data.dateRange, data.date_range, data.dates),
    duration: firstPresent(trip.duration, data.duration),
    travelers: firstPresent(trip.travelers, data.travelers),
    origin: firstPresent(trip.origin, data.origin),
    generatedAt: firstPresent(trip.generatedAt, data.generatedAt, data.generated_at, new Date().toISOString().slice(0, 10)),
    assumption: firstPresent(trip.assumption, data.assumption),
  };
}

function normalizeActivity(activity, knownNames = []) {
  const title = firstPresent(activity.title, activity.name, activity.arrangement, activity.activity, activity.poi);
  const inferredPoi = inferPoiName(String(title || ""), knownNames);
  return {
    time: firstPresent(activity.time, activity.period, activity.slot),
    title,
    poiName: firstPresent(activity.poiName, activity.poi_name, activity.name, inferredPoi, title),
    transport: firstPresent(activity.transport, activity.traffic),
    cost: firstPresent(activity.cost, activity.price, activity.fee),
    notes: firstPresent(activity.notes, activity.remark, activity.queue_or_friction, activity.tip),
    duration: firstPresent(activity.duration, activity.estimated_duration_minutes, activity.comfortable_duration_minutes),
    source: firstPresent(activity.source),
    tags: asArray(firstPresent(activity.tags, activity.labels)),
    type: firstPresent(activity.type, activity.category),
  };
}

function normalizeDays(data, itineraryData, itineraryText) {
  const guideDays = asArray(firstPresent(data.days, data.itinerary?.days));
  const handoffDays = asArray(itineraryData?.days);
  const names = knownPoiNames(data, itineraryData);
  const markdownDays = parseItineraryMarkdown(itineraryText, names);
  const count = Math.max(guideDays.length, handoffDays.length, markdownDays.size);
  return Array.from({ length: count }, (_, index) => {
    const day = guideDays[index] || {};
    const handoff = handoffDays[index] || {};
    const markdown = markdownDays.get(Number(firstPresent(day.day, handoff.day, index + 1))) || {};
    const rawActivities = asArray(firstPresent(day.activities, day.timeline, day.pois));
    const fallbackActivities = [
      ...asArray(markdown.activities),
      ...asArray(firstPresent(handoff.activities, handoff.timeline, handoff.pois)),
    ];
    const activities = mergeActivityLists(rawActivities, fallbackActivities, names);
    return {
      day: Number(firstPresent(day.day, handoff.day, markdown.day, index + 1)),
      date: firstPresent(day.date, day.dayDate, handoff.date),
      theme: firstPresent(day.theme, day.title, markdown.theme, handoff.theme, `第 ${index + 1} 天`),
      area: firstPresent(day.area, day.region, handoff.area, handoff.region),
      intensity: firstPresent(day.intensity, day.pace, handoff.intensity, handoff.pace),
      highlights: asArray(firstPresent(day.highlights, handoff.highlights)),
      meals: firstPresent(day.meals, day.food, markdown.meals, handoff.meals, handoff.food),
      rest: firstPresent(day.rest, day.restNotes, markdown.rest, handoff.rest, handoff.restNotes),
      budget: firstPresent(day.budget, day.costs, markdown.budget, handoff.budget, handoff.costs),
      reservations: firstPresent(day.reservations, day.booking, day.reservationReminders, markdown.reservations, handoff.reservations, handoff.booking),
      backup: firstPresent(day.backup, day.rainPlan, day.alternative, handoff.backup, handoff.rainPlan, handoff.alternative),
      reminders: asArray(firstPresent(day.reminders, day.warnings, markdown.reminders, handoff.reminders, handoff.warnings)),
      activities,
    };
  });
}

function normalizePoiExperiences(data, days, itineraryData, reputationText = "") {
  const explicit = asArray(firstPresent(data.poiExperiences, data.poi_experiences, data.experienceCards, data.pois));
  const cards = explicit.length ? explicit : [];
  const reputation = parseReputationMarkdown(reputationText);
  if (!cards.length) {
    for (const day of [...asArray(data.days), ...asArray(itineraryData?.days)]) {
      for (const poi of asArray(day?.pois)) {
        if (!poi?.name) continue;
        cards.push({
          name: poi.name,
          recommendedDuration: firstPresent(poi.recommendedDuration, poi.comfortable_duration_minutes, poi.estimated_duration_minutes),
          mustDo: poi.must_do,
          queueAndReservation: firstPresent(poi.queue_or_friction, poi.reservation_note),
          preparation: poi.preparation,
          familyNotes: firstPresent(poi.family_notes, poi.familyNotes),
          avoid: poi.avoid,
          source: poi.source,
        });
      }
    }
  }
  const dayByName = dayNameLookup(days);
  return cards.filter((item) => item?.name).map((item) => {
    const rep = reputation.get(String(item.name))
      || [...reputation.values()].find((candidate) => item.name.includes(candidate.name) || candidate.name.includes(item.name))
      || {};
    return {
      name: item.name,
      day: dayByName.get(String(item.name)) || "",
      rating: firstPresent(item.rating, item.grade),
      image: firstPresent(item.image, item.mainPic, item.photo),
      whyGo: asArray(firstPresent(item.whyGo, item.why_go, item.reasons, rep.whyGo)),
      recommendedDuration: firstPresent(item.recommendedDuration, item.duration, item.playTime, rep.recommendedDuration),
      mustDo: asArray(firstPresent(item.mustDo, item.must_do, rep.mustDo)),
      tips: firstPresent(item.tips, item.tip, item.notes, rep.whyGo?.[0]),
      queueAndReservation: asArray(firstPresent(item.queueAndReservation, item.queue, item.reservation, item.queue_or_friction, item.reservation_note, rep.queueAndReservation)),
      preparation: asArray(firstPresent(item.preparation, rep.preparation)),
      familyNotes: asArray(firstPresent(item.familyNotes, item.family_notes, item.family_fit)),
      avoid: asArray(firstPresent(item.avoid, item.avoidance, rep.avoid)),
      commonComplaints: asArray(firstPresent(item.commonComplaints, item.complaints, item.negative, rep.commonComplaints)),
      suitable: firstPresent(item.suitable, item.fit, rep.suitable),
      notSuitable: firstPresent(item.notSuitable, item.not_fit, rep.notSuitable),
      source: firstPresent(item.source, item.confidence, rep.source),
    };
  });
}

function dayNameLookup(days) {
  const lookup = new Map();
  for (const day of days) {
    for (const activity of day.activities) {
      for (const name of [activity.poiName, activity.title]) {
        if (name) lookup.set(String(name), day.day);
      }
    }
  }
  return lookup;
}

function normalizeHotels(data, mapData) {
  const hotelPayload = firstPresent(data.hotels, data.accommodation?.hotels);
  let strategy = "";
  let source = "";
  let options = [];
  const mapHotelByName = new Map(asArray(mapData?.hotels)
    .filter((hotel) => hotel?.name)
    .map((hotel) => [String(hotel.name), hotel]));
  if (Array.isArray(hotelPayload)) {
    options = hotelPayload;
  } else if (hotelPayload && typeof hotelPayload === "object") {
    strategy = firstPresent(hotelPayload.stayStrategy, hotelPayload.strategy, hotelPayload.summary);
    source = firstPresent(hotelPayload.source, hotelPayload.confidence);
    options = asArray(firstPresent(hotelPayload.options, hotelPayload.items, hotelPayload.hotels));
  }
  if (!options.length && Array.isArray(mapData?.hotels)) options = mapData.hotels.filter((hotel) => !hotel.error);
  return {
    strategy,
    source,
    options: options.map((hotel) => {
      const name = firstPresent(hotel.name, hotel.title, hotel.area);
      const mapHotel = mapHotelByName.get(String(name)) || {};
      return {
        ...mapHotel,
        ...hotel,
        name,
        area: firstPresent(hotel.area, hotel.interestsPoi, hotel.address, mapHotel.area, mapHotel.interestsPoi, mapHotel.address),
        price: firstPresent(hotel.price, hotel.priceReference, hotel.price_ref, mapHotel.price),
        roomType: firstPresent(hotel.roomType, hotel.room_type, hotel.roomTypeNote, hotel.room_type_note, mapHotel.room_type, mapHotel.room_type_note),
        url: firstPresent(hotel.bookingUrl, hotel.booking_url, hotel.detailUrl, hotel.jumpUrl, hotel.url, mapHotel.booking_url, mapHotel.detailUrl),
        image: firstPresent(hotel.mainPic, hotel.image, hotel.photo, mapHotel.mainPic),
        longitude: firstPresent(hotel.longitude, hotel.lng, mapHotel.longitude, mapHotel.lng),
        latitude: firstPresent(hotel.latitude, hotel.lat, mapHotel.latitude, mapHotel.lat),
        source: firstPresent(hotel.source, source, mapHotel.source, "FlyAI booking reference"),
      };
    }).filter((hotel) => hotel.name),
  };
}

function normalizeTransportRows(data, itineraryText = "") {
  const transport = data.transport || {};
  const rows = asArray(firstPresent(transport.items, transport.routes, data.routes));
  const flightRows = asArray(transport.flights).map((flight) => ({
    type: firstPresent(flight.type, "航班"),
    route: [flight.route, flight.option, flight.flightNo, flight.trainNo].filter(Boolean).join(" · "),
    duration: firstPresent(flight.duration, flight.time),
    cost: firstPresent(flight.price, flight.cost),
    source: firstPresent(flight.source, flight.notes),
    url: firstPresent(flight.url, flight.bookingUrl, flight.booking_url, flight.ticketUrl, flight.ticket_url, flight.detailUrl, flight.jumpUrl),
  }));
  const trainRows = asArray(transport.trains).map((train) => ({
    type: firstPresent(train.type, "高铁/火车"),
    route: [train.route, train.option, train.trainNo].filter(Boolean).join(" · "),
    duration: firstPresent(train.duration, train.time),
    cost: firstPresent(train.price, train.cost),
    source: firstPresent(train.source, train.notes),
    url: firstPresent(train.url, train.bookingUrl, train.booking_url, train.ticketUrl, train.ticket_url, train.detailUrl, train.jumpUrl),
  }));
  const localRows = asArray(transport.local).map((item) => {
    if (typeof item === "string") return { type: "市内交通", route: item, duration: "", cost: "", source: transport.source || "" };
    return {
      type: firstPresent(item.type, "市内交通"),
      route: firstPresent(item.route, item.name, item.summary),
      duration: firstPresent(item.duration, item.time, item.notes),
      cost: firstPresent(item.price, item.cost),
      source: firstPresent(item.source, transport.source),
      url: firstPresent(item.url, item.bookingUrl, item.booking_url, item.ticketUrl, item.ticket_url, item.detailUrl, item.jumpUrl),
    };
  });
  const markdownRows = parseTransportMarkdown(itineraryText);
  const allRows = [...rows, ...flightRows, ...trainRows, ...localRows, ...markdownRows]
    .map((row) => ({
      type: firstPresent(row.type, row.category, "交通"),
      route: firstPresent(row.route, row.name, row.summary),
      duration: firstPresent(row.duration, row.time),
      cost: firstPresent(row.cost, row.price),
      source: firstPresent(row.source, row.notes),
      url: firstPresent(row.url, row.bookingUrl, row.booking_url, row.ticketUrl, row.ticket_url, row.detailUrl, row.jumpUrl),
    }))
    .filter((row) => row.route);
  const seen = new Set();
  return allRows.filter((row) => {
    const key = comparableText(`${row.type}|${row.route}|${row.duration}|${row.cost}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitFoodDishes(value) {
  return String(value || "")
    .split(/[、,，/]/)
    .map((item) => stripMarkdown(item).replace(/[。；;]+$/, "").trim())
    .filter((item) => item && item.length <= 18);
}

function parentheticalNote(value) {
  return String(value || "").match(/[（(]([^）)]+)[）)]/)?.[1] || "";
}

function inferFoodArea(text) {
  const raw = String(text || "");
  const areas = ["春熙路", "太古里", "锦里", "宽窄巷子", "都江堰", "熊猫基地", "人民公园", "酒店附近", "市区", "景区内", "机场"];
  return areas.find((area) => raw.includes(area)) || "";
}

function cleanFoodName(value) {
  return stripMarkdown(value)
    .replace(/^\s*(早餐|午餐|晚餐|夜宵|餐食)\s*[：:]\s*/, "")
    .replace(/[；;].*$/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/^(推荐|备选)\s*/, "")
    .trim();
}

function addFoodItem(items, seen, item) {
  const name = cleanFoodName(firstPresent(item.name, item.item));
  const note = compactText(firstPresent(item.note, item.notes, item.avoid, item.tip, item.description));
  const normalized = {
    name,
    area: firstPresent(item.area, item.type),
    price: firstPresent(item.price, item.cost),
    dishes: asArray(item.dishes).length ? asArray(item.dishes) : splitFoodDishes(item.dishText),
    note,
    source: firstPresent(item.source),
  };
  if (!normalized.name) return;
  if (/酒店早餐|早餐[,，、]|早餐、|出发|退房/.test(normalized.name)) return;
  const key = comparableText(`${normalized.name}|${normalized.area}`);
  const existing = seen.get(key);
  if (existing) {
    existing.price = firstPresent(existing.price, normalized.price);
    existing.note = firstPresent(existing.note, normalized.note);
    existing.source = firstPresent(existing.source, normalized.source);
    existing.dishes = existing.dishes?.length ? existing.dishes : normalized.dishes;
    return;
  }
  seen.set(key, normalized);
  items.push(normalized);
}

function parseFoodFromDestinationBrief(text, items, seen) {
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = stripMarkdown(rawLine.replace(/^\s*[-*]\s*/, ""));
    if (!line || !/(美食|餐|吃|火锅|小吃|不辣|微辣)/.test(line)) continue;
    if (/不辣/.test(line) && /[:：]/.test(line)) {
      addFoodItem(items, seen, {
        name: "不辣/少辣小吃",
        area: "全城小吃店",
        dishText: line.split(/[:：]/).slice(1).join("："),
        note: "适合小朋友垫肚子；点餐时明确说不辣或少辣。",
        source: "destination-brief.md",
      });
    } else if (/火锅/.test(line) && /(鸳鸯|微辣|全家|小孩|儿童)/.test(line)) {
      addFoodItem(items, seen, {
        name: "鸳鸯锅/亲子火锅",
        area: inferFoodArea(line) || "春熙路/太古里或酒店周边",
        note: line,
        source: "destination-brief.md",
      });
    } else if (/小吃街|小吃/.test(line) && /(锦里|宽窄)/.test(line)) {
      addFoodItem(items, seen, {
        name: "锦里/宽窄巷子小吃",
        area: "锦里、宽窄巷子",
        note: "适合快速尝鲜和拍照，正餐优先放到街区外。",
        source: "destination-brief.md",
      });
    } else if (/川菜以辣|小孩|儿童|不辣|微辣/.test(line)) {
      addFoodItem(items, seen, {
        name: "点餐口味提醒",
        area: inferFoodArea(line) || "全程",
        note: line,
        source: "destination-brief.md",
      });
    }
  }
}

function parseFoodFromDays(days, items, seen) {
  for (const day of days) {
    const foodTexts = [];
    for (const activity of asArray(day.activities)) {
      const title = compactText(firstPresent(activity.title, activity.name, activity.activity));
      if (activity.type === "meal" || /(早餐|午餐|晚餐|餐|火锅|小吃)/.test(title)) {
        foodTexts.push([title, activity.notes, activity.cost].filter(Boolean).join("；"));
      }
    }
    for (const meal of asArray(day.meals)) foodTexts.push(compactText(meal));

    for (const text of foodTexts) {
      const clean = stripMarkdown(text);
      if (!clean || /^酒店含早/.test(clean) || /酒店早餐|早餐、|退房|出发/.test(clean)) continue;
      const body = clean.replace(/^\s*(早餐|午餐|晚餐|餐食)\s*[：:]\s*/, "");
      if (/火锅/.test(body)) {
        addFoodItem(items, seen, {
          name: "火锅初体验",
          area: inferFoodArea(body) || "春熙路/太古里或酒店周边",
          price: body.match(/¥[^；;]+/)?.[0] || "",
          note: firstPresent(parentheticalNote(body), "选择鸳鸯锅，儿童用清汤区；避开长队网红店。"),
          source: "itinerary.md",
        });
      } else if (/熊猫基地/.test(body) && /餐/.test(body)) {
        addFoodItem(items, seen, {
          name: "熊猫基地午餐策略",
          area: "熊猫基地/返回市区",
          price: body.match(/¥[^；;]+/)?.[0] || "",
          note: body.includes("排队") ? body : "基地内餐厅容易排队且偏贵，建议自带水和零食，或回市区午餐。",
          source: "itinerary.md",
        });
      } else if (/(锦里|宽窄巷子)/.test(body) && /(川菜|餐|小吃)/.test(body)) {
        addFoodItem(items, seen, {
          name: `${inferFoodArea(body) || "商业街"}周边用餐`,
          area: inferFoodArea(body),
          price: body.match(/¥[^；;]+/)?.[0] || "",
          note: body.includes("避开") ? body : "小吃尝鲜即可，正餐放到街区外的川菜馆。",
          source: "itinerary.md",
        });
      } else if (/都江堰/.test(body) && /(川菜|餐|市区)/.test(body)) {
        addFoodItem(items, seen, {
          name: "都江堰市区午餐",
          area: "都江堰市区",
          price: body.match(/¥[^；;]+/)?.[0] || "",
          note: "景区内餐厅偏贵，午餐优先放在都江堰市区。",
          source: "itinerary.md",
        });
      } else if (/川菜馆|餐厅|餐/.test(body)) {
        addFoodItem(items, seen, {
          name: cleanFoodName(body),
          area: inferFoodArea(body),
          price: body.match(/¥[^；;]+/)?.[0] || "",
          note: firstPresent(parentheticalNote(body), "带小朋友点不辣或微辣菜品。"),
          source: "itinerary.md",
        });
      } else if (/小吃|美食/.test(body)) {
        addFoodItem(items, seen, {
          name: cleanFoodName(body),
          area: inferFoodArea(body),
          note: parentheticalNote(body),
          source: "itinerary.md",
        });
      }
    }
  }
}

function parseFoodFromReputation(text, items, seen) {
  const lines = String(text || "").split(/\r?\n/).map((line) => stripMarkdown(line.replace(/^\s*[-*\d.]+\s*/, ""))).filter(Boolean);
  for (const line of lines) {
    if (line.includes("|")) continue;
    if (/园区内餐厅.*(排队|价格高|贵)/.test(line)) {
      addFoodItem(items, seen, {
        name: "景区内餐饮避雷",
        area: inferFoodArea(line) || "热门景区",
        note: line,
        source: "reputation.md",
      });
    } else if (/(锦里|宽窄巷子|这里)/.test(line) && /(不要.*吃正餐|小吃.*贵|游客价|又贵又难吃|口味一般)/.test(line)) {
      const area = line.includes("宽窄") ? "宽窄巷子" : line.includes("锦里") ? "锦里" : "商业街";
      addFoodItem(items, seen, {
        name: `${area}小吃避雷`,
        area,
        note: line.replace(/^["“]|["”]$/g, ""),
        source: "reputation.md",
      });
    }
  }
}

function isDiningWarning(item) {
  return /(避雷|不要|游客价|又贵又难吃|口味一般|排队|价格高|偏高|谨慎|避开)/.test(`${item.name || ""}${item.note || ""}`);
}

function normalizeFood(data, context = {}) {
  const food = Array.isArray(data.food) ? { items: data.food } : (data.food || {});
  const items = [];
  const seen = new Map();
  for (const item of asArray(firstPresent(food.items, data.foodItems))) addFoodItem(items, seen, item);
  parseFoodFromDays(context.days || [], items, seen);
  parseFoodFromDestinationBrief(context.destinationBriefText, items, seen);
  parseFoodFromReputation(context.reputationText, items, seen);
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => Number(isDiningWarning(right.item)) - Number(isDiningWarning(left.item)) || left.index - right.index)
    .map(({ item }) => item)
    .slice(0, 10);
}

function normalizeBudget(data) {
  const budget = data.budget || {};
  const labelMap = {
    transport: "交通",
    accommodation: "住宿",
    tickets: "门票",
    food: "餐饮",
    shopping: "特产",
    buffer: "机动",
  };
  const explicitRows = asArray(firstPresent(budget.items, budget.rows, data.budgetItems));
  const rows = explicitRows.length ? explicitRows.map((row) => ({
    item: firstPresent(row.item, row.name, row.category, row.label),
    amount: firstPresent(row.amount, row.cost, row.comfortable, row.economy, row.value),
    note: firstPresent(row.note, row.notes, row.remark),
  })) : Object.entries(budget)
    .filter(([key, value]) => key !== "total" && value && typeof value !== "object")
    .map(([key, value]) => ({ item: labelMap[key] || key, amount: value, note: "" }));
  const total = typeof budget.total === "object"
    ? Object.entries(budget.total).map(([key, value]) => `${key}: ${value}`).join("；")
    : budget.total;
  return { rows: rows.filter((row) => row.item), total };
}

function normalizeRouteSegments(mapData, days) {
  const mapRoutes = asArray(mapData?.routes)
    .flatMap((route) => {
      if (Array.isArray(route?.segments)) {
        return route.segments.map((segment) => ({
          ...segment,
          day: firstPresent(segment.day, route.day),
          source: firstPresent(segment.source, route.source, "map-data"),
        }));
      }
      return route;
    })
    .map((route) => ({
      ...route,
      mode: firstPresent(route.mode, route.method, route.transport),
      duration: firstPresent(route.duration, route.duration_text, route.duration_min ? `${route.duration_min}分钟` : "", route.duration_minutes ? `${route.duration_minutes}分钟` : ""),
      cost: firstPresent(route.cost, route.cost_cny ? `¥${route.cost_cny}` : ""),
    }))
    .filter((route) => !(route.mode === "walking" && Number(route.duration_min) > 45));
  const fromDays = [];
  for (const day of days) {
    for (const activity of day.activities) {
      const title = String(activity.title || "");
      const transport = String(activity.transport || "");
      const type = String(activity.type || "");
      if (["meal", "rest", "attraction", "activity"].includes(type) && !title.includes("→")) continue;
      const isMovement = type === "transport"
        || title.includes("→")
        || (/出发|返回|前往|抵达|机场|车站|办理登机/.test(title) && /飞机|高铁|火车|地铁|打车|出租|网约车|公交|机场|车站|自驾|包车/.test(transport));
      if (!isMovement) continue;
      const [from, to] = String(activity.title || "").split("→").map((part) => stripMarkdown(part));
      const duration = firstPresent(activity.duration, activity.notes, durationFromTimeRange(activity.time));
      const cost = activity.cost || "";
      fromDays.push({
        day: day.day,
        from: to ? from : "",
        to: to || stripMarkdown(activity.title),
        mode: firstPresent(activity.transport, inferTransportMode(title, activity.type)),
        duration: duration === "-" ? "" : duration,
        cost: cost === "-" ? "" : cost,
        source: "itinerary-data",
      });
    }
  }
  const usefulFromDays = fromDays.filter((route) => route.mode || route.duration || route.cost);
  return usefulFromDays.length ? usefulFromDays : mapRoutes;
}

function inferCategory(name = "", type = "") {
  const text = `${name} ${type}`;
  if (/机场|车站|火车站|高铁站|地铁|码头/.test(text)) return "transport";
  if (/酒店|民宿|客栈|宾馆|住宿/.test(text)) return "hotel";
  if (/餐厅|饭店|小吃|火锅|咖啡|茶|面馆/.test(text)) return "food";
  if (/博物馆|科技馆|美术馆|纪念馆|展览馆/.test(text)) return "culture";
  if (/商圈|街|巷|广场|太古里|步行街/.test(text)) return "city";
  return "attraction";
}

function categoryLabel(category) {
  return {
    transport: "交",
    hotel: "住",
    food: "食",
    culture: "文",
    city: "街",
    attraction: "景",
  }[category] || "点";
}

function normalizeMapPayload(mapData, days, hotels, routeSegments = []) {
  const dayByName = dayNameLookup(days);
  const pois = asArray(mapData?.pois).map((poi, index) => {
    const name = firstPresent(poi.name, poi.original_name, `地点 ${index + 1}`);
    const day = dayByName.get(String(poi.original_name || "")) || dayByName.get(String(name)) || "";
    const category = inferCategory(name, poi.type);
    return {
      id: `poi-${index + 1}`,
      name,
      originalName: poi.original_name,
      address: poi.address,
      location: Array.isArray(poi.location) ? poi.location : null,
      day,
      order: firstPresent(poi.order, index + 1),
      category,
      marker: categoryLabel(category),
      confidence: poi.confidence,
      source: poi.source,
    };
  });

  const hotelPois = hotels.options.map((hotel, index) => {
    const lng = Number(firstPresent(hotel.longitude, hotel.lng));
    const lat = Number(firstPresent(hotel.latitude, hotel.lat));
    return {
      id: `hotel-${index + 1}`,
      name: hotel.name,
      address: hotel.address,
      location: Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null,
      day: "",
      order: index + 1,
      category: "hotel",
      marker: "住",
      confidence: hotel.source,
      source: hotel.source,
      price: hotel.price,
      url: hotel.url,
      image: hotel.image,
    };
  });

  return {
    schemaVersion: mapData?.schema_version,
    pois,
    hotels: hotelPois,
    routes: routeSegments,
    generatedAt: mapData?.generated_at,
  };
}

function experienceFor(name, experiences) {
  if (!name) return null;
  const exact = experiences.find((item) => item.name === name);
  if (exact) return exact;
  return experiences.find((item) => name.includes(item.name) || item.name.includes(name)) || null;
}

function metricCards(data, trip, days, mapPayload, hotels) {
  const warnings = asArray(firstPresent(data.overview?.warnings, data.warnings, data.avoidance, data.reputationWarnings));
  const hotelCount = hotels.options.length;
  const routeCount = mapPayload.routes.length;
  const poiCount = mapPayload.pois.length;
  return `
    <div class="metric-grid" aria-label="行程总览指标">
      <div class="metric"><span>天数</span><strong>${escapeHtml(days.length || trip.duration || "-")}</strong></div>
      <div class="metric"><span>地图点位</span><strong>${escapeHtml(poiCount)}</strong></div>
      <div class="metric"><span>路线段</span><strong>${escapeHtml(routeCount)}</strong></div>
      <div class="metric"><span>酒店候选</span><strong>${escapeHtml(hotelCount)}</strong></div>
      <div class="metric warning"><span>重点提醒</span><strong>${escapeHtml(warnings.length)}</strong></div>
    </div>`;
}

function renderOverview(data, trip, days, mapPayload, hotels) {
  const overview = data.overview || {};
  const summary = firstPresent(overview.summary, data.summary, data.oneLine);
  const highlights = asArray(firstPresent(overview.highlights, data.highlights));
  const warnings = asArray(firstPresent(overview.warnings, data.warnings));
  return `
    <section class="panel overview-panel" id="overview">
      <div class="section-kicker">行程总览</div>
      <div class="overview-grid">
        <div>
          <h2>${escapeHtml(trip.destination)}怎么轻松玩</h2>
          ${summary ? `<p class="lead">${escapeHtml(summary)}</p>` : ""}
          <div class="quick-facts">
            ${chip(firstPresent(overview.pace, data.pace, "节奏待定"), "emerald")}
            ${chip(firstPresent(overview.stayArea, data.stayArea), "amber")}
            ${chip(firstPresent(overview.transportMode, data.transportMode), "blue")}
            ${chip(firstPresent(overview.budgetLevel, data.budgetLevel), "rose")}
          </div>
        </div>
        ${metricCards(data, trip, days, mapPayload, hotels)}
      </div>
      ${highlights.length ? `<div class="insight-strip">${highlights.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      ${warnings.length ? `<div class="alert-block"><strong>重点提醒</strong>${list(warnings)}</div>` : ""}
    </section>`;
}

function renderItineraryOverview(rows, days) {
  const compactRows = rows.length ? rows : days.map((day) => ({
    day: `Day ${day.day}`,
    theme: day.theme,
    area: day.area,
    intensity: day.intensity,
    core: day.highlights?.join("、"),
    reminder: day.reminders?.[0],
  }));
  if (!compactRows.length) return "";
  return `
    <section class="panel plan-overview" id="plan-overview">
      <div class="section-kicker">总体安排</div>
      <h2>每天的主题、强度和关键提醒</h2>
      <div class="plan-grid">
        ${compactRows.map((row) => `
          <article class="plan-card">
            <span>${escapeHtml(row.day || "")}</span>
            <h3>${escapeHtml(row.theme || "")}</h3>
            <p>${[row.area, row.intensity ? `强度：${row.intensity}` : ""].filter(Boolean).map(escapeHtml).join(" · ")}</p>
            ${row.core ? `<strong>${escapeHtml(row.core)}</strong>` : ""}
            ${row.reminder ? `<em>${escapeHtml(row.reminder)}</em>` : ""}
          </article>`).join("")}
      </div>
    </section>`;
}

function renderHero(trip) {
  const title = trip.title || `${trip.destination}旅行地图册`;
  const meta = [trip.dateRange, trip.duration, trip.travelers, trip.origin ? `${trip.origin}出发` : ""].filter(Boolean).join(" · ");
  return `
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Roammate Travel Atlas</p>
        <h1>${escapeHtml(title)}</h1>
        ${meta ? `<p class="hero-meta">${escapeHtml(meta)}</p>` : ""}
        ${trip.assumption ? `<p class="assumption">${escapeHtml(trip.assumption)}</p>` : ""}
      </div>
      <nav class="mode-nav" aria-label="页面导航">
        <a href="#plan-overview">行程总览</a>
        <a href="#transport-board">交通参考</a>
        <a href="#dashboard">地图工作台</a>
        <a href="#poi-dossier">地点档案</a>
        <a href="#hotel-board">酒店组合</a>
        <a href="#full-docs">完整资料</a>
      </nav>
    </header>`;
}

function renderDayTabs(days) {
  if (!days.length) return "";
  return `
    <div class="day-tabs" role="tablist" aria-label="每日行程">
      <button class="active" type="button" data-day-tab="all">全部</button>
      ${days.map((day) => `<button type="button" data-day-tab="${escapeHtml(day.day)}">Day ${escapeHtml(day.day)}</button>`).join("")}
    </div>`;
}

function isMovementActivity(activity) {
  return String(activity.type || "") === "transport"
    || String(activity.title || "").includes("→")
    || /飞机|高铁|火车|机场|车站|自驾|包车/.test(String(activity.transport || ""));
}

function renderActivity(activity, day) {
  const exp = activity.poiName ? "has-detail" : "";
  const durationLabel = activity.duration ? `${isMovementActivity(activity) ? "耗时" : "停留"} ${activity.duration}` : "";
  return `
    <button class="activity-card ${exp}" type="button" data-focus-poi="${escapeHtml(activity.poiName || activity.title)}" data-day="${escapeHtml(day.day)}">
      <span class="time">${escapeHtml(activity.time || "时间待定")}</span>
      <span class="activity-main">
        <strong>${escapeHtml(activity.title)}</strong>
        <span>${[durationLabel, activity.transport, activity.notes].filter(Boolean).map(escapeHtml).join(" · ")}</span>
      </span>
      ${activity.cost ? `<span class="cost">${escapeHtml(activity.cost)}</span>` : ""}
    </button>`;
}

function renderDayCards(days) {
  if (!days.length) return "";
  return `
    <section class="panel timeline-panel" aria-label="每日安排">
      <div class="section-kicker">每日安排</div>
      <h2>按天切换，地图同步看路线</h2>
      ${renderDayTabs(days)}
      <div class="day-stack">
        ${days.map((day) => `
          <article class="day-card" data-day-card="${escapeHtml(day.day)}">
            <div class="day-card-head">
              <div>
                <span class="day-badge">Day ${escapeHtml(day.day)}</span>
                <h3>${escapeHtml(day.theme)}</h3>
                <p>${[day.date, day.area, day.intensity ? `强度：${day.intensity}` : ""].filter(Boolean).map(escapeHtml).join(" · ")}</p>
              </div>
            </div>
            <div class="activity-list">
              ${day.activities.map((activity) => renderActivity(activity, day)).join("")}
            </div>
            <div class="day-notes">
              ${day.highlights?.length ? `<p><strong>核心</strong>${escapeHtml(day.highlights.join("、"))}</p>` : ""}
              ${day.meals ? `<p><strong>餐食</strong>${escapeHtml(compactText(day.meals))}</p>` : ""}
              ${day.rest ? `<p><strong>休息</strong>${escapeHtml(compactText(day.rest))}</p>` : ""}
              ${day.budget ? `<p><strong>预算</strong>${escapeHtml(compactText(day.budget))}</p>` : ""}
              ${day.reservations ? `<p><strong>预约</strong>${escapeHtml(compactText(day.reservations))}</p>` : ""}
              ${day.backup ? `<p><strong>备选</strong>${escapeHtml(compactText(day.backup))}</p>` : ""}
              ${day.reminders?.length ? `<div><strong>提醒</strong>${list(day.reminders)}</div>` : ""}
            </div>
          </article>`).join("")}
      </div>
    </section>`;
}

function renderTransportRows(rows) {
  if (!rows.length) return "";
  return `
    <section class="panel transport-panel" id="transport-board">
      <div class="section-kicker">交通参考</div>
      <h2>城际航班/车次与市内移动</h2>
      <div class="transport-grid">
        ${rows.map((row) => `
          <article class="transport-card">
            <span>${escapeHtml(row.type || "交通")}</span>
            <h3>${escapeHtml(row.route || "")}</h3>
            <p>${[row.duration, row.cost].filter(Boolean).map(escapeHtml).join(" · ")}</p>
            ${row.url ? `<div>${link(row.url, /航班|高铁|火车|车次/.test(row.type || "") ? "订票/查询" : "查看链接")}</div>` : ""}
            ${row.source ? `<small>${escapeHtml(row.source)}</small>` : ""}
          </article>`).join("")}
      </div>
    </section>`;
}

function renderMapPanel(mapPayload) {
  const hasHotelLocations = mapPayload.hotels.some((hotel) => Array.isArray(hotel.location));
  const legend = [
    ["景", "景点"],
    ["文", "文化"],
    ["街", "街区"],
    ["食", "餐饮"],
    ...(hasHotelLocations ? [["住", "住宿"]] : []),
    ["交", "交通"],
  ];
  return `
    <section class="map-panel" id="dashboard" aria-label="地图与交通">
      <div class="map-toolbar">
        <div>
          <div class="section-kicker">地图与交通</div>
          <h2>${hasHotelLocations ? "每日点位、交通和酒店位置" : "每日点位和交通提示"}</h2>
        </div>
        <div class="map-legend">
          ${legend.map(([label, name]) => `<span><i>${label}</i>${escapeHtml(name)}</span>`).join("")}
        </div>
      </div>
      <div class="map-canvas" id="atlasMap">
        <div class="map-empty">
          <strong>地图加载中</strong>
          <span>地图线用于点位方位示意，真实交通以每日交通提示为准。</span>
        </div>
      </div>
      <div class="route-summary">
        ${mapPayload.routes.slice(0, 14).map((route) => `
          <button class="route-pill" type="button" data-focus-poi="${escapeHtml(route.to || route.from || "")}" data-route-day="${escapeHtml(route.day || "")}">
            <span>${route.day ? `Day ${escapeHtml(route.day)} · ` : ""}${escapeHtml(route.from ? `${route.from} → ${route.to || "终点"}` : route.to || "交通段")}</span>
            <strong>${escapeHtml([route.mode, route.duration_min ? `${route.duration_min} 分钟` : route.duration, route.cost].filter(Boolean).join(" · ") || "耗时待核实")}</strong>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderPoiDossiers(experiences) {
  if (!experiences.length) return "";
  return `
    <section class="panel dossier-panel" id="poi-dossier">
      <div class="section-kicker">重点景点怎么玩</div>
      <h2>地点档案：点击卡片查看完整攻略</h2>
      <div class="dossier-grid">
        ${experiences.map((item) => `
          <button class="dossier-card dossier-button" type="button" data-focus-poi="${escapeHtml(item.name)}" data-dossier="${escapeHtml(item.name)}">
            <span>${item.day ? `Day ${escapeHtml(item.day)}` : "地点"}</span>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.recommendedDuration || item.rating ? `<em>${[item.rating, item.recommendedDuration].filter(Boolean).map(escapeHtml).join(" · ")}</em>` : ""}
            ${item.whyGo.length || item.tips ? `<p>${escapeHtml(firstPresent(item.tips, item.whyGo[0]))}</p>` : ""}
            ${item.avoid.length || item.queueAndReservation.length ? `<small>${escapeHtml(firstPresent(item.queueAndReservation[0], item.avoid[0]))}</small>` : ""}
          </button>`).join("")}
      </div>
    </section>`;
}

function renderHotels(hotels) {
  if (!hotels.options.length) return "";
  return `
    <section class="panel hotel-panel" id="hotel-board">
      <div class="section-kicker">住宿决策</div>
      <h2>酒店组合：不同档次、位置和取舍</h2>
      ${hotels.strategy ? `<p class="lead">${escapeHtml(hotels.strategy)}</p>` : ""}
      <div class="hotel-grid">
        ${hotels.options.map((hotel) => `
          <article class="hotel-card" data-focus-hotel="${escapeHtml(hotel.name)}">
            ${hotel.image ? `<img src="${escapeHtml(hotel.image)}" alt="${escapeHtml(hotel.name)}">` : `<div class="hotel-image-fallback">住宿</div>`}
            <div class="hotel-card-body">
              <span class="tier">${escapeHtml(firstPresent(hotel.tier, hotel.type, "候选"))}</span>
              <h3>${escapeHtml(hotel.name)}</h3>
              <p>${escapeHtml(hotel.area || hotel.address || "")}</p>
              <div class="hotel-meta">
                ${chip(hotel.price || "价格波动", "amber")}
                ${chip(hotel.roomType || "FlyAI未返回具体房型", "blue")}
              </div>
              ${hotel.fit ? `<p>${escapeHtml(hotel.fit)}</p>` : ""}
              ${hotel.tradeoffs ? `<p class="tradeoff">${escapeHtml(compactText(hotel.tradeoffs))}</p>` : ""}
              <div class="card-actions">${hotel.url ? link(hotel.url, "飞猪查看") : "<span>飞猪链接缺失</span>"}</div>
            </div>
          </article>`).join("")}
      </div>
      ${hotels.source ? `<p class="source-note">${escapeHtml(hotels.source)}</p>` : ""}
    </section>`;
}

function renderFoodAndBudget(food, budget) {
  if (!food.length && !budget.rows.length && !budget.total) return "";
  return `
    <section class="panel split-panel">
      <div class="split-card">
        <div class="section-kicker">美食与口碑避雷</div>
        <h2>吃什么、哪里谨慎</h2>
        ${food.length ? food.map((item) => `
          <div class="mini-row">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${[item.area, item.price, item.dishes?.length ? item.dishes.join("、") : "", item.note].filter(Boolean).map(escapeHtml).join(" · ")}</span>
          </div>`).join("") : `<p class="muted">暂无结构化餐饮建议。</p>`}
      </div>
      <div class="split-card">
        <div class="section-kicker">预算</div>
        <h2>费用参考</h2>
        ${budget.rows.map((row) => `
          <div class="mini-row">
            <strong>${escapeHtml(row.item)}</strong>
            <span>${[row.amount, row.note].filter(Boolean).map(escapeHtml).join(" · ")}</span>
          </div>`).join("")}
        ${budget.total ? `<p class="total">合计参考：${escapeHtml(budget.total)}</p>` : ""}
      </div>
    </section>`;
}

function renderChecklist(data) {
  const checklist = data.checklist || {};
  const groups = Array.isArray(checklist) ? [{ title: "行前检查", items: checklist }] : Object.entries(checklist).map(([title, items]) => ({ title, items }));
  const nonEmpty = groups.filter((group) => asArray(group.items).length);
  if (!nonEmpty.length) return "";
  return `
    <section class="panel checklist-panel">
      <div class="section-kicker">行前检查</div>
      <h2>出发前别漏掉</h2>
      <div class="check-grid">
        ${nonEmpty.map((group) => `
          <div class="check-card">
            <h3>${escapeHtml(group.title)}</h3>
            ${asArray(group.items).map((item) => `<label><input type="checkbox"> <span>${escapeHtml(item)}</span></label>`).join("")}
          </div>`).join("")}
      </div>
    </section>`;
}

function renderSourceDocuments(documents) {
  if (!documents.length) return "";
  return `
    <section class="panel docs-intro" id="full-docs">
      <div class="section-kicker">完整资料库</div>
      <h2>原文归档：需要核对时再展开</h2>
      <p class="lead">主页面优先呈现可执行信息；原始简报、行程和口碑保留为折叠归档，避免把网页变成长文堆叠。</p>
      <div class="doc-jump">
        ${documents.map((doc) => `<a href="#${escapeHtml(doc.anchor)}">${escapeHtml(doc.title)}</a>`).join("")}
      </div>
    </section>
    ${documents.map((doc) => `
      <details class="panel source-doc" id="${escapeHtml(doc.anchor)}">
        <summary class="source-doc-summary">
          <span class="section-kicker">${escapeHtml(doc.file)}</span>
          <strong>${escapeHtml(doc.title)}</strong>
          <em>${escapeHtml(doc.text.split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "") || "展开查看原文")}</em>
        </summary>
        <div class="markdown-body">
          ${markdownToHtml(doc.text)}
        </div>
        <details class="raw-markdown">
          <summary>查看原始 Markdown</summary>
          <pre><code>${escapeHtml(doc.text)}</code></pre>
        </details>
      </details>`).join("")}`;
}

function css() {
  return `
    :root {
      --bg: #f4efe6;
      --paper: #fffdf8;
      --panel: #ffffff;
      --ink: #202823;
      --muted: #69736d;
      --line: #e7dccd;
      --accent: #1d766f;
      --accent-2: #c7563b;
      --amber: #b7791f;
      --blue: #2f6f9f;
      --rose: #a43e57;
      --shadow: 0 18px 50px rgba(38, 30, 20, 0.11);
      --radius: 8px;
      --day-1: #c7563b;
      --day-2: #2f8f5b;
      --day-3: #5276b7;
      --day-4: #b7791f;
      --day-5: #8461a8;
      --day-6: #1d766f;
    }
    * { box-sizing: border-box; }
    html { max-width: 100%; overflow-x: hidden; background: var(--bg); color: var(--ink); scroll-behavior: smooth; }
    body { max-width: 100%; overflow-x: hidden; margin: 0; font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.6; letter-spacing: 0; }
    a { color: var(--accent); text-decoration: none; font-weight: 700; }
    a:hover { text-decoration: underline; }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { max-width: 760px; margin-bottom: 14px; font-size: 40px; line-height: 1.12; }
    h2 { margin-bottom: 12px; font-size: 22px; line-height: 1.25; }
    h3 { margin-bottom: 8px; font-size: 16px; line-height: 1.35; }
    h4 { margin: 14px 0 6px; font-size: 13px; color: var(--accent); }
    button, input { font: inherit; }
    .atlas { min-height: 100vh; }
    .hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; padding: 34px clamp(18px, 4vw, 52px) 28px; background: #233029; color: #fff8ed; overflow: hidden; }
    .hero::after { content: ""; position: absolute; inset: auto -8% -42% 35%; height: 280px; background: linear-gradient(90deg, rgba(199,86,59,0.42), rgba(29,118,111,0.38)); transform: rotate(-6deg); opacity: .45; }
    .hero-copy { position: relative; z-index: 1; }
    .eyebrow, .section-kicker { margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-2); }
    .hero .eyebrow { color: #f3c287; }
    .hero-meta, .assumption { margin: 0; color: #e7dccd; }
    .assumption { margin-top: 8px; color: #f3c287; font-weight: 700; }
    .mode-nav { position: relative; z-index: 30; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .mode-nav a { display: inline-flex; min-height: 36px; align-items: center; padding: 7px 12px; border: 1px solid rgba(255,255,255,.25); border-radius: 999px; color: #fff8ed; background: rgba(255,255,255,.08); }
    img, canvas, svg, video { max-width: 100%; }
    .content { display: grid; gap: 18px; min-width: 0; padding: 18px clamp(14px, 3vw, 36px) 40px; }
    .content > * { min-width: 0; }
    .panel, .map-panel { background: rgba(255,253,248,.94); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
    .panel { padding: 22px; }
    .overview-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 22px; align-items: start; min-width: 0; }
    .lead { color: #3d4842; font-size: 16px; }
    .quick-facts, .hotel-meta { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { display: inline-flex; min-height: 26px; align-items: center; padding: 3px 9px; border-radius: 999px; background: #eef7f4; color: var(--accent); font-size: 12px; font-weight: 800; }
    .chip.amber { background: #fff4da; color: var(--amber); }
    .chip.blue { background: #e8f1fb; color: var(--blue); }
    .chip.rose { background: #fdecef; color: var(--rose); }
    .metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }
    .metric { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 2px; font-size: 22px; line-height: 1; }
    .metric.warning strong { color: var(--accent-2); }
    .insight-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .insight-strip span { padding: 8px 10px; border-radius: var(--radius); background: #f7efe2; color: #4b4034; }
    .alert-block { margin-top: 18px; padding: 14px 16px; border-left: 4px solid var(--accent-2); border-radius: 0 var(--radius) var(--radius) 0; background: #fff1e9; }
    .plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .plan-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fff; padding: 12px; }
    .plan-card span, .plan-card em { display: block; color: var(--accent-2); font-size: 12px; font-style: normal; font-weight: 800; }
    .plan-card p { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
    .plan-card strong { display: block; }
    .dashboard-grid { display: grid; grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr); gap: 18px; align-items: start; min-width: 0; }
    .timeline-panel { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow: auto; }
    .day-tabs { position: sticky; top: -22px; z-index: 3; display: flex; gap: 8px; margin: 12px -4px 14px; padding: 8px 4px; background: rgba(255,253,248,.96); border-bottom: 1px solid var(--line); }
    .day-tabs button { min-height: 34px; border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; background: #fff; color: var(--muted); cursor: pointer; }
    .day-tabs button.active { border-color: var(--accent); background: var(--accent); color: #fff; }
    .day-stack { display: grid; gap: 12px; }
    .day-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fff; overflow: hidden; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
    .day-card:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(31, 24, 17, .1); }
    .day-card.is-dimmed { display: none; }
    .day-card-head { padding: 14px; background: #f7f3ea; border-bottom: 1px solid var(--line); }
    .day-card-head p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
    .day-badge { display: inline-flex; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: var(--accent-2); color: #fff; font-size: 12px; font-weight: 800; }
    .activity-list { display: grid; gap: 0; }
    .activity-card { display: grid; grid-template-columns: 74px minmax(0, 1fr) auto; gap: 10px; width: 100%; padding: 12px 14px; border: 0; border-bottom: 1px solid var(--line); background: #fff; text-align: left; cursor: pointer; }
    .activity-card:hover, .activity-card.active { background: #eef7f4; }
    .activity-card .time { color: var(--accent); font-weight: 800; font-size: 13px; }
    .activity-main strong, .activity-main span { display: block; }
    .activity-main span { color: var(--muted); font-size: 13px; }
    .cost { color: var(--amber); font-weight: 800; white-space: nowrap; }
    .day-notes { padding: 12px 14px; background: #fffdf8; color: var(--muted); font-size: 13px; }
    .day-notes p { margin: 5px 0; }
    .day-notes strong { margin-right: 8px; color: var(--ink); }
    .map-panel { position: sticky; top: 14px; min-width: 0; max-width: 100%; overflow: hidden; }
    .map-toolbar { display: flex; justify-content: space-between; gap: 16px; padding: 16px 16px 10px; align-items: start; }
    .map-toolbar h2 { margin-bottom: 0; }
    .map-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; color: var(--muted); font-size: 12px; }
    .map-legend span { display: inline-flex; align-items: center; gap: 5px; }
    .map-legend i { display: inline-grid; width: 22px; height: 22px; place-items: center; border-radius: 999px; background: var(--ink); color: #fff; font-style: normal; font-size: 12px; }
    .map-canvas { position: relative; width: 100%; min-width: 0; min-height: 540px; overflow: hidden; background: #dfe7df; }
    #atlasMap, #atlasMap .amap-container { max-width: 100%; overflow: hidden; }
    #atlasMap .amap-container { background: #dfe7df; }
    .map-empty, .fallback-map { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; color: var(--muted); text-align: center; }
    .map-empty strong { display: block; color: var(--ink); font-size: 18px; }
    .fallback-map { display: block; background: linear-gradient(135deg, #e4eadf, #f6efe2); overflow: hidden; }
    .fallback-route-line { position: absolute; left: 10%; right: 10%; top: 50%; height: 4px; background: rgba(29,118,111,.42); transform: rotate(-8deg); }
    .fallback-node { position: absolute; transform: translate(-50%, -50%); display: grid; gap: 6px; justify-items: center; max-width: 150px; }
    .fallback-node i, .atlas-marker { display: grid; width: 34px; height: 34px; place-items: center; border: 2px solid #fff; border-radius: 999px; background: var(--accent); color: #fff; box-shadow: 0 8px 20px rgba(0,0,0,.18); font-style: normal; font-weight: 900; }
    .fallback-node span { padding: 4px 7px; border-radius: 999px; background: rgba(255,255,255,.88); color: var(--ink); font-size: 12px; white-space: nowrap; }
    .atlas-marker.hotel { background: var(--amber); }
    .atlas-marker.transport { background: var(--blue); }
    .atlas-marker.food { background: var(--rose); }
    .atlas-marker.culture { background: #8461a8; }
    .atlas-marker.city { background: var(--accent-2); }
    .route-summary { display: flex; gap: 8px; max-width: 100%; min-width: 0; padding: 12px 16px 16px; overflow-x: auto; border-top: 1px solid var(--line); background: #fffdf8; }
    .route-pill { flex: 0 0 auto; max-width: 300px; display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; text-align: left; cursor: pointer; }
    .route-pill span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .route-pill strong { color: var(--accent); font-size: 12px; }
    .transport-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
    .transport-card { padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; }
    .transport-card span { color: var(--accent-2); font-size: 12px; font-weight: 900; }
    .transport-card h3 { margin: 4px 0 6px; }
    .transport-card p { margin: 0; color: var(--accent); font-weight: 800; }
    .transport-card small { display: block; margin-top: 8px; color: var(--muted); }
    .dossier-grid, .hotel-grid, .check-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .dossier-card, .hotel-card, .check-card, .split-card { border: 1px solid var(--line); border-radius: var(--radius); background: #fff; overflow: hidden; }
    .dossier-button { width: 100%; min-height: 148px; display: grid; gap: 4px; align-content: start; padding: 14px; text-align: left; cursor: pointer; color: inherit; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .dossier-button:hover, .dossier-button:focus-visible { transform: translateY(-2px); border-color: rgba(29,118,111,.38); box-shadow: 0 12px 28px rgba(31, 24, 17, .12); outline: none; }
    .dossier-button span { color: var(--accent-2); font-size: 12px; font-weight: 800; }
    .dossier-button em { color: var(--muted); font-size: 12px; font-style: normal; }
    .dossier-button p { margin: 2px 0 0; color: #3d4842; font-size: 13px; }
    .dossier-button small { color: var(--accent-2); font-size: 12px; }
    ul { margin: 6px 0 0; padding-left: 19px; }
    li { margin: 3px 0; }
    .source-note, .muted { color: var(--muted); font-size: 13px; }
    .hotel-card { transition: transform .18s ease, box-shadow .18s ease; }
    .hotel-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(31, 24, 17, .12); }
    .hotel-card img, .hotel-image-fallback { width: 100%; height: 160px; object-fit: cover; background: #efe4d5; display: grid; place-items: center; color: var(--amber); font-weight: 900; }
    .hotel-card-body { padding: 14px; }
    .tier { color: var(--accent-2); font-size: 12px; font-weight: 900; }
    .tradeoff { color: var(--muted); }
    .card-actions { margin-top: 10px; }
    .split-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; background: transparent; border: 0; box-shadow: none; padding: 0; }
    .split-card { padding: 20px; box-shadow: var(--shadow); }
    .mini-row { padding: 10px 0; border-bottom: 1px solid var(--line); }
    .mini-row:last-child { border-bottom: 0; }
    .mini-row strong, .mini-row span { display: block; }
    .mini-row span { color: var(--muted); font-size: 13px; }
    .total { margin: 14px 0 0; color: var(--amber); font-weight: 900; }
    .check-card { padding: 14px; }
    .check-card label { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; color: #3d4842; }
    .docs-intro { scroll-margin-top: 18px; }
    .doc-jump { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .doc-jump a { display: inline-flex; min-height: 34px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: #fff; }
    .source-doc { scroll-margin-top: 18px; }
    .source-doc-summary { display: grid; gap: 4px; cursor: pointer; list-style: none; }
    .source-doc-summary::-webkit-details-marker { display: none; }
    .source-doc-summary strong { font-size: 20px; }
    .source-doc-summary em { color: var(--muted); font-style: normal; }
    .source-doc .markdown-body { max-width: 1080px; margin-top: 18px; }
    .markdown-body h3 { margin-top: 22px; font-size: 22px; line-height: 1.28; color: var(--ink); }
    .markdown-body h4 { margin-top: 20px; font-size: 18px; color: var(--accent); }
    .markdown-body h5 { margin: 18px 0 8px; font-size: 16px; color: var(--accent-2); }
    .markdown-body h6 { margin: 16px 0 7px; font-size: 14px; color: var(--muted); }
    .markdown-body p { margin: 8px 0; }
    .markdown-body strong { color: #17221d; }
    .markdown-body code { padding: 1px 5px; border-radius: 6px; background: #f1eadf; font-size: .92em; }
    .markdown-body pre { overflow: auto; padding: 12px; border-radius: var(--radius); background: #233029; color: #fff8ed; }
    .markdown-body blockquote { margin: 12px 0; padding: 10px 14px; border-left: 4px solid var(--accent); background: #eef7f4; color: #3d4842; }
    .markdown-body hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
    .markdown-body .md-table-wrap { overflow-x: auto; margin: 12px 0 16px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; }
    .markdown-body table { width: 100%; border-collapse: collapse; min-width: 680px; }
    .markdown-body th, .markdown-body td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; }
    .markdown-body th { background: #f7f3ea; color: #3d4842; font-weight: 900; }
    .markdown-body tr:last-child td { border-bottom: 0; }
    .raw-markdown { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 12px; }
    .raw-markdown summary { cursor: pointer; color: var(--accent); font-weight: 900; }
    .raw-markdown pre { max-height: 420px; overflow: auto; padding: 12px; border-radius: var(--radius); background: #233029; color: #fff8ed; white-space: pre-wrap; }
    .drawer-backdrop { position: fixed; inset: 0; z-index: 19; background: rgba(32,40,35,.28); opacity: 0; pointer-events: none; transition: opacity .18s ease; }
    .drawer-backdrop.open { opacity: 1; pointer-events: auto; }
    .drawer { position: fixed; top: 0; right: 0; z-index: 20; width: min(420px, 100vw); height: 100vh; background: var(--paper); border-left: 1px solid var(--line); box-shadow: -20px 0 60px rgba(0,0,0,.16); transform: translateX(105%); transition: transform .22s ease; overflow: auto; }
    .drawer.open { transform: translateX(0); }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px; border-bottom: 1px solid var(--line); background: #233029; color: #fff8ed; }
    .drawer-head h2 { margin: 0; font-size: 20px; }
    .drawer-close { width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(255,255,255,.1); color: #fff; cursor: pointer; }
    .drawer-body { padding: 18px; }
    .drawer-body img { width: 100%; max-height: 220px; object-fit: cover; border-radius: var(--radius); margin-bottom: 12px; }
    .drawer-field { padding: 10px 0; border-bottom: 1px solid var(--line); }
    .drawer-field strong { display: block; color: var(--accent); font-size: 12px; }
    @page { size: A4; margin: 12mm; }
    @media print {
      html, body { background: #fff; }
      .hero, .panel, .map-panel, .split-card { box-shadow: none; }
      .mode-nav, .map-canvas, .drawer, .day-tabs, .doc-jump { display: none !important; }
      .content, .dashboard-grid, .overview-grid, .split-panel { display: block; padding: 0; }
      .panel, .map-panel, .day-card, .dossier-card, .hotel-card, .check-card { break-inside: avoid; margin-bottom: 12px; }
      .timeline-panel, .map-panel { position: static; max-height: none; overflow: visible; }
    }
    @media (max-width: 1100px) {
      .hero, .overview-grid, .dashboard-grid, .split-panel { grid-template-columns: 1fr; }
      .mode-nav { justify-content: flex-start; }
      .timeline-panel, .map-panel { position: static; max-height: none; }
      .map-canvas { min-height: 420px; }
    }
    @media (max-width: 680px) {
      h1 { font-size: 28px; overflow-wrap: anywhere; }
      h2 { font-size: 20px; }
      .hero { display: block; padding: 28px 18px 22px; }
      .mode-nav { justify-content: flex-start; margin-top: 22px; }
      .mode-nav a { min-height: 34px; padding: 6px 10px; }
      .content { padding: 12px; }
      .panel { padding: 16px; }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .plan-grid, .dossier-grid, .hotel-grid, .check-grid { grid-template-columns: 1fr; }
      .day-tabs { overflow-x: auto; padding-bottom: 9px; }
      .day-tabs button { flex: 0 0 auto; }
      .activity-card { grid-template-columns: 62px minmax(0, 1fr); }
      .cost { grid-column: 2; }
      .map-toolbar { display: block; }
      .map-legend { justify-content: flex-start; margin-top: 10px; }
      .map-canvas { min-height: 360px; }
      .route-pill { max-width: min(280px, calc(100vw - 58px)); }
      .markdown-body table { min-width: 560px; }
      .drawer { top: auto; bottom: 0; width: 100%; height: auto; max-height: 86vh; border-left: 0; border-top: 1px solid var(--line); border-radius: 12px 12px 0 0; transform: translateY(105%); }
      .drawer.open { transform: translateY(0); }
    }
  `;
}

function js() {
  return `
    const data = window.__ROAMMATE_ATLAS__;
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const byName = new Map();
    [...data.map.pois, ...data.map.hotels].forEach((item) => {
      if (item.name) byName.set(item.name, item);
      if (item.originalName) byName.set(item.originalName, item);
    });
    const experiences = new Map(data.poiExperiences.map((item) => [item.name, item]));
    let map = null;
    const markers = new Map();
    const markerEntries = [];
    let routeLine = null;

    function matchExperience(target) {
      const names = [];
      if (typeof target === 'object' && target) {
        names.push(target.name, target.originalName);
      } else if (target) {
        names.push(target);
      }
      const expanded = [];
      for (const name of names.filter(Boolean)) {
        const mapped = byName.get(name);
        expanded.push(name, mapped?.name, mapped?.originalName);
      }
      const aliases = [...new Set(expanded.filter(Boolean))];
      for (const alias of aliases) {
        if (experiences.has(alias)) return experiences.get(alias);
      }
      return [...experiences.values()].find((item) => aliases.some((alias) => alias.includes(item.name) || item.name.includes(alias))) || null;
    }

    function markerClass(item) {
      return 'atlas-marker ' + esc(item.category || 'attraction');
    }

    function initMap() {
      const allPoints = [...data.map.pois, ...data.map.hotels].filter((item) => Array.isArray(item.location));
      if (window.AMap && data.amapKey && allPoints.length) {
        map = new AMap.Map('atlasMap', { zoom: 12, center: allPoints[0].location, mapStyle: 'amap://styles/fresh' });
        const path = data.map.pois.filter((item) => Array.isArray(item.location)).map((item) => item.location);
        if (path.length > 1) {
          routeLine = new AMap.Polyline({ path, strokeColor: '#1d766f', strokeWeight: 6, strokeOpacity: .82, lineJoin: 'round' });
          routeLine.setMap(map);
        }
        for (const item of allPoints) {
          const marker = new AMap.Marker({
            position: item.location,
            title: item.name,
            content: '<button class="' + markerClass(item) + '" type="button">' + esc(item.marker || '点') + '</button>',
            anchor: 'center',
          });
          marker.setMap(map);
          marker.on('click', () => openDrawer(item.name));
          markers.set(item.name, marker);
          markerEntries.push({ item, marker });
        }
        map.setFitView(null, false, [70, 70, 70, 70]);
      } else {
        renderFallbackMap(allPoints);
      }
    }

    function renderFallbackMap(points) {
      const canvas = $('#atlasMap');
      const usable = points.length ? points : data.map.pois;
      canvas.innerHTML = '<div class="fallback-map"><div class="fallback-route-line"></div></div>';
      const fallback = $('.fallback-map', canvas);
      usable.slice(0, 12).forEach((item, index) => {
        const left = 10 + (index % 6) * 16;
        const top = 28 + Math.floor(index / 6) * 32 + (index % 2) * 7;
        const node = document.createElement('button');
        node.className = 'fallback-node';
        node.type = 'button';
        node.style.left = left + '%';
        node.style.top = top + '%';
        node.innerHTML = '<i>' + esc(item.marker || '点') + '</i><span>' + esc(item.name) + '</span>';
        node.addEventListener('click', () => openDrawer(item.name));
        fallback.appendChild(node);
      });
    }

    function focusPoi(name) {
      if (!name) return;
      const item = byName.get(name) || [...byName.values()].find((candidate) => name.includes(candidate.name) || candidate.name.includes(name));
      $$('.activity-card').forEach((card) => card.classList.toggle('active', card.dataset.focusPoi === name));
      if (item && map && Array.isArray(item.location)) {
        map.setZoomAndCenter(14, item.location, true, 500);
        const marker = markers.get(item.name);
        if (marker?.setAnimation) {
          marker.setAnimation('AMAP_ANIMATION_BOUNCE');
          window.setTimeout(() => marker.setAnimation(null), 900);
        }
      }
      openDrawer(item?.name || name);
    }

    function field(label, value) {
      if (!value || (Array.isArray(value) && !value.length)) return '';
      const text = Array.isArray(value) ? '<ul>' + value.map((item) => '<li>' + esc(item) + '</li>').join('') + '</ul>' : esc(value);
      return '<div class="drawer-field"><strong>' + esc(label) + '</strong>' + text + '</div>';
    }

    function openDrawer(name) {
      const item = byName.get(name) || [...byName.values()].find((candidate) => name.includes(candidate.name) || candidate.name.includes(name)) || { name };
      const exp = matchExperience(item);
      const drawer = $('#atlasDrawer');
      $('#drawerTitle').textContent = item.name || name;
      $('#drawerBody').innerHTML = [
        item.image ? '<img src="' + esc(item.image) + '" alt="' + esc(item.name) + '">' : '',
        field('类型', [item.day ? 'Day ' + item.day : '', item.category, item.confidence].filter(Boolean).join(' · ')),
        field('地址', item.address),
        field('价格/链接', item.price ? item.price : ''),
        item.url ? '<div class="drawer-field"><strong>跳转</strong><a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">飞猪查看</a></div>' : '',
        exp ? field('口碑等级', exp.rating) : '',
        exp ? field('推荐理由', exp.whyGo) : '',
        exp ? field('核心判断', exp.tips) : '',
        exp ? field('建议时长', exp.recommendedDuration) : '',
        exp ? field('必玩/必看', exp.mustDo) : '',
        exp ? field('排队与预约', exp.queueAndReservation) : '',
        exp ? field('亲子提醒', exp.familyNotes) : '',
        exp ? field('准备材料', exp.preparation) : '',
        exp ? field('常见差评', exp.commonComplaints) : '',
        exp ? field('避雷', exp.avoid) : '',
        exp ? field('适合', exp.suitable) : '',
        exp ? field('不适合', exp.notSuitable) : '',
        field('来源', exp?.source || item.source),
      ].filter(Boolean).join('');
      drawer.classList.add('open');
      $('#drawerBackdrop')?.classList.add('open');
    }

    function closeDrawer() {
      $('#atlasDrawer')?.classList.remove('open');
      $('#drawerBackdrop')?.classList.remove('open');
    }

    function setDay(day) {
      $$('.day-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.dayTab === day));
      $$('.day-card').forEach((card) => card.classList.toggle('is-dimmed', day !== 'all' && card.dataset.dayCard !== day));
      $$('.route-pill').forEach((pill) => pill.style.display = day === 'all' || !pill.dataset.routeDay || pill.dataset.routeDay === day ? '' : 'none');
      if (map) {
        const activePoints = day === 'all'
          ? data.map.pois.filter((item) => Array.isArray(item.location))
          : data.map.pois.filter((item) => String(item.day) === String(day) && Array.isArray(item.location));
        markerEntries.forEach(({ item, marker }) => {
          const visible = day === 'all' || String(item.day) === String(day) || item.category === 'hotel';
          marker.setMap(visible ? map : null);
        });
        if (routeLine) {
          if (activePoints.length > 1) {
            routeLine.setPath(activePoints.map((item) => item.location));
            routeLine.setMap(map);
          } else {
            routeLine.setMap(null);
          }
        }
        const activeMarkers = activePoints.map((item) => markers.get(item.name)).filter(Boolean);
        if (activeMarkers.length) map.setFitView(activeMarkers, false, [90, 90, 90, 90]);
      }
    }

    $$('.day-tabs button').forEach((button) => button.addEventListener('click', () => setDay(button.dataset.dayTab)));
    $$('[data-focus-poi]').forEach((button) => button.addEventListener('click', () => focusPoi(button.dataset.focusPoi)));
    $$('[data-focus-hotel]').forEach((card) => card.addEventListener('click', () => focusPoi(card.dataset.focusHotel)));
    $$('.mode-nav a, .doc-jump a').forEach((link) => link.addEventListener('click', closeDrawer));
    $('#drawerClose')?.addEventListener('click', closeDrawer);
    $('#drawerBackdrop')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer();
    });
    initMap();
  `;
}

loadEnv();
const data = readJson(inputPath);
const mapData = readOptionalJson(path.join(path.dirname(inputPath), "map-data.json"));
const itineraryData = readOptionalJson(path.join(path.dirname(inputPath), "itinerary-data.json"));
const destinationBriefText = readOptionalText(path.join(path.dirname(inputPath), "destination-brief.md"));
const itineraryText = readOptionalText(path.join(path.dirname(inputPath), "itinerary.md"));
const reputationText = readOptionalText(path.join(path.dirname(inputPath), "reputation.md"));
const sourceDocuments = loadSourceDocuments(path.dirname(inputPath));
const trip = normalizeTrip(data);
const days = normalizeDays(data, itineraryData, itineraryText);
const planRows = parseItineraryOverview(itineraryText);
const hotels = normalizeHotels(data, mapData);
const poiExperiences = normalizePoiExperiences(data, days, itineraryData, reputationText);
const routeSegments = normalizeRouteSegments(mapData, days);
const mapPayload = normalizeMapPayload(mapData, days, hotels, routeSegments);
const transportRows = normalizeTransportRows(data, itineraryText);
const food = normalizeFood(data, { days, destinationBriefText, itineraryText, reputationText });
const budget = normalizeBudget(data);
const amapKey = firstPresent(data.map?.amapWebJsKey, process.env.AMAP_WEB_JS_API_KEY);
const amapSecurityJsCode = firstPresent(
  data.map?.amapSecurityJsCode,
  process.env.AMAP_SECURITY_JS_CODE,
  process.env.AMAP_WEB_JS_SECURITY_CODE,
);

const atlasData = {
  trip,
  days,
  poiExperiences,
  hotels: hotels.options,
  transport: transportRows,
  map: mapPayload,
  food,
  budget,
  amapKey: amapKey || "",
};

const sections = [
  renderHero(trip),
  `<main class="content">
    ${renderOverview(data, trip, days, mapPayload, hotels)}
    ${renderItineraryOverview(planRows, days)}
    ${renderTransportRows(transportRows)}
    <div class="dashboard-grid">
      ${renderDayCards(days)}
      ${renderMapPanel(mapPayload)}
    </div>
    ${renderPoiDossiers(poiExperiences)}
    ${renderHotels(hotels)}
    ${renderFoodAndBudget(food, budget)}
    ${renderChecklist(data)}
    ${renderSourceDocuments(sourceDocuments)}
  </main>`,
  `<div class="drawer-backdrop" id="drawerBackdrop"></div>`,
  `<aside class="drawer" id="atlasDrawer" aria-label="地点详情">
    <div class="drawer-head"><h2 id="drawerTitle">地点详情</h2><button class="drawer-close" id="drawerClose" type="button" aria-label="关闭">×</button></div>
    <div class="drawer-body" id="drawerBody"></div>
  </aside>`,
].join("\n");

const rawHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(trip.title || `${trip.destination}旅行地图册`)}</title>
  <style>${css()}</style>
  ${amapSecurityJsCode ? `<script>window._AMapSecurityConfig = { securityJsCode: ${safeJson(String(amapSecurityJsCode))} };</script>` : ""}
  ${amapKey ? `<script src="https://webapi.amap.com/maps?v=2.0&key=${escapeHtml(amapKey)}"></script>` : ""}
</head>
<body>
  <div class="atlas">
    ${sections}
  </div>
  <script>window.__ROAMMATE_ATLAS__ = ${safeJson(atlasData)};</script>
  <script>${js()}</script>
</body>
</html>
`;
const html = rawHtml.replace(/[ \t]+$/gm, "");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(JSON.stringify({ input: inputPath, output: outputPath, bytes: Buffer.byteLength(html), mode: "dashboard-atlas" }, null, 2));
