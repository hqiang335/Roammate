# Itinerary Rules

## Daily Density

- Standard city day: 3-5 activities.
- Older adults or children: 2-4 activities, include rest blocks.
- Self-driving day over 3 hours driving: no more than 2 major attractions.
- Hot, rainy, or crowded season: add indoor or low-effort backup.
- Anchor attractions with rich experiences, performances, queues, or large parks should receive their comfortable FlyAI `ai-search` duration, not a token 30-60 minute stop.

## Feasibility Gate

Check every day before finalizing:

- Does the day have a coherent geographic area?
- Did FlyAI `ai-search` identify must-play projects, play time, queue/booking friction, and preparation for each anchor POI?
- Did Amap verify or estimate the transfer time between major POIs?
- Are opening hours compatible with the time slot?
- Are required reservations marked?
- Is meal timing realistic?
- Are rest, warming/cooling, toilet, snack, or cafe blocks included for children/older adults or long outdoor exposure?
- Is transport time included between major POIs?
- Are must-play projects and best time-of-day notes visible in the daily table?
- Is there a backup plan for weather, fatigue, or crowding?

## Long-Distance Rules

- Same city or nearby district: can combine several POIs.
- 80-150 km one way: usually one main destination that day.
- Over 150 km one way: independent day, transfer day, or overnight stay.

## Older Adults And Children

- Avoid long stair routes unless clearly wanted.
- Prefer hotels near transport or evening dining.
- Add toilets, shade, cafes, or rest points when known.
- Avoid late-night returns after high-effort days.
- Use FlyAI `ai-search` for child/older-adult attraction cautions and preparation, then mark volatile facts for verification.

## Experience Time Budget

Before finalizing a day, combine:

- FlyAI minimum/comfortable attraction duration.
- Quark-cited traveler tactics, especially for large parks, queues, hotel area convenience, restaurant timing, and avoidance.
- Queue/reservation buffer.
- Amap transfer time.
- Meal/rest/warming/cooling time.
- Time-of-day constraints such as shows, night views, sunrise/sunset, or seasonal activities.

If the sum exceeds the available day, reduce POIs before compressing the anchor attraction below its practical duration.

## Tool Gates

- City-to-city transport: use FlyAI `search-flight` and `search-train`; if they fail, mark the gap or estimate conservatively instead of falling back to Claude Code built-in Web Search. If public web evidence is needed for official/current context, use Web-Rooter with citations. If the user gave only a month/season/vague window, choose a representative date range for the requested duration, query normally, and label results as sample booking-market data.
- Local movement: try Amap geocoding plus route/distance tools before estimating.
- Stay area: use Quark to decide the practical stay areas, commute tradeoffs, and hotel tier/type fit; then use FlyAI `search-hotel` near the chosen area/core POI for inventory and price. If exact dates are missing, use the assumed representative check-in/check-out dates and label hotel inventory/prices as sample booking-market data. Do not keep a FlyAI cheapest-first list when Quark evidence points to a better area or tier.
- Tickets/packages: use FlyAI `keyword-search` or `ai-search` as reference, then verify official policy when it affects the day.

## Markdown Handoff

- `itinerary.md` is the complete human-readable itinerary authority. `itinerary-structured.json` is generated from it after writing and acts as the lossless machine index for map/guidebook stages.
- Keep headings, daily tables, budget tables, and transport/hotel tables parseable so the extractor can copy cells, remarks, links, and daily detail labels without summarizing.
- Prefer concise bullet/table fields for must-do, queue/friction, preparation, and source notes instead of burying them in long prose.
- After validation passes, continue the full pipeline; do not emit final delivery language until map and guidebook gates pass.

## Self-Driving

- Include parking, tolls, fuel/charging, mountain roads, and night-driving risk.
- Keep final drive segment conservative.
- Add buffer for scenic roads and parking queues.

## High Altitude

- Arrival day should be light.
- Avoid high-altitude excursions immediately after arrival.
- Mark altitude, oxygen, hydration, and insurance concerns when relevant.
