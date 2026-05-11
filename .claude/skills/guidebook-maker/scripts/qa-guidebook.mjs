#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";

function usage() {
  console.error("Usage: node qa-guidebook.mjs guidebook.html");
}

const [, , htmlPath] = process.argv;
if (!htmlPath) {
  usage();
  process.exit(1);
}

const issues = [];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.warn(`Guidebook browser QA skipped: Playwright unavailable (${error.message}).`);
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on("pageerror", (error) => {
  const message = error.message || "";
  if (message.includes("Unimplemented type: 3")) return; // Known Amap JS noise in headless Chromium.
  issues.push(`Page error: ${message}`);
});

const url = pathToFileURL(path.resolve(htmlPath)).href;

async function openAt(width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
}

await openAt(1440, 1000);
const desktop = await page.evaluate(() => ({
  sourceDocs: document.querySelectorAll(".source-doc").length,
  openSourceDocs: [...document.querySelectorAll(".source-doc")].filter((doc) => doc.open).length,
  hasPlanOverview: !!document.querySelector("#plan-overview"),
  hasRouteSummary: !!document.querySelector(".route-summary"),
  hasReportDumpIntro: document.body.innerText.includes("完整攻略正文") || document.body.innerText.includes("直接采用 Markdown"),
}));
if (!desktop.hasPlanOverview) issues.push("Guidebook missing #plan-overview.");
if (!desktop.hasRouteSummary) issues.push("Guidebook missing route summary.");
if (desktop.sourceDocs && desktop.openSourceDocs) {
  issues.push("Source documents should be collapsed by default.");
}
if (desktop.hasReportDumpIntro) {
  issues.push("Guidebook should not expose implementation-facing Markdown report dump copy.");
}

const focusName = await page.evaluate(() => {
  const names = new Set((window.__ROAMMATE_ATLAS__?.map?.pois || []).flatMap((poi) => [poi.name, poi.originalName]).filter(Boolean));
  const candidates = [...document.querySelectorAll("[data-focus-poi]")].map((el) => el.dataset.focusPoi).filter(Boolean);
  return candidates.find((candidate) => names.has(candidate) || [...names].some((name) => candidate.includes(name) || name.includes(candidate))) || "";
});
if (focusName) {
  await page.evaluate((name) => {
    const button = [...document.querySelectorAll("[data-focus-poi]")].find((el) => el.dataset.focusPoi === name);
    button?.click();
  }, focusName);
  await page.waitForTimeout(250);
  const drawerOpen = await page.locator("#atlasDrawer.open").count();
  if (!drawerOpen) issues.push("POI click did not open the detail drawer.");
  const docsLink = page.locator('.mode-nav a[href="#full-docs"]');
  if (await docsLink.count()) {
    await docsLink.click();
    await page.waitForTimeout(250);
    const stillOpen = await page.locator("#atlasDrawer.open").count();
    if (stillOpen) issues.push("Drawer remains open after main navigation.");
  }
}

await openAt(390, 844);
const mobile = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  bodyWidth: document.body.scrollWidth,
  overflowing: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
}));
if (mobile.overflowing) {
  issues.push(`Mobile horizontal overflow: scrollWidth=${mobile.scrollWidth}, clientWidth=${mobile.clientWidth}, bodyWidth=${mobile.bodyWidth}.`);
}

await openAt(768, 900);
const tablet = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
if (tablet.scrollWidth > tablet.clientWidth + 2) {
  issues.push(`Tablet horizontal overflow: scrollWidth=${tablet.scrollWidth}, clientWidth=${tablet.clientWidth}.`);
}

await browser.close();

if (issues.length) {
  console.error("Guidebook browser QA failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Guidebook browser QA passed.");
