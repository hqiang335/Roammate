---
name: guidebook-maker
description: Turn mainland China trip briefs, reputation research, itineraries, map data, hotels, budgets, and source notes into a polished dashboard-style interactive HTML travel atlas.
---

# Guidebook Maker

Use this nested skill when the user wants the final interactive travel atlas, printable guidebook, HTML page, or polished artifact for family and friends.

## Workflow

1. Gather available inputs in one trip directory: `itinerary-data.json`, `map-data.json`, `destination-brief.md`, `reputation.md`, `itinerary.md`, and optional `research-ledger.json`.
2. Read `references/guidebook-data-schema.md` only when changing the data contract. Read `references/html-style.md` or `references/guidebook-template.md` only when changing renderer layout or visual behavior.
3. Prefer structured JSON handoff files over re-parsing Markdown. Use Markdown only to fill human-readable wording gaps.
4. Preserve freshness and uncertainty where they affect traveler decisions: weather, routes, hotels, flights/trains, tickets/packages, semantic tips, and real-experience judgments.
5. Convert accepted FlyAI `ai-search` and Quark/Web-Rooter ledger facts into practical guidebook sections: must-do projects, realistic stay duration, queue strategy, hotel area/tier tradeoffs, restaurant choices, reservation notes, preparation checklist, child/older-adult cautions, rest/meal notes, and skip/avoid choices.
6. Create `guidebook-data.json` with `scripts/build-guidebook-data.mjs`; do not hand-write it for full-package runs. The script keeps the handoff compact and lets the renderer read `destination-brief.md`, `reputation.md`, and `itinerary.md` as collapsed archive/fallback wording.
   - If `guidebook-data.json` only contains thin day activities, the renderer will enrich them from `itinerary.md`; do not strip transport mode, duration, cost, flight/train numbers, booking links, route notes, or hotel links from the handoff.
   - Include `transport.flights`, `transport.trains`, and `transport.local` whenever available. Preserve `url`/`bookingUrl`/`ticketUrl` from FlyAI, 12306, airline, or Feizhu references so the "交通参考" cards can show a "订票/查询" link. If these facts only exist in `itinerary.md`, keep the markdown links intact so the renderer can parse them.
   - Include `food` when you have structured dining recommendations. If food only appears in `destination-brief.md`, `itinerary.md`, or `reputation.md`, do not omit those files; the renderer will derive dining suggestions and warnings from meal rows, food bullets, and "不要吃正餐/小吃偏贵" reputation notes.
7. Do not rework the ledger just for guidebook rendering. Preserve fact IDs already present when useful, then let the generator script build the compact handoff.
8. Generate `guidebook.html` with `scripts/build-guidebook.mjs`. The renderer produces a dashboard-style Travel Atlas and automatically reads sibling `map-data.json` when present, so map, day timeline, POI dossiers, hotels, food, budget, and checklist can be used together.
9. Validate `guidebook.html` with `scripts/validate-guidebook.mjs`.
10. Run `scripts/qa-guidebook.mjs` when Playwright is available to check desktop/mobile rendering, drawer navigation, and horizontal overflow.

## Required Commands

```bash
node .claude/skills/guidebook-maker/scripts/build-guidebook-data.mjs \
  TRAVEL/杭州-2026-06-05

node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs \
  TRAVEL/杭州-2026-06-05/guidebook-data.json \
  TRAVEL/杭州-2026-06-05/guidebook.html

node .claude/skills/guidebook-maker/scripts/validate-guidebook.mjs \
  TRAVEL/杭州-2026-06-05/guidebook-data.json \
  TRAVEL/杭州-2026-06-05/guidebook.html

node .claude/skills/guidebook-maker/scripts/qa-guidebook.mjs \
  TRAVEL/杭州-2026-06-05/guidebook.html
```

## Required Sections

- Cover / atlas header
- Trip overview dashboard
- Compact overall itinerary plan: theme, area, intensity, core experience, key reminder
- Interactive daily itinerary with day tabs
- Map and transport workspace, using `map-data.json` when present
- POI experience dossiers: recommended duration, must-do, queue/reservation, prep, family cautions, avoid notes, source label
- Stay areas and hotel portfolio when lodging choices matter
- Food and reputation warnings
- Tickets, reservations, and booking-market references when available
- Budget
- Pre-trip checklist
- Collapsed source-document archive rendering the sibling `destination-brief.md`, `itinerary.md`, and `reputation.md` content without making the main page a long Markdown dump

These are base capabilities, not a fixed length requirement. Optional modules should appear only when the corresponding data is useful. For example, long avoidance sections are appropriate only when there are meaningful avoidance signals; complex preparation sections are appropriate only when the trip requires them.

## Rules

- Simplified Chinese by default.
- No AI-generated images in V1.
- Do not require external assets. CDN icons are optional only if there is a text fallback.
- Keep the design dashboard-first, visually polished, printable, and mobile-readable. The default layout is a left itinerary panel plus interactive map workspace, with details revealed by cards, drawers, and expandable dossiers.
- Prices, opening hours, weather, hotel availability, and routes must include freshness or uncertainty notes inside the relevant modules; do not add a standalone "来源与可信度" section to the guidebook.
- Do not present FlyAI `ai-search` advice as official policy; label it as semantic reference.
- Do not present FlyAI hotel inventory as final hotel judgment without Quark/Web-Rooter area or experience context when such evidence exists.
- Every accepted hotel candidate in the guidebook must include a clickable Feizhu link, displayed FlyAI price, tier/type, and real room type if returned. If room type was not returned by FlyAI, say so explicitly instead of inventing a room.
- Public web evidence used for decisions should be preserved in `research-ledger.json` or concise inline context; the guidebook itself should not render an empty standalone source module.
- The guidebook should help the traveler decide what to do inside each attraction, not just list attraction names. Do not shrink reputation or itinerary experience into a thin summary when structured facts exist.
- The final guidebook must not be a lossy rewrite of `destination-brief.md`, `itinerary.md`, or `reputation.md`. Main modules should organically absorb high-value facts; the full Markdown reports should be available as collapsed archival details, not open long sections.
- Do not inflate the page with low-value repetition. Prefer compact summaries, chips, tables, and drawers for decisions; remove or collapse redundant raw text, internal IDs, and repeated provenance notes.
- Budget and lodging must use one consistent data source. If the hotel portfolio changes nightly price, update accommodation and total budget or clearly mark the budget as a different tier.
- Map route text must prefer itinerary transport segments. Do not present cross-city Amap walking routes as recommended movement; long walking segments should be filtered, relabeled as estimates, or replaced by driving/transit/taxi references.
- Only claim hotel map display when accepted hotel candidates have coordinates.
- Mobile rendering is part of completion: no horizontal scrolling at common phone widths, and drawers must close on navigation or ESC.
- Do not hand-write the final `guidebook.html`.
- Do not create temporary Python, Bash heredoc, or ad hoc scripts to assemble long guidebook HTML.
- If direct `Write` of `guidebook-data.json` fails, reduce or split the JSON data, then run the fixed renderer; do not switch to hand-written HTML, shell heredocs, or ad hoc `cat > guidebook-data.json` assembly.
- If `validate-guidebook.mjs` fails, fix `guidebook-data.json` or the renderer and rerun validation before delivering.
- The visual style is owned by `scripts/build-guidebook.mjs`; do not invent a new CSS theme per trip. Use stable layout, components, spacing, marker categories, day tabs, drawers, cards, and print behavior across all destinations. Destination personality may affect data and labels, not the page skeleton.
- Do not run new Amap/FlyAI/Web-Rooter searches from guidebook-maker unless `research-ledger.json`, `itinerary-data.json`, and `map-data.json` lack a needed guidebook-critical fact.
- `guidebook-data.json` should stay compact and may reference ledger fact IDs when useful; it should not duplicate raw search outputs or whole Markdown reports. The renderer is responsible for reading the Markdown reports directly when they exist.
