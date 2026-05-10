# Roammate Travel Concierge

[Simplified Chinese](README.md) | English

Roammate is an AI-assisted travel planning agent for mainland China. It coordinates destination briefing, local reputation research, itinerary planning, route mapping, hotel and ticket references, source tracking, and a dashboard-style interactive HTML travel atlas.

The committed skill implementation lives in `.claude/skills`. The repository also includes `AGENTS.md` at the root so Codex / StudyClawHub-style agent workflows can read the same project instructions without requiring a duplicated `.agents` directory.

## Online Demo

After GitHub Pages is enabled for this repository, the demo can be opened directly in a desktop or mobile browser:

- [Xinjiang 2026-05-27 Travel Atlas](https://hqiang335.github.io/Roammate/TRAVEL/%E6%96%B0%E7%96%86-2026-05-27/guidebook.html)

If the links return 404, enable GitHub Pages for the repository and wait for the Pages deployment to finish.

The demo HTML includes an Amap Web JS API demo key and `securityJsCode`, which is normal for browser-side map APIs. The demo key is intended for the GitHub Pages domain:

```text
hqiang335.github.io
```

## What It Does

Roammate turns a natural-language trip request into a complete travel package:

1. `destination-brief` creates a destination overview, best-season notes, transport gateways, traveler fit, cautions, and source-backed assumptions.
2. `local-reputation-research` studies attraction, restaurant, hotel-area, and tourist-trap reputation using public web evidence and structured travel data.
3. `itinerary-planner` builds a detailed multi-day itinerary with timeline, transport, meals, budget, booking reminders, backup plans, and feasibility checks.
4. `map-route-builder` normalizes POIs, geocodes places, builds routes, collects hotel references, and generates reusable `map-data.json` for the guidebook map.
5. `guidebook-maker` merges all trip artifacts into a dashboard-style `guidebook.html` with map, daily plan, POI dossiers, hotels, food, budget, checklist, and source notes.

## Project Structure

```text
Roammate/
├── .claude/
│   ├── skills/                    # Primary Claude Code skill implementation
│   │   ├── roammate-travel-concierge/
│   │   ├── destination-brief/
│   │   ├── local-reputation-research/
│   │   ├── itinerary-planner/
│   │   ├── map-route-builder/
│   │   └── guidebook-maker/
│   └── settings.json.example      # Example local config
├── TRAVEL/
│   └── {destination}-{date}/
│       ├── research-ledger.json
│       ├── destination-brief.md
│       ├── reputation.md
│       ├── itinerary.md
│       ├── itinerary-data.json
│       ├── map-data.json
│       ├── pois.json
│       ├── guidebook-data.json
│       ├── guidebook.html
│       └── sources.md
├── AGENTS.md                      # General agent instructions
├── CLAUDE.md                      # Claude Code project instructions
├── README.md
├── README.en.md
├── package.json
└── package-lock.json
```

This repository intentionally tracks only `.claude/skills` as the source of truth. If a local `.agents/` folder exists, it is an optional local mirror for some Codex/agent environments and does not need to be uploaded. Keeping `AGENTS.md` and `CLAUDE.md` aligned is expected: they target different tool entry points while describing the same project rules.

## Requirements

- Claude Code CLI/Desktop or Codex
- Node.js 18+ and npm
- Python 3.10+
- Network access for Amap, FlyAI, and public web research
- Amap Web Service API key for POI search, geocoding, and route planning
- Amap Web JS API key plus `securityJsCode` for browser map rendering
- Optional FlyAI CLI/API key for flight, rail, hotel, ticket, and product references
- Recommended Web-Rooter `wr` CLI for cited public web evidence

Text-only planning can still run without all external tools, but maps, route quality, hotel references, and cited web evidence depend on the optional services above.

## Installation

```bash
npm install
```

If you want to run browser-rendering QA for `guidebook.html`, install Playwright's Chromium browser:

```bash
npx playwright install chromium
```

## Local Configuration

Create a local `.env` file in the repository root, or use `~/.codex/.env`.

```bash
AMAP_MAPS_API_KEY=your_amap_web_service_key_here
AMAP_WEB_JS_API_KEY=your_amap_web_js_key_here
AMAP_SECURITY_JS_CODE=your_amap_security_js_code_here
FLYAI_API_KEY=your_flyai_api_key_here
WEB_ROOTER_HOME=/absolute/path/to/web-rooter
WEB_ROOTER_NO_RICH=1
WEB_ROOTER_MAX_OUTPUT_CHARS=12000
```

The scripts look for configuration in this order:

- current shell environment variables
- repository root `.env`
- `~/.codex/.env`
- `~/.flyai/config.json`

## Web-Rooter Setup

Web-Rooter is used as the public web evidence layer. It is especially useful for official pages, policy notices, attraction reputation, hotel-area strategy, restaurant notes, tourist traps, and source-backed citations.

Recommended installation:

```bash
git clone https://github.com/baojiachen0214/web-rooter.git ~/tools/web-rooter
cd ~/tools/web-rooter
bash install.sh
wr doctor
wr help
```

Then verify it from Roammate:

```bash
cd /path/to/Roammate
npm run doctor:webrooter
```

The project intentionally avoids login-only scraping, account operations, booking, payment, posting, liking, or commenting. It also avoids Xiaohongshu-specific tooling.

## Usage

Open this repository in Claude Code, then start with the main routing skill:

```text
/roammate-travel-concierge Plan a 4-day family trip to Xinjiang from May 27, 2026. Include transport, hotels, routes, attractions, food, budget, and an interactive guidebook.
```

If slash commands are not available, or if you are using Codex through `AGENTS.md`, provide the same request in natural language and ask Roammate to run the complete five-step workflow from the `.claude/skills` files.

The final artifacts will be written under:

```text
TRAVEL/{destination}-{date}/
```

Validate a generated trip package:

```bash
npm run validate:trip -- TRAVEL/新疆-2026-05-27
```

Rebuild a guidebook from existing data:

```bash
node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs \
  TRAVEL/新疆-2026-05-27/guidebook-data.json \
  TRAVEL/新疆-2026-05-27/guidebook.html
```

Generate a source index:

```bash
npm run generate:sources -- TRAVEL/新疆-2026-05-27/research-ledger.json
```

## Validation Scripts

```bash
npm run validate:ledger -- TRAVEL/新疆-2026-05-27/research-ledger.json
npm run validate:map -- TRAVEL/新疆-2026-05-27/map-data.json
npm run validate:guidebook -- TRAVEL/新疆-2026-05-27/guidebook-data.json TRAVEL/新疆-2026-05-27/guidebook.html
npm run validate:trip -- TRAVEL/新疆-2026-05-27
```

`validate:trip` is the main final check. It validates the generated trip directory and runs guidebook browser QA when Playwright is available.

## StudyClawHub Submission

Submit the full project as an Agent:

```text
Type: Agent
Name: roammate-travel-concierge
Description: Mainland China travel planning agent that coordinates destination briefing, reputation research, itinerary planning, route mapping, and interactive guidebook generation.
Version: 0.1.0
Tags: travel, recommendation, itinerary, map, agent
GitHub Repo URL: https://github.com/hqiang335/Roammate
Path to Skill Folder: .
GitHub Username: hqiang335
```

Why `Path to Skill Folder` is `.`:

- `.` means the repository root.
- The repository root contains `AGENTS.md` and `CLAUDE.md`.
- StudyClawHub uses that path to locate the Agent metadata/instructions.

You can also register individual skills. For example:

```text
Type: Skill
Name: guidebook-maker
GitHub Repo URL: https://github.com/hqiang335/Roammate
Path to Skill Folder: .claude/skills/guidebook-maker
Agent name: roammate-travel-concierge
GitHub Username: hqiang335
```

Other skill paths:

```text
.claude/skills/destination-brief
.claude/skills/local-reputation-research
.claude/skills/itinerary-planner
.claude/skills/map-route-builder
.claude/skills/guidebook-maker
.claude/skills/roammate-travel-concierge
```

## Notes

- Roammate is focused on mainland China travel planning.
- Travel prices, hotel inventory, routes, opening hours, and ticket policies change over time.
- Generated travel materials are for planning and demonstration only.
- The project does not book, pay, log in, or act on behalf of the user.
- If external APIs are unavailable, Roammate should degrade gracefully and mark data as estimated or pending verification.

## Acknowledgements

- Built for Claude Code / Codex style agent workflows
- Uses Amap APIs for maps, geocoding, and route references
- Integrates FlyAI travel search where available
- Uses Web-Rooter for cited public web evidence
