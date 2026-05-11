# Research Ledger Minimal Contract

Use this only when writing or fixing `research-ledger.json`. Prefer the validator as the source of truth.

## Root

```json
{
  "schema_version": "1.0",
  "artifact_type": "research-ledger",
  "trip": {
    "destination": "成都",
    "date_range": "2026-06-01 至 2026-06-04",
    "duration": "4天3夜",
    "origin": "广州",
    "travelers": "一家三口，含7岁小朋友",
    "assumptions": []
  },
  "generated_at": "2026-05-10",
  "tool_runs": [],
  "facts": []
}
```

## Tool Runs

Each meaningful query gets one short run entry:

```json
{
  "id": "run_flyai_flight_can_ctu_20260510",
  "tool": "flyai search-flight",
  "query": "广州→成都 2026-06-01",
  "status": "success",
  "ran_at": "2026-05-10",
  "summary": "保留2-3个可用航班、时间、价格和链接。",
  "source_label": "FlyAI booking reference"
}
```

Allowed `status`: `success`, `failed`, `discarded`, `sample`, `estimated`.

## Facts

```json
{
  "id": "fact_panda_base_duration_20260510",
  "subject": "成都大熊猫繁育研究基地",
  "category": "experience_duration",
  "value": "建议上午入园，游玩3-4小时。",
  "source_type": "FlyAI semantic reference",
  "source_run_id": "run_flyai_ai_panda_20260510",
  "confidence": "medium_high",
  "freshness": "2026-05-10",
  "used_by": ["reputation.md", "itinerary.md"],
  "status": "accepted"
}
```

Allowed `source_type`: `Amap verified`, `FlyAI booking reference`, `FlyAI semantic reference`, `Official verified`, `Web-Rooter cited`, `Estimated`.

Allowed `confidence`: `high`, `medium_high`, `medium`, `low`, `unknown`.

Useful `category` examples: `weather`, `transport`, `hotel_candidate`, `hotel_area_strategy`, `route`, `experience_duration`, `must_do`, `reservation`, `queue`, `preparation`, `family_fit`, `avoidance`, `food`, `budget`, `ticket_reference`, `official_policy`, `assumption`.

## Required Notes

- Do not store raw tool output or whole articles.
- Accepted final facts need `used_by`.
- Discarded facts need `discard_reason`.
- FlyAI `hotel_candidate` facts must preserve the Feizhu/FlyAI URL in a separate `booking_url`, `detailUrl`, or `jumpUrl` field; a URL buried in `value` prose is not enough.
- Web-Rooter evidence must preserve a resolved URL via `source_url`, `source_urls`, `urls`, full `citations`, or `references_text`; bare `W1` IDs are not auditable.
- Validate with `node .claude/skills/roammate-travel-concierge/scripts/validate-ledger.mjs --final TRAVEL/{trip}/research-ledger.json`.
