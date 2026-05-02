---
name: roammate-travel-concierge
description: Chinese-first travel concierge skills system for mainland China trip briefing, reputation research, itinerary planning, Amap/FlyAI route building, and printable guidebooks. Use for travel plans, destination advice, route maps, hotel research, budgets, and travel guidebooks.
---

# Roammate Travel Concierge

Use this top-level skill as the router for the V1 travel concierge system. It coordinates five nested skills. Keep this layer light: load only the nested skill that matches the user's request, or combine them in the order below for full trip planning.

## Routing

**Default: Full Pipeline**

Any request that includes a destination + date/duration + traveler count is a full planning request. Run all five steps automatically without asking for confirmation:

1. Destination brief → `skills/destination-brief/SKILL.md`
2. Local reputation research → `skills/local-reputation-research/SKILL.md`
3. Itinerary planning → `skills/itinerary-planner/SKILL.md`
4. Map and route building → `skills/map-route-builder/SKILL.md` (run `scripts/build_real_map.py`, produce `pois.json` + `map.html`)
5. Guidebook → `skills/guidebook-maker/SKILL.md` (produce `guidebook.html`)

Do not stop after step 3. Do not ask "do you want a map?" or "should I generate a guidebook?". Proceed through all five steps and write all output files.

**Single-skill routing** (only when the request clearly targets one task):

| User intent | Use nested skill |
| --- | --- |
| Destination overview only | `skills/destination-brief/SKILL.md` |
| "Is this place worth it?" / reputation only | `skills/local-reputation-research/SKILL.md` |
| Itinerary only, user already has research | `skills/itinerary-planner/SKILL.md` |
| Map / POI list only | `skills/map-route-builder/SKILL.md` |
| Guidebook only, user provides existing files | `skills/guidebook-maker/SKILL.md` |

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
- Do not use Xiaohongshu MCP.
- Do not crawl Dianping, Mafengwo, Ctrip, Fliggy, or other platforms. Use web search snippets/pages and official/API tools only.
- Amap MCP and FlyAI CLI are enhancements, not hard requirements. If unavailable, continue with web research and mark estimates clearly.
- Never book, pay, log in, or submit forms for the user. Provide recommendations and human confirmation points.
- Mark data freshness, sources, and uncertain items in every final travel artifact.

## Standard Outputs

When producing a full package, use:

```text
TRAVEL/{destination}-{date}/
├── destination-brief.md
├── reputation.md
├── itinerary.md
├── pois.json
├── map.html
├── guidebook.html
├── guidebook.pdf
└── sources.md
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
          "reservation_required": false
        }
      ]
    }
  ]
}
```
