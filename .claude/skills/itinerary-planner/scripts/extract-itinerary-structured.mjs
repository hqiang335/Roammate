#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node extract-itinerary-structured.mjs TRAVEL/{destination-date} [output.json]");
  console.error("   or: node extract-itinerary-structured.mjs TRAVEL/{destination-date}/itinerary.md [output.json]");
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  usage();
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const inputIsMarkdown = path.basename(inputPath) === "itinerary.md";
const tripDir = inputIsMarkdown ? path.dirname(inputPath) : inputPath;
const itineraryPath = inputIsMarkdown ? inputPath : path.join(tripDir, "itinerary.md");
const outputPath = outputArg ? path.resolve(outputArg) : path.join(tripDir, "itinerary-structured.json");

function readText(file) {
  return fs.readFileSync(file, "utf8");
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
    .replace(/[。；;]+$/g, "")
    .trim();
}

function splitMarkdownRowRaw(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function splitMarkdownRow(line) {
  return splitMarkdownRowRaw(line).map(stripMarkdown);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ""));
}

function makeRow(headers, rawHeaders, rawCells, rawMarkdown, lineNumber) {
  const cells = {};
  const raw = {};
  headers.forEach((header, index) => {
    cells[header] = stripMarkdown(rawCells[index] || "");
    raw[rawHeaders[index] || header] = rawCells[index] || "";
  });
  return {
    line: lineNumber,
    cells,
    rawCells: raw,
    rawMarkdown,
  };
}

function parseFirstTable(blockLines, blockStartLine) {
  for (let index = 0; index < blockLines.length - 1; index += 1) {
    if (!blockLines[index].trim().startsWith("|") || !isTableSeparator(blockLines[index + 1])) continue;
    const rawHeaders = splitMarkdownRowRaw(blockLines[index]);
    const headers = rawHeaders.map(stripMarkdown);
    const rows = [];
    let cursor = index + 2;
    for (; cursor < blockLines.length; cursor += 1) {
      const line = blockLines[cursor];
      if (!line.trim().startsWith("|")) break;
      if (isTableSeparator(line)) continue;
      const rawCells = splitMarkdownRowRaw(line);
      if (rawCells.length !== headers.length) continue;
      rows.push(makeRow(headers, rawHeaders, rawCells, line, blockStartLine + cursor + 1));
    }
    return {
      line: blockStartLine + index + 1,
      headers,
      rawHeaders,
      rows,
      rawMarkdown: blockLines.slice(index, cursor).join("\n"),
      endOffset: cursor,
    };
  }
  return null;
}

function parseTables(blockLines, blockStartLine) {
  const tables = [];
  for (let index = 0; index < blockLines.length - 1; index += 1) {
    if (!blockLines[index].trim().startsWith("|") || !isTableSeparator(blockLines[index + 1])) continue;
    const rawHeaders = splitMarkdownRowRaw(blockLines[index]);
    const headers = rawHeaders.map(stripMarkdown);
    const rows = [];
    let cursor = index + 2;
    for (; cursor < blockLines.length; cursor += 1) {
      const line = blockLines[cursor];
      if (!line.trim().startsWith("|")) break;
      if (isTableSeparator(line)) continue;
      const rawCells = splitMarkdownRowRaw(line);
      if (rawCells.length !== headers.length) continue;
      rows.push(makeRow(headers, rawHeaders, rawCells, line, blockStartLine + cursor + 1));
    }
    if (rows.length) {
      tables.push({
        line: blockStartLine + index + 1,
        headers,
        rawHeaders,
        rows,
        rawMarkdown: blockLines.slice(index, cursor).join("\n"),
      });
    }
    index = Math.max(index, cursor - 1);
  }
  return tables;
}

function headingBlocks(text, minLevel = 2, maxLevel = 4) {
  const matches = [...text.matchAll(/^(#{2,4})\s+(.+)$/gm)];
  return matches
    .map((match, index) => {
      const level = match[1].length;
      const start = match.index + match[0].length;
      const next = matches.slice(index + 1).find((candidate) => candidate[1].length <= level);
      const before = text.slice(0, match.index);
      const startLine = before.split(/\r?\n/).length;
      return {
        level,
        title: cleanText(match[2]),
        heading: match[0],
        line: startLine,
        block: text.slice(start, next?.index ?? text.length),
      };
    })
    .filter((item) => item.level >= minLevel && item.level <= maxLevel);
}

function headingBlock(text, pattern) {
  return headingBlocks(text).find((item) => pattern.test(item.title)) || null;
}

const DAILY_LABELS = [
  "今日餐食",
  "休息与补给",
  "核心体验/首推项目",
  "预算估算",
  "预约提醒",
  "雨天/疲劳备用",
];

function dailyLabelPattern() {
  return new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?(${DAILY_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\*\\*)?[:：]\\s*(.*)$`);
}

function parseDailyDetails(blockLines, blockStartLine) {
  const details = {};
  const rawLines = [];
  const labelRegex = dailyLabelPattern();
  for (let index = 0; index < blockLines.length; index += 1) {
    const match = blockLines[index].match(labelRegex);
    if (!match) continue;
    const label = match[1];
    const values = [];
    if (match[2]?.trim()) values.push(match[2].trim());
    rawLines.push({ line: blockStartLine + index + 1, label, rawMarkdown: blockLines[index] });
    let cursor = index + 1;
    while (cursor < blockLines.length) {
      const nextLine = blockLines[cursor];
      if (!nextLine.trim()) break;
      if (/^#{2,4}\s+/.test(nextLine)) break;
      if (labelRegex.test(nextLine)) break;
      if (nextLine.trim().startsWith("|")) break;
      const bullet = nextLine.match(/^\s+(?:[-*]|\d+\.)\s+(.+)$/)?.[1];
      if (bullet) {
        values.push(bullet.trim());
        rawLines.push({ line: blockStartLine + cursor + 1, label, rawMarkdown: nextLine });
        cursor += 1;
        continue;
      }
      if (/^\s{2,}\S/.test(nextLine)) {
        values.push(nextLine.trim());
        rawLines.push({ line: blockStartLine + cursor + 1, label, rawMarkdown: nextLine });
        cursor += 1;
        continue;
      }
      break;
    }
    details[label] = values.map(cleanText).filter(Boolean).join("；");
  }
  return { details, rawLines };
}

function parseTripParams(text) {
  const block = headingBlock(text, /^行程参数$/);
  const params = {};
  if (!block) return params;
  for (const rawLine of block.block.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*-\s*(?:\*\*)?([^*：:]+)(?:\*\*)?[:：]\s*(.+)$/);
    if (!match) continue;
    params[cleanText(match[1])] = cleanText(match[2]);
  }
  return params;
}

function parseSectionTables(text, pattern) {
  const block = headingBlock(text, pattern);
  if (!block) return [];
  return parseTables(block.block.split(/\r?\n/), block.line);
}

function rowValue(row, names) {
  for (const name of names) {
    if (row.cells?.[name]) return row.cells[name];
    const key = Object.keys(row.cells || {}).find((candidate) => candidate.includes(name) || name.includes(candidate));
    if (key && row.cells[key]) return row.cells[key];
  }
  return "";
}

function extractFirstUrl(value) {
  const raw = String(value || "");
  const markdownUrl = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/)?.[1];
  const plainUrl = raw.match(/https?:\/\/[^\s)）]+/)?.[0];
  return (markdownUrl || plainUrl || "").replace(/[。。，，；;、]+$/, "");
}

function extractTransportAndHotels(text) {
  const section = headingBlock(text, /^交通与住宿参考$/);
  if (!section) return { sections: [], transportRows: [], hotelCandidates: [] };
  const subsections = headingBlocks(section.block, 3, 4);
  const sections = [];
  const transportRows = [];
  const hotelCandidates = [];
  for (const subsection of subsections) {
    const tables = parseTables(subsection.block.split(/\r?\n/), section.line + subsection.line);
    const tablePayload = tables.map((table) => ({
      line: table.line,
      headers: table.headers,
      rows: table.rows,
      rawMarkdown: table.rawMarkdown,
    }));
    sections.push({
      title: subsection.title,
      line: section.line + subsection.line,
      tables: tablePayload,
      rawMarkdown: subsection.block.trim(),
    });
    for (const table of tables) {
      for (const row of table.rows) {
        const hotelName = rowValue(row, ["酒店", "酒店名称", "候选酒店", "名称"]);
        if (/酒店|住宿/.test(subsection.title) && hotelName) {
          hotelCandidates.push({
            name: hotelName,
            tier: rowValue(row, ["档次", "类型", "定位"]),
            area: rowValue(row, ["位置/区域", "位置", "区域", "地址"]),
            priceReference: rowValue(row, ["价格/晚", "价格参考", "价格", "费用"]),
            fit: rowValue(row, ["适合", "适合人群", "特点"]),
            tradeoff: rowValue(row, ["取舍", "备注", "注意"]),
            bookingUrl: extractFirstUrl(Object.values(row.rawCells || {}).join(" ")),
            source: { line: row.line, section: subsection.title },
            rawMarkdown: row.rawMarkdown,
          });
          continue;
        }
        const route = rowValue(row, ["方向", "路线", "线路", "区间", "安排"]);
        const code = rowValue(row, ["班次/车次", "班次", "航班", "车次"]);
        if (/交通|航班|高铁|火车|市内/.test(subsection.title) || route || code) {
          transportRows.push({
            type: subsection.title,
            direction: route,
            code,
            depart: rowValue(row, ["出发", "起飞", "出发地"]),
            arrive: rowValue(row, ["到达", "抵达", "到达地"]),
            duration: rowValue(row, ["时长", "历时", "用时"]),
            priceReference: rowValue(row, ["价格参考", "价格", "费用", "票价"]),
            bookingUrl: extractFirstUrl(Object.values(row.rawCells || {}).join(" ")),
            source: { line: row.line, section: subsection.title },
            rawMarkdown: row.rawMarkdown,
          });
        }
      }
    }
  }
  return { sections, transportRows, hotelCandidates };
}

function parseDays(text) {
  const matches = [...text.matchAll(/^###\s+Day\s+(\d+)\s*(?:[·.-]\s*)?(.+)?$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const next = matches[index + 1];
    const rawMarkdown = text.slice(start, next?.index ?? text.length).trimEnd();
    const before = text.slice(0, start);
    const headingLine = before.split(/\r?\n/).length;
    const blockLines = rawMarkdown.split(/\r?\n/);
    const table = parseFirstTable(blockLines, headingLine - 1);
    const { details, rawLines } = parseDailyDetails(blockLines, headingLine - 1);
    const title = cleanText(match[2] || "");
    const date = title.match(/[（(]([^）)]*(?:\d{4}|月|周|星期)[^）)]*)[）)]/)?.[1] || "";
    const theme = cleanText(title.replace(/[（(][^）)]*(?:\d{4}|月|周|星期)[^）)]*[）)]/g, ""));
    return {
      day: Number(match[1]),
      title,
      theme,
      date,
      heading: match[0],
      line: headingLine,
      rawMarkdown,
      timelineTable: table ? {
        line: table.line,
        headers: table.headers,
        rawHeaders: table.rawHeaders,
        rawMarkdown: table.rawMarkdown,
      } : null,
      timelineRows: table?.rows || [],
      dailyDetails: Object.fromEntries(DAILY_LABELS.map((label) => [label, details[label] || ""])),
      rawDailyDetailLines: rawLines,
    };
  });
}

const itineraryText = readText(itineraryPath);
const title = cleanText(itineraryText.match(/^#\s+(.+)$/m)?.[1] || path.basename(tripDir));
const planOverviewTables = parseSectionTables(itineraryText, /^总体安排$/);
const budgetTables = parseSectionTables(itineraryText, /^预算汇总$/);
const checklistTables = parseSectionTables(itineraryText, /^出行前检查$/);
const transportAndLodging = extractTransportAndHotels(itineraryText);
const days = parseDays(itineraryText);
const sha256 = crypto.createHash("sha256").update(itineraryText).digest("hex");

const output = {
  schema_version: "1.0",
  artifact_type: "itinerary-structured",
  generated_at: new Date().toISOString().slice(0, 10),
  source: {
    file: "itinerary.md",
    path: path.relative(tripDir, itineraryPath) || "itinerary.md",
    sha256,
  },
  title,
  trip: parseTripParams(itineraryText),
  days,
  sections: {
    planOverview: planOverviewTables[0] || null,
    budget: budgetTables[0] || null,
    checklist: checklistTables[0] || null,
    transportAndLodging: transportAndLodging.sections,
  },
  transportRows: transportAndLodging.transportRows,
  hotelCandidates: transportAndLodging.hotelCandidates,
  coverage: {
    dayCount: days.length,
    timelineRowCount: days.reduce((total, day) => total + day.timelineRows.length, 0),
    dailyDetailFields: days.reduce((total, day) => total + DAILY_LABELS.filter((label) => day.dailyDetails[label]).length, 0),
    transportRows: transportAndLodging.transportRows.length,
    hotelCandidates: transportAndLodging.hotelCandidates.length,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: outputPath,
  days: output.coverage.dayCount,
  timelineRows: output.coverage.timelineRowCount,
  dailyDetailFields: output.coverage.dailyDetailFields,
  transportRows: output.coverage.transportRows,
  hotelCandidates: output.coverage.hotelCandidates,
}, null, 2));
