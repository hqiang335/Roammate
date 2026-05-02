---
name: guidebook-maker
description: Turn mainland China trip briefs, reputation research, itineraries, maps, and budgets into a clean self-contained HTML travel guidebook and optional Playwright PDF.
---

# Guidebook Maker

Use this nested skill when the user wants a printable guidebook, HTML page, PDF, or polished artifact for family and friends.

## Workflow

1. Gather available inputs: destination brief, reputation notes, itinerary, POIs, map link/file, budget, sources.
2. Read `references/html-style.md` and `references/guidebook-template.md`.
3. Create a self-contained `guidebook.html`.
4. If PDF is requested and Playwright is available, use `scripts/html2pdf.mjs`.
5. If PDF export fails, deliver HTML and explain the failure.

## Required Sections

- Cover
- Trip overview
- Daily itinerary
- Map and transport
- Food and reputation warnings
- Budget
- Pre-trip checklist
- Sources and confidence notes

## Rules

- Simplified Chinese by default.
- No AI-generated images in V1.
- Do not require external assets. CDN icons are optional only if there is a text fallback.
- Keep the design calm, printable, and mobile-readable.
- Prices, opening hours, weather, hotel availability, and routes must include freshness or uncertainty notes.
