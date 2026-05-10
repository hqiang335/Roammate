# Guidebook Data Schema

`guidebook-data.json` is the primary input for `scripts/build-guidebook.mjs`. Keep it structured, but do not over-compress traveler-facing experience. The renderer also reads sibling `map-data.json` when present so route, coordinate, hotel, and map data can power the dashboard.

Build it primarily from `research-ledger.json`, `itinerary-data.json`, and `map-data.json`.

## Required Base Fields

```json
{
  "destination": "成都",
  "dateRange": "2026-06-03 至 2026-06-06",
  "duration": "4天3夜",
  "travelers": "一家三口，含7岁小朋友",
  "origin": "广州",
  "generatedAt": "2026-05-09",
  "sourceFactIds": ["fact_panda_base_duration_20260509"],
  "days": []
}
```

## Flexible Optional Modules

Only include modules when useful evidence exists. Do not force every guidebook to contain every module.

- `overview`: summary, highlights, warnings, pace, stayArea, transportMode, budgetLevel.
- `days`: daily themes, timeline activities, meals, rest, budget, booking reminders, backup notes.
- `poiExperiences`: attraction play time, why-go reasons, must-do projects, queue/reservation, preparation, family notes, common complaints, avoid notes, suitable/not-suitable fit, optional image, source.
- `transport`: city-to-city and local movement references.
- `map`: map artifact path and notes.
- `hotels`: hotel candidates, stay-area fit, tier/type tradeoffs, and source labels.
- `food`: food items and child-friendly notes.
- `avoidance` or `reputationWarnings`: only meaningful warnings, not filler.
- `budget`: budget rows and total.
- `checklist`: grouped preparation items.
- `sources`: source and confidence notes.
- `sourceFactIds`: ledger fact IDs that shaped the guidebook.

## POI Experience Card Shape

```json
{
  "name": "成都大熊猫繁育研究基地",
  "whyGo": ["亲子教育价值高", "早晨熊猫活跃度高"],
  "recommendedDuration": "3-4小时",
  "mustDo": ["月亮产房", "太阳产房", "小熊猫活动场"],
  "queueAndReservation": ["7:30开园即入", "花花别墅排队长，可选择其他别墅"],
  "preparation": ["儿童身份证或户口本", "防晒", "驱蚊", "水"],
  "familyNotes": ["园区较大，可使用观光车"],
  "commonComplaints": ["周末观光车排队长", "下午熊猫常睡觉"],
  "avoid": ["不要中午后才入园，熊猫活跃度明显下降"],
  "suitable": "亲子家庭、第一次到成都的游客",
  "notSuitable": "不愿早起或体力很弱的游客",
  "source": "FlyAI semantic reference，2026-05-09"
}
```

When a card comes from `research-ledger.json`, include the fact IDs in `sourceFactIds` at the card or root level when useful.

## Hotel Portfolio Shape

```json
{
  "stayStrategy": "优先住春熙路/天府广场一带，方便地铁、餐饮和夜间补给；预算敏感可退到地铁2/3号线沿线。",
  "source": "Web-Rooter cited + FlyAI booking reference，2026-05-09",
  "options": [
    {
      "tier": "舒适/亲子优先",
      "name": "示例酒店或区域",
      "area": "春熙路/太古里",
      "priceReference": "代表性日期样例价，价格波动",
      "roomType": "FlyAI未返回具体房型，需点击飞猪链接确认",
      "bookingUrl": "https://a.feizhu.com/example",
      "longitude": "104.080455",
      "latitude": "30.66717",
      "fit": "适合带孩子、晚餐选择多、地铁方便",
      "tradeoffs": ["核心区价格更高", "热门日期需提前确认房型"],
      "sourceFactIds": ["fact_chengdu_hotel_area_20260509"]
    }
  ]
}
```

Do not reduce hotels to a cheapest-first list. Include economy, comfortable/family, premium/location-first, or special-stay options when evidence supports those tiers. The renderer accepts either `hotels: [{...}]` or `hotels: { stayStrategy, source, options: [{...}] }`. Specific hotel candidates must include `bookingUrl`/`detailUrl`/`jumpUrl`, a real FlyAI price reference, and a real room type if FlyAI returned one. If FlyAI did not return room type, store the absence explicitly; do not invent room names.

If a hotel candidate is accepted into `guidebook-data.json`, preserve FlyAI `longitude`/`latitude` when returned, or store geocoded coordinates from `map-data.json`. If coordinates are unavailable, the renderer will not claim the hotel appears on the map.

## Pruning and Consistency Rules

The guidebook is not a raw report concatenator. It should preserve useful information without repeating low-value material.

- Main modules should carry the decision facts: overall plan, day-by-day route, POI reputation, hotels, budget, food, checklist, readable sources.
- Full Markdown reports should be collapsed archival material for audit/review, not the main reading path.
- Keep source labels readable; internal `fact_*` IDs belong in collapsed technical details.
- Do not duplicate the same warning in every module unless it directly affects that module.
- Budget must be internally consistent with the accepted lodging tier. A `¥498/晚` hotel portfolio cannot share a `3晚 ¥510` accommodation budget unless explicitly labeled as a different budget tier.
- Route summaries should prefer itinerary transport segments. Long Amap walking routes between far-apart POIs are misleading and should be filtered or replaced by driving/transit/taxi references.

## Density Rule

Use adaptive density:

- `brief`: simple city breaks, few warnings, low reservation friction.
- `standard`: normal multi-day city travel.
- `detailed`: family trips, older adults, complex reservations, outdoor risk, high queue friction, or many Amap/FlyAI facts.

The renderer keeps a stable visual style while sections appear only when the corresponding data exists.

## Travel Atlas Interaction Rule

The final `guidebook.html` is a dashboard-style Travel Atlas. Each full-package guidebook should preserve enough structured data for:

- day tabs and timeline cards;
- map marker matching by POI/hotel name;
- click-to-open detail drawer;
- expandable POI dossiers with the richest useful reputation/itinerary facts;
- hotel tier cards with Feizhu links, displayed price, room-type status, fit, and tradeoffs;
- source notes for volatile or experience-based judgments.

Do not reduce `reputation.md`, `itinerary.md`, or `destination-brief.md` to a generic one-paragraph summary if they contain actionable route, queue, reservation, hotel, food, weather, or avoid notes. Convert those facts into structured fields.
