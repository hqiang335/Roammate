# Amap MCP Reference

Use Amap MCP for mainland China only when it is configured and available.

## Available Capabilities

| Capability | Tool |
| --- | --- |
| Weather forecast window | `maps_weather` |
| Text search for POI name/address | `maps_text_search` |
| POI detail from ID | `maps_search_detail` |
| Around search near a coordinate | `maps_around_search` |
| Geocoding | `maps_geo` |
| Reverse geocoding | `maps_regeocode` |
| Distance measurement | `maps_distance` |
| Walking route | `maps_direction_walking` |
| Driving route | `maps_direction_driving` |
| Public transit route | `maps_direction_transit_integrated` |
| Cycling route | `maps_bicycling` |
| IP location | `maps_ip_location` |

## Suggested Calls

```text
maps_weather({ city: "哈尔滨" })
maps_text_search({ city: "哈尔滨", keywords: "中央大街", types: "旅游景点" })
maps_search_detail({ id: "POI_ID_FROM_SEARCH" })
maps_around_search({ location: "126.617610,45.769967", keywords: "餐厅", radius: "1000" })
maps_geo({ address: "圣索菲亚教堂", city: "哈尔滨" })
maps_distance({ origins: "126.617682,45.774835", destination: "126.627215,45.770125", type: "3" })
maps_direction_walking({ origin: "126.617682,45.774835", destination: "126.627215,45.770125" })
```

Use these through the native MCP tool interface only. Do not run `npx @modelcontextprotocol/inspector` from Bash to call Amap; Inspector is an interactive debugging proxy, opens a browser, and can leave port `6277` occupied after the page is closed.

Weather only covers the returned forecast dates. For future dates outside that window, write seasonal guidance and a re-check reminder.

## Direct REST Fallback

The V1 package includes `scripts/build_real_map.py`, which can use Amap REST APIs directly even if the MCP tools are not available in the current Codex session:

- `/v3/place/text` for POI lookup.
- `/v3/geocode/geo` as fallback geocoder.
- `/v3/direction/walking` for compact route segments.

For full-package map data, run the script before guidebook generation. It writes:

- `map-data.json`: authoritative POI, route, hotel, date, and source payload.

Run `scripts/validate_map.mjs map-data.json` after generation. If validation fails, fix `map-data.json` or write an explicit `map-error.md` fallback.

## Expected Configuration

The common server is `@amap/amap-maps-mcp-server` with an `AMAP_MAPS_API_KEY` environment variable. `AMAP_WEB_JS_API_KEY` is used later by the guidebook renderer for browser-side map display, not by standalone map generation.

## Failure Handling

- If MCP tools are absent, continue with FlyAI, official/Web-Rooter cited evidence, and estimates.
- If MCP tools are absent but `AMAP_MAPS_API_KEY` is configured, prefer the direct REST script before declaring map data unavailable.
- If a POI has multiple matches, prefer exact city and official/scenic-area names.
- If geocoding confidence is low, mark the POI for user verification.
- If route planning fails, use approximate time and prefix with `约`.
- For restaurants, use Amap to find candidates and location facts, then use Web-Rooter for cited public sentiment.

## Data To Preserve

- POI name
- Address
- Coordinates
- Rating if available
- Opening hours if available
- Route distance and duration
- Source/tool used
