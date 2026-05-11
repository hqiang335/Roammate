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
const DEMO_AMAP_WEB_JS_KEY = "fbb979dc813d025582af9ec422d33750";
const DEMO_AMAP_SECURITY_JS_CODE = "e244a2946f6a6943e42edf7f9e363133";

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

function readOptionalJson(file) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  } catch {
    return null;
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

function transportGroupSignal(item) {
  const text = `${item?.type || ""} ${item?.route || item?.name || item?.summary || ""}`;
  if (/市内|城内|当地|本地|地铁|公交|出租|打车|网约车|步行|接驳|景区直通车/.test(text)) return "市内交通";
  if (/返程|回程|返航|返回|回到|回家/.test(text)) return "返程";
  if (/去程|出发|前往|抵达目的地/.test(text)) return "去程";
  return "";
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

function collectTextValues(value, output = []) {
  if (!value) return output;
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

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function searchText(value) {
  return decodeHtmlEntities(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\+"/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function textIncludes(haystack, needle) {
  const normalizedNeedle = searchText(needle);
  if (!normalizedNeedle) return true;
  return searchText(haystack).includes(normalizedNeedle);
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

function extractHeadingBlock(text, headingPattern) {
  const matches = [...String(text || "").matchAll(/^(#{2,4})\s+(.+)$/gm)];
  const matchIndex = matches.findIndex((match) => headingPattern.test(stripMarkdown(match[2])));
  if (matchIndex < 0) return "";
  const match = matches[matchIndex];
  const level = match[1].length;
  const start = match.index + match[0].length;
  const next = matches.slice(matchIndex + 1).find((candidate) => candidate[1].length <= level);
  return text.slice(start, next?.index ?? text.length);
}

function matchesHeading(pattern, value) {
  pattern.lastIndex = 0;
  return pattern.test(stripMarkdown(value));
}

function headingBlocksMatching(text, headingPattern) {
  const matches = [...String(text || "").matchAll(/^(#{2,4})\s+(.+)$/gm)];
  return matches
    .map((match, index) => {
      const level = match[1].length;
      const title = stripMarkdown(match[2]);
      const start = match.index + match[0].length;
      const next = matches.slice(index + 1).find((candidate) => candidate[1].length <= level);
      return { level, title, block: String(text || "").slice(start, next?.index ?? String(text || "").length) };
    })
    .filter((item) => matchesHeading(headingPattern, item.title));
}

function sourceHotelNames(reputationText) {
  const names = [];
  for (const section of headingBlocksMatching(reputationText, /住宿|酒店|候选/)) {
    for (const table of parseMarkdownTables(section.block)) {
      for (const row of table) {
        const name = row["酒店"] || row["名称"] || row["候选酒店"] || row["酒店名称"];
        if (name) names.push(stripMarkdown(name));
      }
    }
  }
  return [...new Set(names.filter(Boolean))];
}

function sourceBudgetLabels(itineraryText) {
  const block = extractHeadingBlock(itineraryText, /预算汇总/);
  return parseMarkdownTable(block)
    .map((row) => row["项目"] || row["类别"] || row["预算项"])
    .map(stripMarkdown)
    .filter((label) => label && !/合计/.test(label.replace(/\*/g, "")));
}

function sourceDailyActivityTitles(itineraryText) {
  const block = extractHeadingBlock(itineraryText, /每日行程/);
  return parseMarkdownTable(block)
    .map((row) => row["安排"] || row["活动"] || row["内容"])
    .map(stripMarkdown)
    .filter(Boolean)
    .slice(0, 12);
}

function compactName(value) {
  return stripMarkdown(value)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[，,、\s/·.-]/g, "")
    .toLowerCase();
}

function sourceDailyFieldSnippets(itineraryText) {
  const snippets = [];
  const matches = [...String(itineraryText || "").matchAll(/^###\s+Day\s+\d+.*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const next = matches[index + 1];
    const block = itineraryText.slice(matches[index].index, next?.index ?? itineraryText.length);
    for (const rawLine of block.split(/\r?\n/)) {
      const match = rawLine.match(/^\s*(?:-\s*)?(?:\*\*)?(今日餐食|休息与补给|核心体验\/首推项目|预算估算|今日预算|预约提醒|雨天\/疲劳备用)(?:\*\*)?[:：]\s*(.+)$/);
      if (match) snippets.push(stripMarkdown(match[2]).slice(0, 32));
    }
  }
  return snippets.filter((snippet) => snippet.length >= 4).slice(0, 24);
}

function isInternalBudgetLabel(label) {
  const text = String(label || "").trim();
  return /_/.test(text) || (/^[a-z][a-z0-9-]*$/i.test(text) && !/[一-龥]/.test(text));
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

function validatePublicAmapKeys(html) {
  if (process.env.ROAMMATE_ALLOW_LOCAL_AMAP_KEYS === "1") return;
  const scriptKeys = [...String(html || "").matchAll(/webapi\.amap\.com\/maps\?[^"'<>\s]*\bkey=([a-f0-9]{32})/gi)]
    .map((match) => match[1]);
  const atlasKeys = [...String(html || "").matchAll(/"amapKey"\s*:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter(Boolean);
  const securityCodes = [...String(html || "").matchAll(/securityJsCode\s*:\s*"([^"]+)"/g)]
    .map((match) => match[1]);
  for (const key of new Set([...scriptKeys, ...atlasKeys])) {
    if (key !== DEMO_AMAP_WEB_JS_KEY) {
      issues.push(`guidebook.html uses a non-demo Amap Web JS API key: ${key}. Public demos must use the roammate-demo key.`);
    }
  }
  if (scriptKeys.length && !securityCodes.length) {
    issues.push("guidebook.html loads Amap Web JS API without the roammate-demo securityJsCode.");
  }
  for (const code of new Set(securityCodes)) {
    if (code !== DEMO_AMAP_SECURITY_JS_CODE) {
      issues.push("guidebook.html uses a non-demo Amap securityJsCode. Public demos must use the roammate-demo security code.");
    }
  }
}

const data = readJson(dataPath);
const html = readText(htmlPath);
const docs = sourceDocuments(dataPath);
const atlasData = atlasDataFromHtml(html);
const itineraryText = readOptionalText(path.join(path.dirname(dataPath), "itinerary.md"));
const destinationBriefText = readOptionalText(path.join(path.dirname(dataPath), "destination-brief.md"));
const reputationText = readOptionalText(path.join(path.dirname(dataPath), "reputation.md"));
const itineraryStructured = readOptionalJson(path.join(path.dirname(dataPath), "itinerary-structured.json"));

if (data) {
  if (!data.destination && !data.trip?.destination) {
    issues.push("guidebook-data must include destination or trip.destination.");
  }
  if (!getDays(data).length) {
    issues.push("guidebook-data must include days or itinerary.days.");
  }
}

if (html) {
  validatePublicAmapKeys(html);
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
  for (const token of ["完整攻略正文", "直接采用 Markdown", "下面三部分来自同目录"]) {
    if (html.includes(token)) {
      issues.push(`guidebook.html contains implementation-facing report-dump copy: ${token}`);
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
  const transportSourceText = `${destinationBriefText}\n${itineraryText}`;
  const transportCodes = [...new Set([...transportSourceText.matchAll(/\b(?:[A-Z]{1,3}\d{3,5}|[GDC]\d{1,5})\b/g)].map((match) => match[0]))].slice(0, 10);
  for (const code of transportCodes) {
    if (!html.includes(code)) {
      issues.push(`guidebook.html missing concrete transport code from source Markdown: ${code}`);
    }
  }
  const itineraryTransportUrls = markdownUrls(transportSourceText)
    .filter((url) => {
      const line = transportSourceText.split(/\r?\n/).find((candidate) => candidate.includes(url)) || "";
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
    issues.push("Sibling Markdown files exist but guidebook.html should keep source Markdown as folded reference material.");
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
    if (isInternalBudgetLabel(label)) {
      issues.push(`Budget row label should be traveler-facing Chinese, not an internal key: ${label}`);
    }
    if (label && !html.includes(String(label))) {
      issues.push(`Budget row missing from guidebook.html: ${label}`);
    }
  }
  const dataText = collectTextValues(data).join("\n");
  if (itineraryStructured?.artifact_type === "itinerary-structured") {
    if (data.itinerarySource !== "itinerary-structured.json") {
      issues.push("guidebook-data.json should prefer itinerary-structured.json when it exists.");
    }
    for (const day of asArray(itineraryStructured.days)) {
      for (const row of asArray(day?.timelineRows)) {
        const title = row?.cells?.["安排"] || row?.cells?.["活动"] || row?.cells?.["内容"];
        if (title && !textIncludes(dataText, title)) {
          issues.push(`guidebook-data.json missing structured itinerary activity: ${title}`);
        }
        if (title && !textIncludes(html, title)) {
          issues.push(`guidebook.html missing structured itinerary activity: ${title}`);
        }
      }
      for (const [label, value] of Object.entries(day?.dailyDetails || {})) {
        const snippet = stripMarkdown(value).slice(0, 32);
        if (snippet.length >= 4 && !textIncludes(dataText, snippet) && !textIncludes(html, snippet)) {
          issues.push(`guidebook is missing structured itinerary detail ${label}: ${snippet}`);
        }
      }
    }
  }
  const sourceHotels = sourceHotelNames(reputationText);
  for (const hotelName of sourceHotels) {
    if (!textIncludes(dataText, hotelName)) {
      issues.push(`guidebook-data.json missing candidate hotel from reputation.md: ${hotelName}`);
    }
    if (!textIncludes(html, hotelName)) {
      issues.push(`guidebook.html missing candidate hotel from reputation.md: ${hotelName}`);
    }
  }
  if (sourceHotels.length) {
    const sourceHotelKeys = sourceHotels.map(compactName);
    for (const hotel of getHotels(data)) {
      const name = hotel?.name || hotel?.title;
      const key = compactName(name);
      if (key && !sourceHotelKeys.some((sourceKey) => key.includes(sourceKey) || sourceKey.includes(key))) {
        issues.push(`guidebook-data.json contains hotel not present in reputation.md candidates: ${name}`);
      }
    }
  }
  for (const label of sourceBudgetLabels(itineraryText)) {
    if (!textIncludes(dataText, label)) {
      issues.push(`guidebook-data.json missing budget item from itinerary.md: ${label}`);
    }
    if (!textIncludes(html, label)) {
      issues.push(`guidebook.html missing budget item from itinerary.md: ${label}`);
    }
  }
  for (const activityTitle of sourceDailyActivityTitles(itineraryText)) {
    if (!textIncludes(dataText, activityTitle)) {
      issues.push(`guidebook-data.json missing daily activity from itinerary.md: ${activityTitle}`);
    }
    if (!textIncludes(html, activityTitle)) {
      issues.push(`guidebook.html missing daily activity from itinerary.md: ${activityTitle}`);
    }
  }
  for (const snippet of sourceDailyFieldSnippets(itineraryText)) {
    if (!textIncludes(dataText, snippet) && !textIncludes(html, snippet)) {
      issues.push(`guidebook is missing itinerary.md daily detail snippet: ${snippet}`);
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
    const routeText = `${item?.route || ""} ${item?.name || ""} ${item?.summary || ""}`;
    for (const hotelName of sourceHotels) {
      if (hotelName && routeText.includes(hotelName)) {
        issues.push(`transport[${index}] appears to contain a hotel candidate instead of a traffic reference: ${hotelName}`);
      }
    }
  }
  const transportSignals = new Set(asArray(atlasData?.transport).map(transportGroupSignal).filter(Boolean));
  for (const label of transportSignals) {
    if (!html.includes(`<h3>${label}</h3>`)) {
      issues.push(`Transport reference should be grouped; missing group heading: ${label}`);
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
    if (/住宿|酒店|候选|区域判断|推荐档次/.test(String(poi?.name || ""))) {
      issues.push(`POI experience should not contain lodging/meta section: ${poi.name}`);
    }
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
