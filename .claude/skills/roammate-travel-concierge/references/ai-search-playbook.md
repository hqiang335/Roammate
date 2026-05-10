# FlyAI AI Search Playbook

Use `flyai ai-search` to collect experience intelligence before final itinerary timing. It is strongest for qualitative travel guidance and should be labeled `FlyAI semantic reference`.

## When To Use

Use `ai-search` for:

- attraction must-know notes and visitor rules;
- preparation materials, clothing, gear, documents, child/older-adult cautions;
- avoidance tips: queues, crowding, paid extras, poor-value choices, weather exposure;
- reservation and ticketing tactics, without claiming exact ticket-release times unless verified;
- suggested play time and minimum/comfortable duration;
- attraction features, must-play projects, seasonal/festival activities, shows, best time of day;
- family-friendly or theme-specific routing ideas;
- ticket price and booking channel references, clearly marked as volatile;
- tour/package/private-car ideas for budget and logistics reference;
- hotel or area ideas when the query is qualitative rather than inventory-heavy.

Avoid relying on `ai-search` for:

- official opening hours, exact ticket prices, exact release windows, or current availability;
- numeric ratings when Amap `maps_search_detail.rating` is available;
- detailed restaurant reputation. Use Amap around search for candidates and Web-Rooter cited public web evidence for lived food/restaurant experience later.

## Recommended Query Set

For each priority POI, run one compact query that includes the user's traveler type and travel season:

```bash
flyai ai-search --query "{城市}{景点} {月份/季节} {同行人/限制} 游玩须知 准备材料 避雷 排队 预约 游玩时长 必玩项目 特色活动 门票 适合小孩"
```

For highly complex POIs, split if needed:

```bash
flyai ai-search --query "{景点} 游玩时长 必玩项目 推荐路线 特色项目 表演 时间"
flyai ai-search --query "{景点} 预约抢票 排队 避雷 门票价格 官方预订方式"
flyai ai-search --query "{景点} 带小孩 准备材料 穿什么 安全注意 休息用餐"
```

For a destination-level package reference:

```bash
flyai ai-search --query "{城市} {天数} {同行人} 旅游套餐 包车 私家团 价格 行程 推荐"
```

## Extracted Fields

When useful, extract these fields into notes that downstream skills can consume:

```markdown
### {POI} · FlyAI 体验情报
- 建议时长：最低 / 舒适 / 不建议压缩
- 首推体验：必玩项目、特色表演、节庆活动、最佳时段
- 预约与排队：需提前预约/抢票/排队项目/错峰策略
- 准备材料：衣物、证件、装备、儿童/老人用品
- 亲子/老人适配：适合点、风险点、身高/体力/安全提醒
- 门票与预订：参考价格、渠道方向、需官方复核点
- 避雷：高价低值项目、额外消费、拥堵、天气暴露、关闭风险
- 用餐与休息：是否需要提前吃饭、园内餐饮、可休息点
- 数据标签：FlyAI semantic reference，查询日期
```

## Itinerary Impact

Use the extracted fields before assigning time slots:

- Reserve the comfortable duration for anchor attractions unless the user asks for a fast pace.
- Add queue buffers for popular projects and reservation friction.
- Add meal/rest blocks when the attraction has long exposure, high walking load, few food options, or children/older adults.
- Put weather-exposed attractions earlier/later based on seasonal comfort and Amap weather when available.
- Keep must-play projects visible in the schedule notes instead of listing only attraction names.
- If `ai-search` says a seasonal attraction is likely closed outside its season, do not schedule it as a core stop without official confirmation.

## Confidence Handling

- Treat `ai-search` as high value for experience design, not as official proof.
- Exact prices, opening hours, ticket policies, release times, and closures require official or booking-page confirmation.
- If `ai-search` returns empty, times out, or 504s, say it failed and continue with Amap, dedicated FlyAI commands, and Web-Rooter cited public web research when experiential details are needed. Do not fall back to Claude Code built-in Web Search unless the user explicitly asks.
