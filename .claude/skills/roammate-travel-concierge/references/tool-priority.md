# Tool Priority

Use two complementary layers: Amap/FlyAI for structured facts, and Web-Rooter CLI + Quark for real traveler experience and public web evidence. Run Amap/FlyAI first when they cover weather, POI identity, routes, inventory, prices, or booking-market references; then use Quark for official notices, policy conflicts, visitor sentiment, restaurant reputation, route tactics, hotel-area convenience, hotel tier/type fit, detailed攻略, and avoidance details. Quark evidence is allowed to correct, down-rank, or trigger re-query of earlier FlyAI candidates. Do not use Claude Code built-in Web Search by default.

## Amap First

Use Amap MCP for mainland China place and local movement facts:

| Need | Preferred tool |
| --- | --- |
| Current/near-term city weather | `maps_weather` |
| POI existence, address, photos, basic listing | `maps_text_search` |
| POI coordinates, rating, opening fields when available | `maps_search_detail` |
| Address or landmark to coordinates | `maps_geo` |
| Coordinates to administrative address | `maps_regeocode` |
| Nearby restaurants, cafes, pharmacies, toilets, parking | `maps_around_search` |
| Walking/driving/cycling/public transit route | `maps_direction_walking`, `maps_direction_driving`, `maps_bicycling`, `maps_direction_transit_integrated` |
| Quick distance/time estimate | `maps_distance` |

Do not call Amap MCP through `npx @modelcontextprotocol/inspector` in Bash. MCP Inspector is an interactive debugging UI that opens a browser and binds a local proxy port, commonly `6277`; it is not the normal programmatic call path and can cause port conflicts. Use the native MCP tool interface when available. If the native MCP tool interface is unavailable, use `map-route-builder/scripts/build_real_map.py` or other direct REST/script fallback instead of Inspector.

Weather rule: `maps_weather` typically returns near-term forecasts only. If the user's travel date is outside the returned forecast dates, say the realtime forecast is unavailable and use seasonal climate guidance, with a reminder to re-check 3-4 days before departure.

Route rule: use Amap for day-level feasibility before estimating. If Amap fails, use conservative approximate time and prefix with `约`.

## FlyAI First

Use FlyAI CLI for travel product and booking-market facts. Do not book, pay, log in, or submit forms.

| Need | Preferred command |
| --- | --- |
| Flights between origin and destination | `flyai search-flight --origin ... --destination ... --dep-date ...` |
| Trains between origin and destination | `flyai search-train --origin ... --destination ... --dep-date ...` |
| Hotels near city or POI | `flyai search-hotel --dest-name ... --poi-name ... --check-in-date ... --check-out-date ...` |
| Attraction listings | `flyai search-poi --city-name ... --keyword ...` |
| Tickets, tours, packages, keywords | `flyai keyword-search --query ...` |
| Experience intelligence: scenic notes, preparation, reservation tips, queues, play time, must-play projects, family tips | `flyai ai-search --query ...` |
| Marriott hotel preference | `flyai search-marriott-hotel ...` |
| Marriott dining/package preference | `flyai search-marriott-package ...` |

Date rule: if the user provides exact dates, query those dates. If the user gives only a month, season, holiday window, or vague phrase such as `6月初`, choose a reasonable representative date range that matches the requested duration and run `search-flight`, `search-train`, `search-hotel`, `search-marriott-hotel`, and date-specific package/price searches normally. Clearly mark booking-market results as representative-date sample data. Ask a date question only when no plausible range can be inferred. If FlyAI returns empty/timeout/504 or the requested/representative date is not available, fall back to structure-level guidance and state the limitation.

Reliability rule: dedicated commands are more reliable than `ai-search` for flights, trains, hotels, and POI listings. Use `ai-search` as the first-choice experience-intelligence source before itinerary timing, but not as the sole source for official prices, opening hours, exact ticket-release times, current availability, or numeric ratings. Read `ai-search-playbook.md` when planning POI-level experiences.

Hotel rule: FlyAI hotel results are booking-market inventory, not a final recommendation. Do not accept the first cheap list as the hotel answer. Use Quark to determine stay areas, commute tradeoffs, family convenience, hotel tier/type expectations, and common complaints. Then rerun or filter FlyAI with `--poi-name`, `--key-words`, `--hotel-types`, `--hotel-stars`, `--hotel-bed-types`, `--max-price`, `--sort rate_desc`, or `--sort distance_asc` to produce a balanced portfolio. `flyai search-hotel` does not support `--max-results`; do not invent CLI flags. Preserve each accepted hotel's Feizhu `detailUrl`/`jumpUrl`, displayed price, star/type, tier, and room type if returned. If FlyAI does not return room type, record that status explicitly and do not invent one.

## Quark Experience Evidence Role

Use Web-Rooter + Quark after the structured pass, and always for recommendation-sensitive experience questions:

- official scenic-area notices, construction, closures, appointment policies, seasonal opening announcements;
- visitor sentiment,避雷, crowding, queue and route tactics from cited public pages;
- restaurant reputation, must-eat dishes, child-friendly/non-spicy food, local snack routes from public cited pages;
- detailed attraction tactics: 入园时间, 项目顺序, 必玩项目, 休息/用餐点;
- hotel area convenience, hotel tier/type fit, family facilities, breakfast/noise/transport tradeoffs, and candidate hotel reputation from public pages;
- corrections to FlyAI hotel candidates, itinerary density, route order, meal/rest timing, and avoidance notes.

For hotels, the expected output is not only "nearby cheap hotels". Produce a stay strategy and portfolio when evidence exists:

- `经济/交通优先`: lower price, acceptable location, clear tradeoffs.
- `舒适/亲子优先`: better breakfast, room size, bed type, family convenience, lower commute friction.
- `高端/位置优先`: premium service or landmark location when budget allows.
- `特色/度假/民宿`: only when it improves the trip, not as filler.

Read `web-rooter-playbook.md` before using Web-Rooter in a planning run. Prefer the smallest command that can produce cited evidence. For Chinese travel queries, all Web-Rooter searches must use `--engine=quark`, then crawl or read selected URLs:

- `npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60`
- `npm run --silent wr -- web "{query}" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120`
- `npm run --silent wr -- deep "{query}" --engine=quark --variants=3 --crawl=3 --command-timeout-sec=180`
- `npm run --silent wr -- visit "{url}"` or `npm run --silent wr -- html "{url}" --max-chars=12000`
- `npm run --silent wr -- do-plan "{goal}"`, then `npm run --silent wr -- do "{goal}" --dry-run`, then `npm run --silent wr -- do "{goal}" --strict`

Accept Web-Rooter output only when it contains usable `citations`, source URLs, or `references_text`. Discard irrelevant or low-signal results. Do not use Xiaohongshu, `wr xhs`, login, cookies, comments APIs, likes, posts, or account actions. If Web-Rooter fails or returns no usable citations, record the limitation and continue with Amap/FlyAI/estimates unless the user explicitly asks for another source.

For every Web-Rooter result used downstream, preserve at least one source URL or citation ID in `research-ledger.json`. Bare claims without a link are not reusable evidence.

## Source Labels

In artifacts, label sources by type:

- `Amap verified`: POI, coordinates, route, weather returned by Amap.
- `FlyAI booking reference`: flights, trains, hotels, tickets, packages, prices, or links returned by FlyAI.
- `FlyAI semantic reference`: `ai-search` advice about tips, preparation, queues, play time, or package ideas.
- `Official verified`: official website, official account mirror, government, rail/airport/operator notice.
- `Web-Rooter cited`: cited public web evidence from `wr` output, with URLs or `references_text`.
- `Estimated`: fallback produced without a successful structured or official source.
