# Roammate Travel Guideboook

[English](README.md) | 简体中文

Roammate 是面向中国大陆旅行的 AI 旅行规划助手。输入目的地、日期、天数和出行人群后，它会生成一个完整旅行包：目的地简报、口碑调研、详细行程、地图路线数据，以及 dashboard 型 `guidebook.html`。

## 在线 Demo

- [成都 2026-06-01 旅行地图册](https://hqiang335.github.io/Roammate/TRAVEL/%E6%88%90%E9%83%BD-2026-06-01/guidebook.html)

## 主要能力

- 目的地简报：旅行季节、城市定位、交通样例和注意事项
- 口碑调研：景点、餐厅、住宿区域和避坑信息
- 行程规划：每日时间表、交通、预算、预约提醒和备用方案
- 地图路线：POI 坐标、酒店坐标、路线摘要和地图数据
- 旅行地图册：生成可浏览、可打印的 `guidebook.html`

## Skill 主目录

```text
.claude/skills/
├── roammate-travel-concierge/     # 主路由，串行执行完整流程
├── destination-brief/             # 目的地简报
├── local-reputation-research/     # 口碑调研
├── itinerary-planner/             # 行程规划和无损索引提取
├── map-route-builder/             # POI、坐标和路线数据
└── guidebook-maker/               # guidebook 数据和 HTML 生成
```

完整流程会依次生成：

```text
TRAVEL/{目的地}-{YYYY-MM-DD}/
├── research-ledger.json
├── destination-brief.md
├── reputation.md
├── itinerary.md
├── itinerary-structured.json
├── map-data.json
├── guidebook-data.json
└── guidebook.html
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

如需运行 guidebook 浏览器渲染检查，可安装 Playwright Chromium：

```bash
npx playwright install chromium
```

### 2. 配置密钥和外部工具

基础文本规划可以在部分工具缺失时降级运行；完整地图、路线、酒店和网页证据建议完成以下配置。

| 名称 | 状态 | 用途 |
| --- | --- | --- |
| `AMAP_MAPS_API_KEY` | 推荐 | 高德 Web Service API，用于 POI、地理编码和路线规划 |
| `AMAP_WEB_JS_API_KEY` | 推荐 | 高德 Web JS API，用于 `guidebook.html` 前端地图 |
| `AMAP_SECURITY_JS_CODE` | 推荐 | 高德 Web JS API 浏览器端安全配置 |
| `FLYAI_API_KEY` | 推荐 | FlyAI 航班、火车、酒店、门票和套餐参考 |
| `flyai` CLI | 推荐 | 调用 FlyAI 旅行搜索 |
| Playwright Chromium | 推荐 | `guidebook.html` 浏览器 QA |
| Web-Rooter `wr` CLI | 完整流程需要 | 公开网页证据、官方公告、口碑和信息冲突复核 |

可以在项目根目录创建 `.env`：

```bash
AMAP_MAPS_API_KEY=your_amap_maps_api_key_here
AMAP_WEB_JS_API_KEY=your_amap_web_js_api_key_here
AMAP_SECURITY_JS_CODE=your_amap_security_js_code_here
FLYAI_API_KEY=your_flyai_api_key_here
WEB_ROOTER_HOME=/absolute/path/to/web-rooter
WEB_ROOTER_NO_RICH=1
WEB_ROOTER_MAX_OUTPUT_CHARS=8000
```

配置也可以放在当前 shell 环境变量、`~/.codex/.env` 或 `~/.flyai/config.json` 中。

### 3. 配置 Web-Rooter

Web-Rooter 用于公开网页搜索和引用证据。推荐安装在项目外部：

```bash
git clone https://github.com/baojiachen0214/web-rooter.git ~/tools/web-rooter
cd ~/tools/web-rooter
bash install.sh
wr doctor
```

回到 Roammate 后验证：

```bash
cd /path/to/Roammate
npm run doctor:webrooter
```

项目内调用 Web-Rooter 时使用 npm wrapper：

```bash
npm run --silent wr -- web "{query}" --engine=quark --no-crawl --num-results=3 \
  | npm run --silent wr:compact
```

## 示例输出

以成都 2026-06-01 的 4天3夜亲子旅行为例，系统会生成：

- `destination-brief.md` - 成都目的地概览，包含最佳旅行时间、交通方式、核心体验
- `reputation.md` - 熊猫基地、都江堰、宽窄巷子、人民公园、杜甫草堂等景点的口碑分析和避雷指南
- `itinerary.md` - 详细的4天行程安排，包含时间表、交通、费用、预约提醒
- `itinerary-structured.json` - 从 `itinerary.md` 脚本生成的无损机器索引，保留表格单元格、备注、链接和每日详情，不作为摘要替代
- `research-ledger.json` - 信息总账，记录 Amap/FlyAI/官方/Web-Rooter 公开网页来源、可信度、取舍和下游使用情况
- `map-data.json` - 景点、坐标、路线和酒店的结构化地图数据
- `guidebook-data.json` - Travel Atlas 渲染输入，保留每日卡片、POI 攻略档案、酒店组合、美食、预算和清单
- `guidebook.html` - 主交付物：dashboard 型交互旅行地图册，集成地图、每日行程、地点详情、酒店、预算和清单，可打印或分享

## 使用方法

在 Claude Code 或 Codex 中打开项目，然后输入完整旅行需求，例如：

```text
/roammate-travel-concierge 计划今年6月1日去成都玩，一家三口带7岁小朋友，4天3夜，从广州出发，帮我制定旅游攻略。
```

如果 slash command 暂时不可用，也可以直接用自然语言说明需求，并要求按 Roammate 完整流程生成。

## 常用命令

验证完整旅行包：

```bash
npm run validate:trip -- TRAVEL/成都-2026-06-01
```

从已有数据重建 guidebook：

```bash
node .claude/skills/guidebook-maker/scripts/build-guidebook-data.mjs \
  TRAVEL/成都-2026-06-01

node .claude/skills/guidebook-maker/scripts/build-guidebook.mjs \
  TRAVEL/成都-2026-06-01/guidebook-data.json \
  TRAVEL/成都-2026-06-01/guidebook.html
```

其他校验：

```bash
npm run validate:ledger -- TRAVEL/成都-2026-06-01/research-ledger.json
npm run validate:map -- TRAVEL/成都-2026-06-01/map-data.json
npm run validate:guidebook -- TRAVEL/成都-2026-06-01/guidebook-data.json TRAVEL/成都-2026-06-01/guidebook.html
npm test
```

## 注意事项

- 本项目默认输出简体中文，专注于中国大陆旅行规划。
- `itinerary.md` 是行程权威文本，`itinerary-structured.json` 是脚本生成的无损索引。
- 价格、库存、天气、开放时间、票务和路线都可能变化，出行前需要复核。
- Roammate 不执行登录、预订、付款、发帖、点赞或评论等账号操作。

## 致谢

- 基于 [Claude Code](https://claude.ai/code) 构建
- 使用 [高德地图 API](https://lbs.amap.com/)
- 集成 FlyAI-CLI 旅行搜索
- 使用 [Web-Rooter](https://github.com/baojiachen0214/web-rooter) 进行公开网页证据检索
