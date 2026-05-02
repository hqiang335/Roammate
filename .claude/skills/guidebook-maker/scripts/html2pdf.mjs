#!/usr/bin/env node
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

function usage() {
  console.error("Usage: node html2pdf.mjs input.html output.pdf");
}

const [, , input, output] = process.argv;
if (!input || !output) {
  usage();
  process.exit(1);
}

const inputUrl = input.startsWith("http://") || input.startsWith("https://")
  ? input
  : pathToFileURL(path.resolve(input)).href;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.goto(inputUrl, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "14mm",
      right: "14mm",
      bottom: "14mm",
      left: "14mm",
    },
  });
} finally {
  await browser.close();
}
