# Roammate Travel Concierge v3

中国大陆旅行规划助手。完整交付物是一个旅行包目录和 dashboard 型 `guidebook.html`。

## Core Rule

`roammate-travel-concierge` is a lightweight serial router, not a super-skill.

- Do not start an Agent/Task/subagent for a Roammate pipeline.
- Open no child skill or reference until its stage begins.
- Load only the active stage skill, finish that stage, then load the next one.
- Keep raw tool outputs out of context; compact CLI JSON immediately.

## Skills

Project skills live in `.claude/skills/{skill-name}/SKILL.md`.

| Skill | Role |
| --- | --- |
| `roammate-travel-concierge` | Serial router only |
| `destination-brief` | Destination fit, season, first transport samples |
| `local-reputation-research` | Worth-it, avoid notes, hotel/area judgement |
| `itinerary-planner` | Daily schedule, budget, transport/hotel tables, lossless itinerary extraction |
| `map-route-builder` | POI normalization, Amap routes, hotel coordinates |
| `guidebook-maker` | Final dashboard HTML from trip files and lossless itinerary index |

## Full Package Flow

When a user provides destination + date/duration + travelers, run the five stages without asking whether to make maps or a guidebook:

1. `destination-brief.md`
2. `reputation.md`
3. `itinerary.md`
4. `itinerary-structured.json` generated from `itinerary.md` without summarizing or dropping rows
5. `map-data.json`
6. `guidebook-data.json` and `guidebook.html`

Then run:

```bash
npm run validate:trip -- TRAVEL/{目的地}-{YYYY-MM-DD}
```

Only report completion after validation passes.

## Output Directory

Use exactly one canonical trip directory:

```text
TRAVEL/{目的地}-{YYYY-MM-DD}/
```

Required files:

```text
research-ledger.json
destination-brief.md
reputation.md
itinerary.md
itinerary-structured.json
map-data.json
guidebook-data.json
guidebook.html
```

`itinerary-data.json` is deprecated. New runs must not create or require it.
`itinerary-structured.json` is not a replacement itinerary and must not be hand-written. It is a script-generated lossless index of `itinerary.md` for map and guidebook stages.

## Tools

- Amap MCP: weather, POI, coordinates, routes, nearby services.
- FlyAI CLI: flights, trains, hotels, tickets/packages, semantic travel tips.
- Web-Rooter CLI: sparse public-web evidence only when Amap/FlyAI cannot answer official notices, conflicts, avoid notes, restaurant/hotel-area reputation, or detailed scenic tactics.

Web-Rooter defaults:

```bash
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=3 \
  | npm run --silent wr:compact
```

Increase to 5 results only when weak. Visit/crawl at most one selected URL by default. Do not use Xiaohongshu, login/cookies, account actions, booking, payment, posting, comments, or likes.
Before the first Web-Rooter call in a run, execute `npm run doctor:webrooter` once. If it fails, record a degraded evidence note in `research-ledger.json` and continue with Amap/FlyAI/estimates instead of looping on web searches.
Project command details live in `.claude/skills/roammate-travel-concierge/references/tool-command-contract.md`. In this repo, do not use bare `wr`, `which wr`, or guessed FlyAI commands; use the npm wrapper and `npm run --silent compact:flyai -- {flight|train|hotel|poi|ai-search}` for FlyAI JSON.

## Guardrails

- Default to Simplified Chinese.
- Do not auto-book or pay.
- Mark volatile prices, inventory, weather, opening hours, tickets, and routes as sample/estimated unless verified.
- Do not hand-write final `guidebook-data.json` or `guidebook.html`; use the guidebook scripts.
- Do not say the package is complete after only `itinerary.md` or `map-data.json`.
