# Roammate Travel Guidebook

[简体中文](README.zh-CN.md) | English

Roammate is an AI travel planning assistant for mainland China. Given a destination, date, duration, and travelers, it generates a complete trip package: destination brief, local reputation research, itinerary, route/map data, and a dashboard-style `guidebook.html`.

## Online Demo

- [Chengdu 2026-06-01 Travel Atlas](https://hqiang335.github.io/Roammate/TRAVEL/%E6%88%90%E9%83%BD-2026-06-01/guidebook.html)

## What It Does

- Destination brief: season fit, city overview, transport samples, and cautions
- Reputation research: attractions, restaurants, hotel areas, and avoid notes
- Itinerary planning: daily schedule, transport, budget, reservations, and backup plans
- Route data: POI coordinates, hotel coordinates, route summaries, and map data
- Travel atlas: a browsable and printable `guidebook.html`

## Skill Directory

```text
.claude/skills/
├── roammate-travel-concierge/     # Main router for the full serial workflow
├── destination-brief/             # Destination brief
├── local-reputation-research/     # Local reputation research
├── itinerary-planner/             # Itinerary planning and lossless extraction
├── map-route-builder/             # POIs, coordinates, and route data
└── guidebook-maker/               # Guidebook data and HTML generation
```

A full run writes:

```text
TRAVEL/{destination}-{YYYY-MM-DD}/
├── research-ledger.json
├── destination-brief.md
├── reputation.md
├── itinerary.md
├── itinerary-structured.json
├── map-data.json
├── guidebook-data.json
└── guidebook.html
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

To run browser QA for the generated guidebook, install Playwright Chromium:

```bash
npx playwright install chromium
```

### 2. Configure Keys And Tools

Text-only planning can degrade when some tools are missing. For complete maps, routes, hotels, and cited web evidence, configure the following.

| Name | Status | Purpose |
| --- | --- | --- |
| `AMAP_MAPS_API_KEY` | Recommended | Amap Web Service API for POI search, geocoding, and routes |
| `AMAP_WEB_JS_API_KEY` | Recommended | Amap Web JS API for the map inside `guidebook.html` |
| `AMAP_SECURITY_JS_CODE` | Recommended | Browser-side security config for Amap Web JS API |
| `FLYAI_API_KEY` | Recommended | FlyAI flight, train, hotel, ticket, and package references |
| `flyai` CLI | Recommended | FlyAI travel search |
| Playwright Chromium | Recommended | Browser QA for `guidebook.html` |
| Web-Rooter `wr` CLI | Required for full workflow | Public web evidence, official notices, reputation checks, and conflict review |

You can create a `.env` file in the repository root:

```bash
AMAP_MAPS_API_KEY=your_amap_maps_api_key_here
AMAP_WEB_JS_API_KEY=your_amap_web_js_api_key_here
AMAP_SECURITY_JS_CODE=your_amap_security_js_code_here
FLYAI_API_KEY=your_flyai_api_key_here
WEB_ROOTER_HOME=/absolute/path/to/web-rooter
WEB_ROOTER_NO_RICH=1
WEB_ROOTER_MAX_OUTPUT_CHARS=8000
```

Configuration may also come from the current shell environment, `~/.codex/.env`, or `~/.flyai/config.json`.

### 3. Set Up Web-Rooter

Web-Rooter provides public web search and cited evidence. Install it outside this repository:

```bash
git clone https://github.com/baojiachen0214/web-rooter.git ~/tools/web-rooter
cd ~/tools/web-rooter
bash install.sh
wr doctor
```

Then verify it from Roammate:

```bash
cd /path/to/Roammate
npm run doctor:webrooter
```

Inside this project, call Web-Rooter through the npm wrapper:

```bash
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=3 \
  | npm run --silent wr:compact
```

## Example Output

For a 4-day, 3-night Chengdu family trip starting on 2026-06-01, Roammate generates:

- `destination-brief.md` - Chengdu overview with best travel season, transport options, and core experiences
- `reputation.md` - Reputation and avoid notes for places such as Chengdu Research Base of Giant Panda Breeding, Dujiangyan, Kuanzhai Alley, People's Park, and Du Fu Thatched Cottage
- `itinerary.md` - Detailed 4-day itinerary with schedule, transport, costs, and reservation reminders
- `itinerary-structured.json` - Script-generated lossless index from `itinerary.md`, preserving table cells, notes, links, and daily details
- `research-ledger.json` - Source ledger for Amap, FlyAI, official pages, Web-Rooter public web evidence, confidence, decisions, and downstream usage
- `map-data.json` - Structured map data for attractions, coordinates, routes, and hotels
- `guidebook-data.json` - Travel Atlas rendering input for daily cards, POI dossiers, hotel options, food, budget, and checklists
- `guidebook.html` - Main deliverable: a dashboard-style interactive travel atlas with map, daily itinerary, place details, hotels, budget, and checklists

## Usage

Open the repository in Claude Code or Codex, then provide a complete trip request:

```text
/roammate-travel-concierge 计划今年6月1日去成都玩，一家三口带7岁小朋友，4天3夜，从广州出发，帮我制定旅游攻略。
```

If slash commands are unavailable, write the same request in natural language and ask Roammate to run the complete workflow.

## Useful Commands

Validate a full trip package:

```bash
npm run validate:trip -- TRAVEL/成都-2026-06-01
```

Rebuild a guidebook from existing data:

```bash
node .claude/skills/guidebook-maker/scripts/build-guidebook-data.mjs \
  TRAVEL/成都-2026-06-01

node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs \
  TRAVEL/成都-2026-06-01/guidebook-data.json \
  TRAVEL/成都-2026-06-01/guidebook.html
```

Other checks:

```bash
npm run validate:ledger -- TRAVEL/成都-2026-06-01/research-ledger.json
npm run validate:map -- TRAVEL/成都-2026-06-01/map-data.json
npm run validate:guidebook -- TRAVEL/成都-2026-06-01/guidebook-data.json TRAVEL/成都-2026-06-01/guidebook.html
npm test
```

## Notes

- Roammate defaults to Simplified Chinese and focuses on mainland China travel.
- `itinerary.md` is the authoritative itinerary; `itinerary-structured.json` is a script-generated lossless index.
- Prices, inventory, weather, opening hours, tickets, and routes can change and should be rechecked before travel.
- Roammate does not log in, book, pay, post, like, or comment on behalf of the user.

## Acknowledgements

- Built with [Claude Code](https://claude.ai/code)
- Uses [Amap APIs](https://lbs.amap.com/)
- Integrates FlyAI-CLI travel search
- Uses [Web-Rooter](https://github.com/baojiachen0214/web-rooter) for public web evidence
