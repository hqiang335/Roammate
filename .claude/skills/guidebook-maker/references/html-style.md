# HTML Style

Use a dashboard-style Chinese travel atlas. The page should feel practical, rich, and polished: a travel control panel rather than a flat report.

## Layout

- Single self-contained HTML file.
- Dashboard-first desktop layout: overview panel, day timeline panel, interactive map workspace, POI dossiers, hotels, food/budget, checklist, and collapsed source archive panels.
- The primary desktop interaction is left itinerary + right map/detail workspace. Mobile stacks the panels and keeps day tabs usable.
- Print target: A4.
- Avoid nested cards. Use panels, cards, drawers, tabs, chips, and expandable details with stable spacing.
- Dense information should flow through the existing cards, drawers, tabs, and map markers. The curated Markdown reports are the content source and audit archive, not open report dumps in the main reading path.

## Palette

- Background: `#F4EFE6`
- Paper: `#FFFDF8`
- Panel: `#FFFFFF`
- Ink: `#202823`
- Muted text: `#69736D`
- Line: `#E7DCCD`
- Accent: `#1D766F`
- City/warning accent: `#C7563B`
- Warm accent: `#B7791F`
- Blue transport accent: `#2F6F9F`

Keep the palette stable across trips. Destination personality may appear in content, selected photos, and day route colors, not in a newly invented theme.

## Typography

- Font stack: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
- Body: 15-16px, line-height 1.65.
- Avoid viewport-based font sizing.
- Letter spacing: 0.

## Print

- Use `@page { size: A4; margin: 14mm; }`.
- Avoid breaking tables, day sections, and checklist blocks across pages where possible.
- Keep backgrounds print-friendly.
- Hide or simplify interactive-only UI such as live map canvas, drawers, and tabs in print.

## Interaction

- Day tabs filter the itinerary and, when possible, focus map markers.
- The filtered map should include itinerary-derived POIs, accepted hotels, and food/transport stops when coordinates are available; it should not show only the subset that matched the original map-data names exactly.
- Clicking an itinerary card focuses the map and opens a detail drawer.
- Clicking a map marker opens the same detail drawer.
- Transport reference groups should separate outbound, return, and local movement instead of mixing all rows in one grid.
- POI dossiers use expandable cards so rich reputation facts are present without clutter.
- POI dossier cards use a consistent top label and should show representative images when source data provides them.
- Hotel cards preserve tier, price, room-type status, fit, tradeoffs, and Feizhu link.
