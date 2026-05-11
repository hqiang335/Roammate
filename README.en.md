# Roammate Travel Concierge

[Simplified Chinese](README.md) | English

Roammate is an AI-assisted travel planning agent for mainland China. It coordinates destination briefing, local reputation research, itinerary planning, route data, hotel and ticket references, source tracking, and a dashboard-style interactive HTML travel atlas.

The project is designed for Claude Code, Codex, and StudyClawHub-style agent/skill workflows. It can run as a multi-skill travel planning agent, while each skill can also be inspected or submitted independently.

## Online Demo

After GitHub Pages is enabled for this repository, the demo can be opened directly in a desktop or mobile browser. The current demo is the Chengdu package stored at `TRAVEL/成都-2026-06-01/guidebook.html`:

- [Chengdu 2026-06-01 Travel Atlas](https://hqiang335.github.io/Roammate/TRAVEL/%E6%88%90%E9%83%BD-2026-06-01/guidebook.html)
- [Local source file](TRAVEL/成都-2026-06-01/guidebook.html)

If the links return 404, enable GitHub Pages for the repository and wait for the Pages deployment to finish.

The demo HTML includes an Amap Web JS API demo key and `securityJsCode`, which is normal for browser-side map APIs. The demo key is intended for the GitHub Pages domain:

```text
hqiang335.github.io
```

## What It Does

Roammate turns a natural-language trip request into a complete travel package:

1. `destination-brief` creates a destination overview, best-season notes, transport gateways, traveler fit, cautions, and source-backed assumptions.
2. `local-reputation-research` studies attraction, restaurant, hotel-area, and tourist-trap reputation using public web evidence and structured travel data.
3. `itinerary-planner` builds the authoritative `itinerary.md`, then runs the lossless extractor that creates `itinerary-structured.json`.
4. `map-route-builder` consumes `itinerary-structured.json` where available, normalizes accepted POIs/hotels, geocodes places, builds routes, and writes `map-data.json`.
5. `guidebook-maker` generates `guidebook-data.json` and the dashboard-style `guidebook.html` from the Markdown reports, `itinerary-structured.json`, and `map-data.json`.

The main `roammate-travel-concierge` skill is a lightweight serial router. It does not spawn subagents, preload every child skill, hand-write final guidebook files, or report completion before `validate:trip` passes.

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
│       ├── itinerary-structured.json
│       ├── map-data.json
│       ├── guidebook-data.json
│       └── guidebook.html
├── AGENTS.md                      # General agent instructions
├── CLAUDE.md                      # Claude Code project instructions
├── README.md
├── README.en.md
├── package.json
└── package-lock.json
```

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

If you want to run browser rendering QA for `guidebook.html`, install Playwright's Chromium browser:

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
WEB_ROOTER_MAX_OUTPUT_CHARS=8000
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

Inside this project, use the npm wrapper instead of bare `wr` commands. Stages run `npm run doctor:webrooter` once before the first Web-Rooter call, then use compact Quark searches such as:

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=8000 \
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=3 --command-timeout-sec=60 \
  | npm run --silent wr:compact
```

The project intentionally avoids login-only scraping, account operations, booking, payment, posting, liking, or commenting. It also avoids Xiaohongshu-specific tooling. Web-Rooter is a sparse public-evidence layer; broad `deep` or `do` runs are reserved for conflicts or explicit user requests.

## Usage

Open this repository in Claude Code or Codex, then start with the main routing skill:

```text
/roammate-travel-concierge Plan a relaxed 4-day, 3-night Chengdu family trip from Guangzhou starting June 1, 2026, for two adults and a 7-year-old child. Use round-trip flights and generate the full travel package plus guidebook.
```

If slash commands are not available, provide the same request in natural language and ask Roammate to run the complete five-step workflow.

The final artifacts will be written under:

```text
TRAVEL/{destination}-{date}/
```

For example, the current demo package uses:

```text
TRAVEL/成都-2026-06-01/
```

Required full-package files:

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

Validate a generated trip package:

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

## Validation Scripts

```bash
npm run validate:ledger -- TRAVEL/成都-2026-06-01/research-ledger.json
npm run validate:map -- TRAVEL/成都-2026-06-01/map-data.json
npm run validate:guidebook -- TRAVEL/成都-2026-06-01/guidebook-data.json TRAVEL/成都-2026-06-01/guidebook.html
npm run validate:trip -- TRAVEL/成都-2026-06-01
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
- New runs should not create or depend on `itinerary-data.json`; `itinerary-structured.json` is the script-generated lossless index of `itinerary.md`.

## Acknowledgements

- Built for Claude Code / Codex style agent workflows
- Uses Amap APIs for maps, geocoding, and route references
- Integrates FlyAI travel search where available
- Uses Web-Rooter for cited public web evidence
