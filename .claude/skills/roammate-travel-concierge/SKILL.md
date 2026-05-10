---
name: roammate-travel-concierge
description: Chinese-first mainland China travel concierge router for destination briefs, reputation research, itinerary planning, Amap/FlyAI map data, hotels, budgets, and dashboard-style interactive travel atlases.
---

# Roammate Travel Concierge

User request:

```text
$ARGUMENTS
```

Use this top-level skill as the lightweight router. Load only the nested skill needed for a single-task request; for a complete trip request, run the full package pipeline automatically.

## Full Package Trigger

If the request includes destination + date/duration + traveler count, run all stages without asking whether to create maps or a guidebook:

1. `../destination-brief/SKILL.md` -> `destination-brief.md`
2. `../local-reputation-research/SKILL.md` -> `reputation.md`
3. `../itinerary-planner/SKILL.md` -> `itinerary.md` and `itinerary-data.json`
4. `../map-route-builder/SKILL.md` -> validated `map-data.json`
5. `../guidebook-maker/SKILL.md` -> `guidebook-data.json`, `guidebook.html`, validation

Never stop after step 3. A package is complete only after `guidebook.html` exists and `validate-trip-package.mjs` passes.

## Execution Discipline

- Derive one canonical `TRIP_DIR` at the start and reuse it everywhere: `TRAVEL/{目的地}-{YYYY-MM-DD}`. Do not create compact aliases such as `TRAVEL/成都-20260601`.
- If exact dates are missing but a plausible range exists (`6月初`, holiday window, season + duration), choose representative dates and mark booking/weather/price facts as sample data. Ask only when no plausible range can be inferred.
- Shared references are read once per run, only as needed: `tool-priority.md`, `ai-search-playbook.md`, `web-rooter-playbook.md`, `research-ledger-schema.md`, and `data-flow.md`.
- Parallelize independent research when useful: destination facts, reputation evidence, transport/hotel searches, and POI experience searches may run concurrently. Join all background commands before writing final artifacts.
- Do not loop on progress updates. After a validator passes, run the next gate. After a failure, inspect the failing artifact and validator output immediately.
- Do not use shell heredocs, ad hoc `cat > file`, or hand-written HTML/JSON to bypass large writes. Use bundled scripts and smaller structured inputs.

## Evidence Rules

- Use Amap/FlyAI first for covered structured facts: weather, POIs, coordinates, routes, flights, trains, hotels, tickets/packages, and semantic experience tips.
- Use Web-Rooter CLI + Quark for public web evidence, official notices, visitor sentiment, restaurant/hotel-area reputation, route tactics, and avoid notes.
- Do not use Xiaohongshu, Xiaohongshu MCP, `wr xhs`, login/cookie scraping, account actions, posting, booking, payments, or Claude Code built-in Web Search unless explicitly requested.
- Do not accept a recommendation-sensitive choice from a cheap first list alone. Hotels, restaurants, major attractions, parks, family trips, and older-adult trips need experience evidence or explicit fallback labeling.
- Preserve FlyAI/Feizhu/airline/12306 booking or query URLs when returned; they must flow into itinerary and guidebook transport/hotel cards.
- Mark estimates and volatile facts inline. Do not maintain a separate guidebook source panel.

## Gates

1. **Ledger**: create/update `research-ledger.json`, record accepted/discarded facts when available, and run `validate-ledger.mjs` for full packages.
2. **Itinerary**: every anchor POI needs a duration rationale from FlyAI `ai-search`, Quark evidence, Amap route/time, queue friction, meal/rest needs, or a marked estimate.
3. **Hotels**: derive stay-area/tier strategy before accepting hotel candidates. Keep price, room-type status, tradeoffs, and booking links.
4. **Map data**: run `map-route-builder/scripts/build_real_map.py` or an explicit validated fallback, then `validate_map.mjs`. Do not generate standalone `map.html`.
5. **Guidebook**: run `guidebook-maker/scripts/build-guidebook-data.mjs`, then `build-guidebook.mjs`, then `validate-guidebook.mjs`. Do not hand-write `guidebook-data.json` or `guidebook.html`.
6. **Package**: run `roammate-travel-concierge/scripts/validate-trip-package.mjs "$TRIP_DIR"` before any successful final response.

## No Early Exit Checklist

Before the final response for a full package, verify:

```text
□ destination-brief.md
□ reputation.md
□ itinerary.md
□ research-ledger.json
□ itinerary-data.json
□ map-data.json
□ guidebook-data.json
□ guidebook.html
□ validate-trip-package.mjs passed
```

If any item is missing, continue the missing stage instead of summarizing success. The final answer must mention `guidebook.html` and passed package validation; otherwise it is a blocker report.

## Single-Skill Routing

| User intent | Nested skill |
| --- | --- |
| Destination overview only | `../destination-brief/SKILL.md` |
| Reputation / “worth it?” only | `../local-reputation-research/SKILL.md` |
| Itinerary only with existing research | `../itinerary-planner/SKILL.md` |
| Map / POI / route data only | `../map-route-builder/SKILL.md` |
| Guidebook from existing trip files | `../guidebook-maker/SKILL.md` |

## Final Commands

```bash
node .claude/skills/roammate-travel-concierge/scripts/validate-ledger.mjs \
  --final "$TRIP_DIR/research-ledger.json"

node .claude/skills/guidebook-maker/scripts/build-guidebook-data.mjs "$TRIP_DIR"

node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs \
  "$TRIP_DIR/guidebook-data.json" \
  "$TRIP_DIR/guidebook.html"

node .claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs "$TRIP_DIR"
```

## Standard Outputs

```text
TRAVEL/{destination}-{YYYY-MM-DD}/
├── research-ledger.json
├── destination-brief.md
├── reputation.md
├── itinerary.md
├── itinerary-data.json
├── map-data.json
├── guidebook-data.json
├── guidebook.html
└── map-error.md               # only if map-data generation fails
```
