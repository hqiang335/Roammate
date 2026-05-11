# Tool Command Contract

Use this only when a Roammate stage actually needs FlyAI or Web-Rooter. It overrides generic Web-Rooter instructions in this repo.

## Web-Rooter

Use the project wrapper only. Do not call bare `wr`, `which wr`, or `wr --help`.

```bash
npm run doctor:webrooter
```

Run this once before the first Web-Rooter call in a trip. If it fails, record a degraded Web-Rooter note in `research-ledger.json` and continue with Amap/FlyAI/estimated facts. Do not switch automatically to Claude Code built-in Web Search unless the user explicitly asks.

Default public-evidence search:

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=8000 \
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=3 --command-timeout-sec=60 \
  | npm run --silent wr:compact
```

Only increase to 5 results or crawl one selected URL when the first pass is weak:

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=8000 \
npm run --silent wr -- web "{query}" --engine=quark --crawl-pages=1 --num-results=3 --command-timeout-sec=90 \
  | npm run --silent wr:compact
```

For known official pages:

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=8000 \
npm run --silent wr -- html "{url}" --max-chars=8000 \
  | npm run --silent wr:compact
```

Use `deep` only for unresolved conflicts or explicit user requests, not as the normal travel-planning path.

## FlyAI

Check command help before declaring FlyAI unavailable. A command failure caused by wrong options is not tool unavailability.

Do not use deprecated guesses such as `flyai flights`, `flyai trains`, `search-poi --query`, `search-poi --city`, `search-hotel --city-name`, `--check-in`, `--check-out`, or `--sort-type` for hotels.

Pipe FlyAI JSON through the project compactor instead of hand-writing `python3 -c` field guesses.

### Flights

```bash
flyai search-flight --origin="广州" --destination="成都" --dep-date=2026-06-01 --sort-type=3 \
  | npm run --silent compact:flyai -- flight --limit=4
```

Important output fields after compaction: `code`, `carrier`, `dep`, `dep_station`, `arr`, `arr_station`, `duration_minutes`, `price`, `url`.

### Trains

```bash
flyai search-train --origin="广州" --destination="成都" --dep-date=2026-06-01 --sort-type=4 \
  | npm run --silent compact:flyai -- train --limit=4
```

Use the same compact transport fields as flights.

### Hotels

```bash
flyai search-hotel --dest-name="乌鲁木齐" --check-in-date=2026-05-27 --check-out-date=2026-05-29 \
  --hotel-stars=4,5 --sort=rate_desc \
  | npm run --silent compact:flyai -- hotel --limit=6
```

Important output fields after compaction: `name`, `star`, `area`, `address`, `price`, `url`, `image`, `longitude`, `latitude`.

### POIs

```bash
flyai search-poi --city-name="乌鲁木齐" --keyword="新疆国际大巴扎" \
  | npm run --silent compact:flyai -- poi --limit=3
```

Important output fields after compaction: `name`, `category`, `address`, `ticket`, `url`, `image`, `longitude`, `latitude`, `note`.

### Semantic Search

```bash
flyai ai-search --query="成都 亲子 7岁 4天3夜 核心景点 排队 预约 游玩时长 准备材料" \
  | npm run --silent compact:flyai -- ai-search
```

Treat `ai-search` as semantic reference, not official policy or numeric review proof.

## Error Handling

- Do not hide failures with `2>/dev/null` while deciding whether a tool is available.
- Do not use `head` to limit single-line JSON; it may pass the whole payload through.
- If compaction fails, inspect `raw_preview`, then run the specific `flyai <command> --help` or `npm run --silent wr -- help <command>`.
- Record a tool run as `failed` only after the correct command and options have failed.
- Preserve booking/query URLs separately in Markdown tables and ledger facts. For `hotel_candidate` facts from FlyAI, include `booking_url`, `detailUrl`, or `jumpUrl` as a separate field, not only inside prose.
