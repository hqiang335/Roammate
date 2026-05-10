---
name: roammate-travel-concierge
description: Chinese-first travel concierge skills system for mainland China trip briefing, reputation research, itinerary planning, Amap/FlyAI route building, hotel research, budgets, and dashboard-style interactive travel atlases.
---

# Roammate Travel Concierge

User request:

```text
$ARGUMENTS
```

Use this top-level skill as the router for the V1 travel concierge system. It coordinates five nested skills. Keep this layer light: load only the nested skill that matches the user's request, or combine them in the order below for full trip planning.

## Routing

**Default: Full Pipeline**

Any request that includes a destination + date/duration + traveler count is a full planning request. Run all five steps automatically without asking for confirmation:

1. Destination brief -> `../destination-brief/SKILL.md`
2. Local reputation research -> `../local-reputation-research/SKILL.md`
3. Itinerary planning -> `../itinerary-planner/SKILL.md`
4. Map and route building -> `../map-route-builder/SKILL.md` (must run `scripts/build_real_map.py`, produce `map-data.json`, legacy `pois.json`, and real `map.html`)
5. Guidebook / Travel Atlas -> `../guidebook-maker/SKILL.md` (must run `scripts/build-guidebook.mjs`, produce validated dashboard-style `guidebook.html`)

Do not stop after step 3. Do not ask "do you want a map?" or "should I generate a guidebook?". Proceed through all five steps and write all output files. Intermediate status updates are allowed, but do not produce a success summary, final delivery wording, or "complete planning" message after destination brief, reputation research, or itinerary validation. A full-package request is not complete until step 4 map artifacts, step 5 guidebook artifacts, `sources.md`, and package validation have passed or have explicit failure artifacts.

Before any public web research, use the structured tool priorities in `references/tool-priority.md` for Amap weather/POI/routes and FlyAI flights/trains/hotel inventory/tickets/packages/semantic trip tips. For any route with specific attractions, read `references/ai-search-playbook.md` and build FlyAI `ai-search` experience intelligence before final itinerary timing. After Amap/FlyAI initialization, read `references/web-rooter-playbook.md` and use Web-Rooter CLI + Quark as the real-experience evidence layer for official notices, public web evidence, visitor sentiment, restaurant reputation, route tactics, hotel-area convenience, hotel tier/type fit, detailed攻略, and avoidance notes. Quark evidence can change, down-rank, or trigger a re-query of earlier FlyAI candidates.

For full packages, also read `references/research-ledger-schema.md` and `references/data-flow.md`. Initialize or update `research-ledger.json` before writing downstream JSON artifacts.

## Pipeline Gates

Use these gates for full planning requests. Do not proceed past a gate until it has passed, failed explicitly, or been marked as a sample assumption.

1. **Date gate**: if exact dates are missing but the user gave a month, season, holiday window, or vague phrase such as `6月初`, choose a reasonable representative date range that matches the requested duration and continue the full pipeline exactly as with explicit dates, including FlyAI flights, trains, hotels, tickets/packages, and Amap route/weather attempts. State the assumed range in every artifact and mark booking-market prices, availability, ticket data, and weather as representative-date sample data. Ask a date question only when no plausible range can be inferred at all.
2. **Research gate**: all started tool calls and background commands must finish, fail, or be explicitly abandoned before writing final artifacts. Discard clearly irrelevant Web-Rooter results instead of treating them as evidence.
3. **Ledger gate**: create `research-ledger.json`, record accepted and discarded facts, then run `scripts/validate-ledger.mjs`. In final delivery, run it with `--final`.
4. **Experience gate**: for hotels, restaurants, major attractions, parks, family trips, older-adult trips, or any recommendation-sensitive choice, include Quark-cited public web evidence before accepting the final recommendation. This gate is not optional merely because Amap/FlyAI returned structured data.
5. **Itinerary gate**: before finalizing day-by-day plans, each anchor POI must have a visible duration rationale from FlyAI `ai-search`, Quark experience evidence, Amap route/time, queue/reservation friction, meal/rest needs, or a marked estimate. Write this to `itinerary-data.json`, not `pois.json`.
6. **Hotel gate**: never use FlyAI's first cheap hotel list as the final hotel advice. Derive a stay-area and hotel-tier strategy from Quark evidence, then rerun/filter FlyAI by area, POI, star, hotel type, price band, or rating as needed. Final hotel advice should include tradeoffs across economy, comfortable/family, premium/location-first, and special-stay options when evidence exists.
7. **Map gate**: `map.html` is valid only if produced by `map-route-builder/scripts/build_real_map.py` and validated as a real Amap map. Never hand-write a placeholder as `map.html`. If map generation fails, write `map-error.md` or route text, not a fake map artifact.
8. **Guidebook gate**: `guidebook.html` is valid only if produced by `guidebook-maker/scripts/build-guidebook.mjs` from `guidebook-data.json` and sibling `map-data.json` when available, and passes `validate-guidebook.mjs`. It is the main dashboard-style Travel Atlas, not a thin summary. Never write a long guidebook HTML file directly.
9. **Sources gate**: generate `sources.md` from the ledger with `scripts/generate-sources.mjs TRAVEL/{destination-date}/research-ledger.json`. It must preserve Web-Rooter source URLs/citations and FlyAI Feizhu hotel links used downstream.
10. **Package gate**: before the final response, run `scripts/validate-trip-package.mjs TRAVEL/{destination-date}` and fix failures.

After any intermediate validator passes, continue to the next gate immediately. Do not summarize as "completed the full plan" until the package gate passes.

**Single-skill routing** (only when the request clearly targets one task):

| User intent | Use nested skill |
| --- | --- |
| Destination overview only | `../destination-brief/SKILL.md` |
| "Is this place worth it?" / reputation only | `../local-reputation-research/SKILL.md` |
| Itinerary only, user already has research | `../itinerary-planner/SKILL.md` |
| Map / POI list only | `../map-route-builder/SKILL.md` |
| Guidebook only, user provides existing files | `../guidebook-maker/SKILL.md` |

## Required Intake

Extract what is present. Ask only for missing fields that materially affect the plan.

- Destination or region
- Dates or season
- Trip length
- Origin city
- Transportation mode
- Travelers and constraints: older adults, children, accessibility, pets
- Budget tier
- Interests and pace
- Desired output: quick answer, markdown plan, map, HTML, PDF

## System Rules

- V1 focuses on mainland China travel and simplified Chinese output by default.
- Do not use Xiaohongshu, Xiaohongshu MCP, or `wr xhs`.
- Do not use Claude Code built-in Web Search by default. Use Amap/FlyAI for structured facts and Web-Rooter CLI + Quark for cited public web evidence and real-experience decisions.
- Amap MCP and FlyAI CLI are first-choice sources for covered structured facts. Quark is the required experience layer for recommendation-sensitive choices and may override, down-rank, or refine FlyAI candidates. If a tool is unavailable, continue with remaining sources and mark estimates clearly.
- Never book, pay, log in, or submit forms for the user. Provide recommendations and human confirmation points.
- Mark data freshness, sources, and uncertain items in every final travel artifact.
- Do not produce a final day-by-day schedule for major attractions until play time, must-do projects, queue/reservation friction, meals/rest needs, and Amap transfer time have been considered.
- Do not write final `map.html` or `guidebook.html` by hand. Use the bundled generator scripts and validators.
- Do not treat failed, empty, background, or irrelevant tool results as successful evidence.
- Do not re-query facts already present in `research-ledger.json` unless they are stale, low-confidence, missing a needed field, or require a different tool type.
- Keep JSON handoff files structured and concise, but preserve actionable experience facts as fields. Do not copy whole Markdown reports into JSON, and do not compress rich reputation/itinerary guidance into generic one-line summaries.
- Generate `sources.md` from `research-ledger.json` source labels and key tool runs; do not maintain a separate conflicting source list.
- Use Web-Rooter only for public, non-login pages and cited search/crawl output. Do not use Xiaohongshu, `wr xhs`, login, cookie scraping, account actions, posting, booking, payments, or Claude Code built-in Web Search unless the user explicitly asks.
- Do not use `npx @modelcontextprotocol/inspector` to call MCP tools during travel planning. It is an interactive debugger that opens a browser and can leave port `6277` occupied. Use native MCP tools or the bundled REST/script fallbacks.

## Standard Outputs

When producing a full package, use:

```text
TRAVEL/{destination}-{date}/
├── research-ledger.json
├── destination-brief.md
├── reputation.md
├── itinerary.md
├── itinerary-data.json
├── map-data.json
├── pois.json                 # legacy alias for map-data.json during V1 transition
├── map.html
├── guidebook-data.json
├── guidebook.html             # dashboard-style Travel Atlas, main visual artifact
├── guidebook.pdf
├── map-error.md
└── sources.md
```

Use these final package commands:

```bash
node .claude/skills/roammate-travel-concierge/scripts/validate-ledger.mjs \
  --final TRAVEL/{destination-date}/research-ledger.json

node .claude/skills/roammate-travel-concierge/scripts/generate-sources.mjs \
  TRAVEL/{destination-date}/research-ledger.json \
  TRAVEL/{destination-date}/sources.md

node .claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs \
  TRAVEL/{destination-date}
```

Use this shared intermediate shape when passing itinerary data between nested skills:

```json
{
  "destination": "杭州",
  "start_date": "2026-06-01",
  "days": [
    {
      "day": 1,
      "theme": "西湖经典线",
      "pois": [
        {
          "name": "断桥残雪",
          "type": "attraction",
          "estimated_duration_minutes": 40,
          "comfortable_duration_minutes": 60,
          "must_do": ["西湖断桥步行拍照"],
          "reservation_required": false,
          "queue_or_friction": "低",
          "source": "Amap verified + FlyAI semantic reference"
        }
      ]
    }
  ]
}
```
