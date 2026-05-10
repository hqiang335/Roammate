# Data Flow and Artifact Ownership

Use this contract for full-package trips. Markdown files are reading reports; JSON files are the machine handoff layer.

## Ownership

| Artifact | Owner | Purpose |
| --- | --- | --- |
| `research-ledger.json` | full pipeline, updated by every research-producing skill | Source ledger for accepted/discarded facts, tool runs, freshness, confidence, and downstream usage |
| `destination-brief.md` | `destination-brief` | Human-readable destination summary |
| `reputation.md` | `local-reputation-research` | Human-readable POI reputation and avoidance report |
| `itinerary.md` | `itinerary-planner` | Human-readable itinerary |
| `itinerary-data.json` | `itinerary-planner` | Authoritative itinerary handoff for map and guidebook |
| `map-data.json` | `map-route-builder` | Authoritative map handoff with POIs, coordinates, routes, hotels |
| `pois.json` | `map-route-builder` | V1 legacy alias of `map-data.json`; do not use for itinerary data |
| `guidebook-data.json` | `guidebook-maker` | Adaptive Travel Atlas render input with day cards, POI dossiers, hotels, food, budget, checklist, and source labels |
| `map.html` | `map-route-builder` script | Generated standalone Amap dashboard map |
| `guidebook.html` | `guidebook-maker` script | Generated dashboard-style Travel Atlas; reads `guidebook-data.json` and sibling `map-data.json` |
| `sources.md` | full pipeline | Human-readable source index, generated from ledger by `scripts/generate-sources.mjs` |

## Read Before Query

Before running a tool, check whether the needed fact already exists in `research-ledger.json`, `itinerary-data.json`, or `map-data.json`.

Re-query only when:

- the needed field is missing;
- the prior fact is stale for a volatile field such as price, availability, weather, opening policy, or route duration;
- the prior fact has low confidence and affects itinerary feasibility;
- a different tool is needed for a different fact type, such as Amap route time after FlyAI `ai-search` play-time advice, or Quark hotel-area evidence after FlyAI hotel inventory.

## No Silent Loss

Every useful fact that affects the final plan must end up in one of these places:

- `itinerary-data.json` for timing, route order, rest, meals, reservation friction;
- `map-data.json` for coordinates, route segments, hotel candidates;
- `guidebook-data.json` for traveler-facing tips, POI dossiers, day-card wording, hotel portfolio, food, checklist, warnings, budget, source labels, and detail-drawer content;
- `sources.md` for human-readable source notes.

If a fact is intentionally not used, mark it `discarded` in `research-ledger.json` with `discard_reason`.

## No Main-Page Bloat

无损不等于把所有 Markdown 全部摊开。`guidebook.html` 的主阅读路径必须优先呈现已经结构化整理过的高价值信息：总体安排、每日交通与提醒、POI 口碑、酒店取舍、预算、美食、清单和可读来源。`destination-brief.md`、`itinerary.md`、`reputation.md` 作为审计/回看资料保留在折叠归档里。

必须删减或折叠：

- 重复出现的来源标签、内部 `fact_*` ID；
- 和主模块重复的大段 Markdown；
- 没有坐标的“酒店上图”承诺；
- 和 itinerary 交通方式冲突的长距离步行路线；
- 与当前酒店方案冲突的旧预算口径。

## No Wasteful Duplication

Avoid copying entire Markdown sections into JSON. JSON files should contain normalized fields, short summaries, IDs, and source labels.

Allowed repetition:

- `guidebook.html` combining itinerary, map, reputation, hotels, food, checklist, and sources into one interactive dashboard;
- `map.html` visualizing `map-data.json` as a standalone route dashboard;
- `itinerary.md` showing key reservation and rest notes inline.

Avoided repetition:

- putting itinerary data into `pois.json`;
- re-querying Amap/FlyAI for facts already in `research-ledger.json`, unless Quark evidence shows the prior hotel area/tier/candidate is a poor fit;
- rebuilding guidebook content by parsing large Markdown when `guidebook-data.json` exists.

## Final Quality Gate

Before final response, run:

```bash
node .claude/skills/roammate-travel-concierge/scripts/validate-trip-package.mjs \
  TRAVEL/{目的地}-{日期}
```

If validation fails, fix the data or artifact that failed. Do not deliver placeholder `map.html` or handwritten `guidebook.html`.

Generate `sources.md` before package validation:

```bash
node .claude/skills/roammate-travel-concierge/scripts/generate-sources.mjs \
  TRAVEL/{目的地}-{日期}/research-ledger.json \
  TRAVEL/{目的地}-{日期}/sources.md
```
