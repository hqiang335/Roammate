# Amap MCP Reference

Use Amap MCP for mainland China only when it is configured and available.

## Desired Capabilities

- Text search for POI name and address.
- Geocoding and reverse geocoding.
- Distance and route planning: driving, walking, cycling, public transit when available.
- Around search near core attractions for restaurants, cafes, convenience stores, pharmacies.
- Weather for destination city.

## Direct REST Fallback

The V1 package includes `scripts/build_real_map.py`, which can use Amap REST APIs directly even if the MCP tools are not available in the current Codex session:

- `/v3/place/text` for POI lookup.
- `/v3/geocode/geo` as fallback geocoder.
- `/v3/direction/walking` for compact route segments.
- Amap JavaScript API in generated `map.html`.

## Expected Configuration

The common server is `@amap/amap-maps-mcp-server` with an `AMAP_MAPS_API_KEY` environment variable.

For generated browser maps, also set `AMAP_WEB_JS_API_KEY`.

## Failure Handling

- If MCP tools are absent, continue with web search and estimates.
- If a POI has multiple matches, prefer exact city and official/scenic-area names.
- If geocoding confidence is low, mark the POI for user verification.
- If route planning fails, use approximate time and prefix with `约`.

## Data To Preserve

- POI name
- Address
- Coordinates
- Rating if available
- Opening hours if available
- Route distance and duration
- Source/tool used
