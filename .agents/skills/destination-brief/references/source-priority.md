# Source Priority

Use this ranking for mainland China destination briefs.

## Primary

- Amap MCP for covered structured facts: weather forecast window, POI/address/coordinates, local routes and distance.
- FlyAI dedicated CLI commands for covered booking-market facts: flights, trains, hotels, POI listings.
- Official tourism bureau, culture and tourism department, city government
- Scenic area official website or official WeChat article mirrored on an accessible page
- Railway, airport, metro, ferry, bus station official pages
- China Meteorological Administration or local weather bureau
- Emergency management, public security, transport notices

## Secondary

- FlyAI `ai-search` for semantic travel tips: preparation, queues, play time, reservation tactics, family suitability, scenic highlights.
- FlyAI `keyword-search` for ticket/package/search-result references when no dedicated command exists.
- Web-Rooter (`wr`) + Quark for cited public web evidence and real-experience signals: hotel areas/tier fit, restaurant reputation, scenic route tactics, queue/crowd warnings, family fit, and avoidance. Promote to `官方确认` only when the cited page is official.
- Public booking/listing pages for rough price reference and candidate discovery; prefer FlyAI dedicated commands for inventory and final volatile price labels.
- Public travel guides, review pages, forums, and local media for route ideas and traveler experience, never for volatile policy alone.
- Encyclopedic pages or local media for background, never for volatile policy alone
- Hotel and attraction listing pages for rough price ranges

## Tertiary

- Forums, personal blogs, short-video repost pages, SEO travel pages
- Use only as anecdotal signals. Do not treat as factual unless corroborated.

## Confidence Labels

- `官方确认`: official/current page or notice.
- `Amap verified`: structured Amap result for POI, weather, route, or distance.
- `FlyAI booking reference`: FlyAI dedicated command or keyword result for products/prices/links.
- `FlyAI semantic reference`: FlyAI ai-search travel advice, not official fact.
- `Web-Rooter cited`: public web evidence returned by `wr` with usable citations/URLs.
- `多源一致`: at least two independent non-official sources agree.
- `单源参考`: only one usable source found.
- `可能过时`: price, policy, schedule, construction, traffic, or weather-sensitive data.
