# Reputation Search Patterns

Use structured tools first. Use Web-Rooter + Quark cited public web research only when Amap/FlyAI do not provide enough evidence for a recommendation-sensitive choice such as hotels, restaurants, major attraction tactics, official/current status, or family fit. Claude Code built-in Web Search is a fallback only when the user explicitly asks for it.

## Structured Tool Pass

- Amap POI detail: `{景点} 地址 坐标 rating open_time`
- Amap around search: `{核心景点附近} 餐厅 咖啡 药店 停车场`
- FlyAI search-poi: `{城市} {景点关键词}`
- FlyAI keyword-search: `{景点} 门票 预订 一日游 套餐`
- FlyAI ai-search: `{景点} 游玩须知 准备材料 避雷 排队 预约 游玩时长 必玩项目 特色活动 适合小孩`
- FlyAI search-hotel/search-marriott-hotel: hotel reputation and price reference only when hotels are in scope.

Do not treat FlyAI semantic text as official policy. Use it to identify what to verify and what warnings to include.

Do not treat FlyAI hotel inventory as the final hotel recommendation. Use it for available candidates, prices, brands, stars, and links; use existing ledger evidence first, then one small Quark query if area, tier, hotel type, or recurring complaints remain unclear.

For itinerary anchor POIs, extract only compact experience fields: suggested duration, must-do projects, queue/reservation friction, preparation, family/older-adult fit, ticket reference, avoid notes, and meal/rest constraints.

## Web-Rooter Command Pattern

Use `.claude/skills/roammate-travel-concierge/references/tool-command-contract.md` for exact Web-Rooter commands. Start with Quark no-crawl search, 3 results, and compact output; crawl/read one selected URL only when needed.

Avoid `deep` in normal planning; use it only for unresolved conflicts or explicit user requests. Accept results only when citation URLs, source URLs, or `references_text` are usable. Record official pages as `Official verified`; record non-official cited public evidence as `Web-Rooter cited`.
Do not paste raw WR output. Reduce it to short `{title,url,usable_claims,discard_reason}` facts before writing `research-ledger.json`.

## Destination Queries

- `{目的地} 值得去吗`
- `{目的地} 避雷`
- `{目的地} 亲子 老人 自驾 坑`
- `{目的地} 旺季 排队 预约`
- `{目的地} 雨天 备用`
- `{目的地} 交通 坑 停车`
- `{目的地} 文旅局 官方 公告 活动 {月份}`

## Attraction Queries

- `{景点} 值得去吗`
- `{景点} 避雷`
- `{景点} 排队 预约`
- `{景点} 门票 开放时间 官方`
- `{景点} 官方 预约 限流 临时关闭 公告`
- `{景点} 适合老人 小孩`
- `{景点} 停车 场`

## Restaurant Queries

- `{餐厅} 好吃吗 人均`
- `{餐厅} 排队 预约`
- `{餐厅} 避雷`
- `{餐厅} 招牌菜`
- `{餐厅} 停业 搬迁`

Restaurant rule: FlyAI `ai-search` is unreliable for detailed restaurant sentiment. Prefer Amap around search for candidates, then Web-Rooter for cited public reviews and official/current status.

## Hotel Queries

- `{城市} 住哪里方便 亲子 地铁 景点 区域 推荐`
- `{城市} 酒店 推荐 亲子 档次 位置 方便 避雷`
- `{城市} {区域} 酒店 推荐 舒适 高端 亲子 交通 早餐 隔音`
- `{景点} 附近 酒店 推荐 方便 亲子 避雷`
- `{酒店名} 亲子 早餐 隔音 位置 交通 避雷`

Hotel rule: derive a stay-area strategy first, then shape FlyAI queries with area/POI, star level, hotel type, max price, distance, or rating sort. Final recommendations should include tradeoffs across economy, comfortable/family, premium/location-first, and special-stay options when useful evidence exists.

## Official Scoped Queries

- `site:gov.cn {目的地} 文旅 公告`
- `site:{官方景区域名} {景点} 预约 开放时间 临时关闭`
- `site:{城市文旅域名} {目的地} 活动 公告`

Do not use Xiaohongshu, `wr xhs`, or authenticated/cookie-based scraping for this project.

## Risk Words

Crowding: `排队`, `限流`, `预约不上`, `人挤人`, `旺季`.

Bad value: `不值`, `坑`, `商业化`, `宰客`, `踩雷`, `照骗`.

Logistics: `停车难`, `打车难`, `绕路`, `闭园`, `维修`, `临时关闭`.

Ad indicators: repeated superlatives, no concrete prices, coupon language, identical wording across pages, only booking links.
