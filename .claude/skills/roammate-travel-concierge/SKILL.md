---
name: roammate-travel-concierge
description: Lightweight serial router for complete mainland China trip packages: destination brief, reputation research, itinerary, map data, and dashboard guidebook.
---

# Roammate Travel Concierge

Use this skill only as a thin orchestration layer. It must not become a research playbook, context preloader, or delegation wrapper.

## Contract

Consumes:

- User trip request with destination, date or duration, origin/arrival context, and travelers.
- Existing files in one canonical `TRIP_DIR` when resuming.

Produces:

- A complete trip package directory.
- Stage artifacts only through the active nested skill or bundled scripts.

Does not:

- Perform research itself.
- Rewrite downstream artifacts by hand.
- Load multiple child skills at once.
- Spawn subagents or run account/login/booking/payment actions.

Exit gate:

- `node .claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs "$TRIP_DIR"` passes.

## Trigger

When the request includes destination, date or duration, origin or arrival context, and travelers, run the full package without asking whether to make maps or a guidebook.

Use one canonical directory:

```text
TRAVEL/{目的地}-{YYYY-MM-DD}/
```

If a date is vague but inferable, choose a representative date range and label volatile booking/weather facts as sample data. Ask only when no plausible date range can be inferred.

## Hard Rules

- Stay in the current agent. Do not spawn or delegate to subagents for this skill.
- At startup, read only this file, derive `TRIP_DIR`, and inspect existing trip files if needed.
- Open no later-stage child skill or shared reference before its stage begins.
- Load exactly one nested skill for the current stage, finish that stage, then move to the next stage.
- Treat the pipeline list below as a routing table, not as permission to preload every child skill.
- Project tool commands override generic Web-Rooter/FlyAI habits. When the active stage needs FlyAI or Web-Rooter, read `references/tool-command-contract.md` or instruct the child stage to do so; do not call bare `wr`, `which wr`, or guessed FlyAI commands.
- Do not print raw FlyAI, Amap, or Web-Rooter JSON. Compact tool output before using it.
- Do not declare Web-Rooter/FlyAI unavailable until the project wrapper or documented command shape has failed.
- Do not hand-write `guidebook-data.json` or `guidebook.html`; use the bundled scripts.
- Do not report success until package validation passes.

## Serial Pipeline

Run these stages in order:

1. Read `../destination-brief/SKILL.md`; create `destination-brief.md`, validate the stage, and update `research-ledger.json`.
2. Read `../local-reputation-research/SKILL.md`; create `reputation.md`, validate the stage, and update `research-ledger.json`.
3. Read `../itinerary-planner/SKILL.md`; create `itinerary.md`, run the lossless itinerary extractor to create `itinerary-structured.json`, validate both, and update `research-ledger.json`.
4. Read `../map-route-builder/SKILL.md`; create and validate `map-data.json`.
5. Read `../guidebook-maker/SKILL.md`; build and validate `guidebook-data.json` and `guidebook.html`.
6. Run package validation.

After a stage passes, continue immediately. If a stage fails, inspect only the failing artifact, the active stage skill, and the validator output needed to fix it.

## Required Final Gate

For a full package, these files must exist:

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

Then run:

```bash
node .claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs "$TRIP_DIR"
```

Only after this passes may the final response say the trip package is complete.

## Single-Stage Routing

If the user asks for only one part, load only that nested skill:

| User intent | Nested skill |
| --- | --- |
| Destination overview | `../destination-brief/SKILL.md` |
| Reputation, worth-it, avoid notes | `../local-reputation-research/SKILL.md` |
| Itinerary only | `../itinerary-planner/SKILL.md` |
| Map, POI, routes | `../map-route-builder/SKILL.md` |
| Guidebook from existing trip files | `../guidebook-maker/SKILL.md` |
