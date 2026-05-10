# HTML Style

Use a dashboard-style Chinese travel atlas. The page should feel practical, rich, and polished: a travel control panel rather than a flat report.

## Layout

- Single self-contained HTML file.
- Dashboard-first desktop layout: overview panel, day timeline panel, interactive map workspace, POI dossiers, hotels, food/budget, checklist, and sources.
- The primary desktop interaction is left itinerary + right map/detail workspace. Mobile stacks the panels and keeps day tabs usable.
- Print target: A4.
- Avoid nested cards. Use panels, cards, drawers, tabs, chips, and expandable details with stable spacing.
- Dense information must be progressive: default cards show the decision summary; clicks/details reveal must-do, queue, preparation, parent/child cautions, avoid notes, and sources.

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
- Clicking an itinerary card focuses the map and opens a detail drawer.
- Clicking a map marker opens the same detail drawer.
- POI dossiers use expandable cards so rich reputation facts are present without clutter.
- Hotel cards preserve tier, price, room-type status, fit, tradeoffs, and Feizhu link.
