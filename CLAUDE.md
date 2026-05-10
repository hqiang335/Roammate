# Roammate Travel Concierge v3

中国大陆旅行规划助手，提供目的地简报、口碑调研、行程规划、地图路线和 dashboard 型交互旅行地图册。

## Skills

项目级 skills 位于 `.claude/skills/{skill-name}/SKILL.md`，通过 `/roammate-travel-concierge` 触发主路由。

| Skill | 触发场景 |
| --- | --- |
| `roammate-travel-concierge` | 主路由，协调所有子 skill |
| `destination-brief` | 目的地概览、最佳季节 |
| `local-reputation-research` | 口碑调研、避坑、值不值得去 |
| `itinerary-planner` | 多日行程、家庭出行、自驾、预算 |
| `map-route-builder` | POI 规范化、路线图、高德、FlyAI 交通/酒店/票务 |
| `guidebook-maker` | dashboard 型 HTML Travel Atlas / PDF 旅行手册 |

## 工具与 API

- **高德地图 MCP**：`amap_maps` 服务器，自动注入 `AMAP_MAPS_API_KEY`
- **高德 Web JS API**：`AMAP_WEB_JS_API_KEY`，用于 `map.html` 和 dashboard 型 `guidebook.html` 前端地图渲染
- **FlyAI CLI**：`FLYAI_API_KEY`，用于航班、火车、酒店、景点商品、门票/套餐参考
- **Web-Rooter CLI**：`wr`，用于官方公告、公开网页抓取、多源交叉验证、游客口碑、餐厅口碑和带引用的网页证据输出

## 结构化工具 + 真实经验双层决策

查询天气、POI、坐标、路线、周边餐饮/服务时，优先使用高德 MCP；查询航班、火车、酒店库存/价格、景点商品、门票/套餐/包车参考时，优先使用 FlyAI CLI。Web-Rooter CLI + Quark 是同等重要的真实经验层，用于公开网页证据、官方公告、政策冲突、真实游客口碑、餐厅口碑、排队避雷、保姆级攻略、住宿区域经验和酒店口碑，而不是 Claude Code 内置 Web Search。

结构化层和经验层必须互相校正：Amap/FlyAI 给出“存在、位置、路线、库存、价格”的初始事实；Quark 给出“是否值得、怎么安排、住哪里更顺、哪个档次/类型更合适、哪些候选应降权”的经验判断。遇到酒店选择、餐厅选择、复杂景点玩法或亲子/老人适配时，不得只采用 FlyAI 的低价候选；必须用 Quark 公开网页证据形成区域与档次策略，再按需要重查或筛选 FlyAI 酒店结果。

FlyAI `ai-search` 可用于景点须知、准备材料、排队避雷、预约抢票、游玩时长、亲子注意事项、特色项目和套餐思路，但必须标注为语义搜索参考，不可当作官方事实或实时票价。

Web-Rooter 网络搜索统一使用 Quark：优先使用 `wr web --engine=quark --no-crawl` 获取中文旅行查询的可引用搜索结果，再用 `wr web --engine=quark --crawl-pages=N`、`wr visit` 或 `wr html` 精读可信 URL；需要更宽覆盖时用 `wr deep --engine=quark`。复杂任务先 `wr skills --resolve`、`wr do-plan`、`wr do --dry-run`，再 `wr do --strict`。输出必须包含可用 citations、URL 或 `references_text` 才能作为证据写入 `research-ledger.json`；官方页面标注 `Official verified`，非官方公开网页标注 `Web-Rooter cited`。不得使用小红书、小红书 MCP、`wr xhs`、登录、Cookie、账号操作、预订付款或评论/点赞/发布。

没有明确出行日期时，默认选择合理的代表性日期区间继续完整流程，包括航班、火车、酒店、票务/套餐和路线查询；所有价格、库存、天气和票务结果必须标注为代表性日期样例数据。

## 输出目录

旅行产出物写入 `TRAVEL/{目的地}-{日期}/`。

正式流程区分数据层和展示层：

- `research-ledger.json`：信息总账，记录事实、工具调用、来源、可信度、取舍和下游使用情况。
- `itinerary-data.json`：行程结构，供地图和手册复用。
- `map-data.json`：地图权威数据，包含 POI、坐标、路线、酒店；`pois.json` 仅作为 V1 兼容别名。
- `guidebook-data.json`：Travel Atlas 渲染输入，保留每日卡片、POI 攻略档案、酒店组合、美食、预算、清单和来源标签。
- `map.html`：必须由 `map-route-builder/scripts/build_real_map.py` 生成并通过校验；作为独立 Amap dashboard 地图。
- `guidebook.html`：必须由 `guidebook-maker/scripts/build-guidebook.mjs` 生成并通过校验；这是主交付的 dashboard 型交互旅行地图册，会合并 `guidebook-data.json` 和同目录 `map-data.json`。

最终交付前运行：

```bash
npm run validate:trip -- TRAVEL/{目的地}-{日期}
```

## 主路由兜底规则

当用户提出包含目的地、日期/时长、同行人数的完整旅行规划需求时，即使没有显式输入 `/roammate-travel-concierge`，也默认执行完整五步流程：

1. `destination-brief`：目的地简报
2. `local-reputation-research`：口碑与避坑
3. `itinerary-planner`：每日行程
4. `map-route-builder`：POI、路线、地图、酒店参考
5. `guidebook-maker`：dashboard 型 HTML Travel Atlas / PDF 旅行手册

不要在第 3 步后停止，也不要再问用户是否需要地图或手册；除非缺少会影响规划的关键信息，否则直接写入 `TRAVEL/{目的地}-{日期}/`。中间步骤只能输出简短进度，不得在 `itinerary-data.json` 验证通过后说“完整规划已完成”或给最终总结；只有第 4 步地图、第 5 步手册、`sources.md` 和 `npm run validate:trip -- TRAVEL/{目的地}-{日期}` 全部完成或明确降级失败后，才能输出最终交付说明。

## 规则

- 默认简体中文输出
- 不使用小红书、小红书 MCP 或 `wr xhs`
- 不代替用户预订、付款或登录
- 高德和 FlyAI 不可用时降级继续，标注估算
- 不手写正式 `map.html` 或 `guidebook.html`；失败时写明降级原因，而不是生成占位正式产物
- 不重复查询已经在 `research-ledger.json` 中有新鲜高可信记录的事实
- 需要公共网页证据时优先使用 Web-Rooter CLI；Claude Code 内置 Web Search 只能在用户明确要求时使用
