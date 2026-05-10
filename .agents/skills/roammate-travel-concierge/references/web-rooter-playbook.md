# Web-Rooter Playbook

Use Web-Rooter (`wr`) + Quark as Roammate's public web evidence and real-experience layer. It replaces Claude Code built-in Web Search for travel planning because it provides an auditable execution path plus `citations` and `references_text`. It is not only a fallback for Amap/FlyAI gaps: use it to validate and adjust recommendation-sensitive decisions such as hotel choice, restaurant choice, attraction route tactics, queues, and "is it worth it" judgments.

## Preconditions

- Run `npm run doctor:webrooter` during setup or when Web-Rooter fails unexpectedly.
- Prefer `npm run --silent wr -- ...` instead of raw `wr ...`; the project wrapper can find a global `wr`, `WEB_ROOTER_HOME`, `~/tools/web-rooter`, or `./web-rooter`.
- The project wrapper reads `.env` before resolving Web-Rooter, so users can set `WEB_ROOTER_HOME=/absolute/path/to/web-rooter` there when `wr` is not on PATH.
- Prefer CLI usage. MCP is optional and not required for Roammate.
- Use public, non-login pages only.

For cleaner machine-readable output, run commands with:

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=12000 npm run --silent wr -- ...
```

## Command Ladder

Use the smallest command that can produce cited evidence. For mainland China travel queries, all Web-Rooter search commands must pin Quark with `--engine=quark`, then crawl or read selected URLs with `web --crawl-pages`, `visit`, or `html --js`.

Engine rule:

- Use `quark` for official facts, opening hours, ticketing, notices,攻略, personal experience, restaurant lists, hotel-area convenience, and avoidance notes.
- Do not use other engines in the default Roammate flow unless the user explicitly asks for a comparison.

```bash
# First pass: cited search results only
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=12000 \
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60

# Search + crawl selected results only when snippets are insufficient
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=30000 \
npm run --silent wr -- web "{query}" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120

# Exact official page or known URL
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=12000 \
npm run --silent wr -- visit "{url}"

WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=12000 \
npm run --silent wr -- html "{url}" --max-chars=12000

# Multi-source sentiment or conflicting claims
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=16000 \
npm run --silent wr -- deep "{query}" --engine=quark --variants=3 --crawl=3 --command-timeout-sec=180

# Complex tasks where command choice is unclear
npm run --silent wr -- skills --resolve "{goal}" --compact
npm run --silent wr -- do-plan "{goal}"
npm run --silent wr -- do "{goal}" --dry-run
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=16000 \
npm run --silent wr -- do "{goal}" --strict --crawl-pages=5 --command-timeout-sec=180

# Long tasks
npm run --silent wr -- do-submit "{goal}" --strict --timeout-sec=900
npm run --silent wr -- jobs --status=running
npm run --silent wr -- job-status "{job_id}" --with-result
npm run --silent wr -- job-result "{job_id}"
```

## Travel Query Templates

Official/current facts:

```bash
npm run --silent wr -- web "{景点/城市} 官方 预约 开放时间 临时关闭 公告 {年份或月份}" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
npm run --silent wr -- web "{景点} 门票 预约 退改 限流 官方" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
npm run --silent wr -- web "{城市} 文旅局 {月份} 活动 公告 亲子" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
```

Visitor sentiment and route tactics:

```bash
npm run --silent wr -- deep "{景点} 值得去吗 避雷 排队 预约 亲子 老人 游玩时长" --engine=quark --variants=3 --crawl=3
npm run --silent wr -- web "{景点} 保姆级攻略 入园 酒店 必玩 项目 避雷" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
npm run --silent wr -- web "{景点} 排队 限流 预约不上 人多 避雷 游玩路线" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
```

Restaurant and local services:

```bash
npm run --silent wr -- web "{区域或景点附近} 本地人 必吃 餐厅 不辣 亲子 推荐" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
npm run --silent wr -- web "{区域或景点附近} 适合儿童 不辣 餐厅 推荐 近期" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
npm run --silent wr -- web "{餐厅名} 好吃吗 人均 招牌菜 排队 停业 搬迁" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
```

Hotel-area and hotel portfolio:

```bash
npm run --silent wr -- web "{城市} 住哪里方便 亲子 地铁 景点 区域 推荐" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
npm run --silent wr -- deep "{城市} {区域} 住宿 方便吗 亲子 游客评价 交通" --engine=quark --variants=3 --crawl=3 --command-timeout-sec=180
npm run --silent wr -- web "{城市} 酒店 推荐 亲子 档次 位置 方便 避雷" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
npm run --silent wr -- web "{城市} {区域} 酒店 推荐 舒适 高端 亲子 交通 早餐 隔音" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
npm run --silent wr -- web "{酒店名} 亲子 早餐 隔音 位置 交通 避雷" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60
```

Use these hotel searches to build a stay-area strategy first, then adjust FlyAI hotel inventory. A cited Quark result can justify dropping a FlyAI candidate, changing the target area, or adding a different tier/type of hotel.

## Evidence Rules

- Accept Web-Rooter results only when output contains usable `citations`, source URLs, or `references_text`.
- Prefer crawled `title`, page text, or useful HTML metadata over bare search result URLs. Bare search results can discover candidates, but facts should come from crawled pages or `html --js` reads when possible.
- In `research-ledger.json`, record the tool run as `wr web`, `wr deep`, `wr visit`, `wr html`, or `wr do`.
- Use `source_type: "Official verified"` when the cited page is an official/government/operator page.
- Use `source_type: "Web-Rooter cited"` for non-official but cited public web evidence.
- Store concise facts, source URLs, source labels, and confidence; do not paste whole crawled pages into JSON.
- Record irrelevant, empty, low-signal, or failed Web-Rooter runs as `discarded` when the failure matters for auditability.
- If sources conflict, prefer official pages for policy/hours/prices and use non-official pages only as sentiment or corroborating context.
- For hotels, treat FlyAI as inventory/price and Quark as experience/context. Final recommendations should explain why each tier or area fits, not just list the cheapest candidates.

## Safety Rules

- Do not use Xiaohongshu, `wr xhs`, authenticated/cookie-based scraping, login, comments APIs, likes, posts, account actions, forms, booking, or payment.
- Do not treat SEO pages, ads, coupon pages, or copied listicles as high-confidence evidence.
- If the project wrapper cannot find Web-Rooter, `npm run doctor:webrooter` fails, output lacks citations, or a command times out, record the limitation and continue with Amap/FlyAI/estimates unless the user explicitly asks for another source.
