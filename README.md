# Roammate Travel Concierge

[English](README.en.md) | 简体中文

中国大陆旅行规划助手，提供目的地简报、口碑调研、行程规划、地图路线和 dashboard 型交互旅行地图册生成功能。

## 项目简介

Roammate 是一个基于 Claude Code / Codex 的智能旅行规划系统，专注于中国大陆旅行。它通过项目级 skills 协调目的地调研、口碑研究、行程规划、地图路线和交互旅行地图册生成；配置高德地图 API、FlyAI 和 Web-Rooter 后，可以生成更完整的 POI、路线、互动地图、酒店参考，并通过 Web-Rooter 获取带引用的公开网页证据、官方公告、游客口碑和餐厅口碑。

## 在线 Demo

GitHub Pages 部署后，可以直接在浏览器或手机中打开示例旅行地图册：

- [新疆 2026-05-27 旅行地图册](https://hqiang335.github.io/Roammate/TRAVEL/新疆-2026-05-27/guidebook.html)
- [新疆 2026-05-27 独立地图](https://hqiang335.github.io/Roammate/TRAVEL/新疆-2026-05-27/map.html)

如果链接显示 404，请先确认 GitHub 仓库已经开启 Pages，并等待 Pages 构建完成。示例页面中的高德地图使用绑定到 `hqiang335.github.io` 的 Web 端 JS API demo key；浏览器端地图 key 会出现在生成的 HTML 中，这是 Web JS API 的正常使用方式。

## 核心功能

### 五大 Skills

1. **destination-brief** - 目的地简报
   - 目的地概览和定位
   - 最佳旅行时间分析
   - 交通方式和核心体验
   - 风险提醒和注意事项

2. **local-reputation-research** - 口碑调研
   - 景点和餐厅口碑分析
   - 避雷指南和推荐等级
   - 本地人推荐和游客评价
   - 预约、排队、价格提醒

3. **itinerary-planner** - 行程规划
   - 多日行程详细安排
   - 时间表、交通、费用预算
   - 家庭出行、自驾、预算优化
   - 雨天备用方案

4. **map-route-builder** - 地图路线
   - POI 规范化和地理编码
   - 高德地图路线规划
   - FlyAI 航班、火车、酒店、门票/套餐参考
   - 互动地图生成（HTML）

5. **guidebook-maker** - 交互旅行地图册
   - dashboard 型 HTML Travel Atlas
   - 地图、每日行程、地点详情、酒店、预算和来源同屏整合
   - 稳定视觉系统，支持打印
   - 可选 PDF 导出

## 项目结构

```
claude-roammate-v3/
├── .agents/
│   └── skills/                    # Codex 项目级 skills（如使用 Codex）
├── .claude/
│   ├── skills/                    # 主路由和五个子 skills
│   │   ├── roammate-travel-concierge/
│   │   ├── destination-brief/
│   │   ├── local-reputation-research/
│   │   ├── itinerary-planner/
│   │   ├── map-route-builder/
│   │   └── guidebook-maker/
│   └── settings.json.example      # Claude Code 配置示例
├── TRAVEL/                        # 旅行产出物目录
│   └── {目的地}-{日期}/
│       ├── research-ledger.json
│       ├── destination-brief.md
│       ├── reputation.md
│       ├── itinerary.md
│       ├── itinerary-data.json
│       ├── map-data.json
│       ├── pois.json              # V1 兼容别名，内容同 map-data.json
│       ├── map.html
│       ├── guidebook-data.json
│       ├── guidebook.html
│       └── sources.md
├── CLAUDE.md                      # 项目说明文档
├── package.json                   # Node.js 依赖
└── README.md                      # 本文件
```

## 快速开始

### 1. 前置要求

- Claude Code CLI 或 Desktop App
- Node.js 18+ 和 npm
- Python 3.10+
- 网络访问，用于实时搜索、高德地图和 FlyAI 请求
- Web-Rooter `wr` CLI（推荐），用于可引用公共网页搜索、抓取、多源交叉验证和官方页面读取

基础文本规划可以在没有高德/FlyAI/Web-Rooter 的情况下运行，但地图、路线、酒店、公共网页证据和 PDF 功能需要额外配置。

### 2. 安装依赖

```bash
npm install
```

如果需要把 `guidebook.html` 导出为 PDF，还需要安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

### 3. 配置密钥和外部工具

完整功能需要以下本地配置：

| 名称 | 是否必需 | 用途 | 获取/安装 |
| --- | --- | --- | --- |
| `AMAP_MAPS_API_KEY` | 推荐 | 高德 Web Service API，用于 POI 搜索、地理编码、路线规划 | 在高德开放平台创建应用并启用 Web 服务相关能力 |
| `AMAP_WEB_JS_API_KEY` | 推荐 | 高德 Web JS API，用于生成的 `map.html` 前端地图渲染 | 在高德开放平台创建 Web 端应用 Key |
| `AMAP_SECURITY_JS_CODE` | 推荐 | 高德 Web JS API 安全密钥，用于新建 JS API Key 的浏览器端鉴权 | 与 `AMAP_WEB_JS_API_KEY` 同时在高德控制台生成 |
| `FLYAI_API_KEY` | 可选 | FlyAI CLI 航班、火车、酒店、景点商品、门票/套餐参考 | 从 FlyAI 获取 API Key |
| `flyai` CLI | 可选 | 调用 FlyAI 旅行搜索 | 按 FlyAI 官方说明安装 CLI |
| `wr` CLI（Web-Rooter） | 推荐 | 官方公告、公共网页搜索/抓取、多源交叉验证、游客口碑、餐厅口碑、引用输出 | 安装 [web-rooter](https://github.com/baojiachen0214/web-rooter) |

#### 配置方式 A：使用 Claude Code 配置

复制示例配置：

```bash
cp .claude/settings.json.example .claude/settings.json
```

然后把 `.claude/settings.json` 里的占位符替换成自己的 Key。

#### 配置方式 B：使用本地 `.env`

也可以在项目根目录创建 `.env`：

```bash
AMAP_MAPS_API_KEY=your_amap_maps_api_key_here
AMAP_WEB_JS_API_KEY=your_amap_web_js_api_key_here
AMAP_SECURITY_JS_CODE=your_amap_security_js_code_here
FLYAI_API_KEY=your_flyai_api_key_here
WEB_ROOTER_HOME=/absolute/path/to/web-rooter
WEB_ROOTER_NO_RICH=1
WEB_ROOTER_MAX_OUTPUT_CHARS=12000
```

`WEB_ROOTER_HOME` 只在 `wr` 没有进入 PATH 时需要，必须写成本机绝对路径，例如 `/Users/q/tools/web-rooter`。

#### 配置方式 C：使用用户级配置

地图脚本会尝试从以下位置读取密钥：

- 当前 shell 环境变量
- 项目根目录 `.env`
- `~/.codex/.env`
- `~/.flyai/config.json`

FlyAI 也可以使用：

```bash
flyai config set FLYAI_API_KEY "your_flyai_api_key_here"
```

#### 配置 Web-Rooter（推荐）

Web-Rooter 是本项目推荐的公共网页证据层，用来替代 Claude Code 内置 Web Search。它适合做“搜索 → 抓取 → 引用 → 可复查”的链路，输出中的 `citations` 和 `references_text` 会写入 `research-ledger.json`。在旅行规划里，Web-Rooter + Quark 不只是补空白；它承担真实经验层，用来校正 Amap/FlyAI 的结构化结果，尤其是酒店区域、酒店档次、餐厅口碑、景点玩法、排队避雷和亲子适配。

推荐按 Web-Rooter 官方 README 安装。Roammate 推荐把它安装在项目外部，例如 `~/tools/web-rooter`。

```bash
git clone https://github.com/baojiachen0214/web-rooter.git ~/tools/web-rooter
cd ~/tools/web-rooter
bash install.sh
wr doctor
wr help
```

回到 Roammate 项目后，用项目 wrapper 验证。后续 skills 也会通过这个 wrapper 调用 Web-Rooter，而不是直接依赖全局 `wr`：

```bash
cd /path/to/Roammate
npm run doctor:webrooter
```

如果安装后当前终端仍提示 `wr: command not found`，先重开终端；如果 Claude Code 仍找不到它，就在 Roammate 的 `.env` 中写入 `WEB_ROOTER_HOME`，或在当前 shell 执行：

```bash
export WEB_ROOTER_HOME="$HOME/tools/web-rooter"
npm run doctor:webrooter
```

本项目默认只使用公开、非登录网页。网络搜索统一使用 Quark：优先命令是 `wr web --engine=quark`、`wr deep --engine=quark`、`wr visit`、`wr html`；中文旅行查询先用 `wr web --engine=quark --no-crawl` 获取可引用搜索结果，再按 URL 用 `wr visit` / `wr html` 精读。复杂任务先 `wr skills --resolve`、`wr do-plan`、`wr do --dry-run`，再 `wr do --strict`。酒店、餐厅和复杂景点攻略必须把 Quark 结果作为决策证据，而不是只展示 FlyAI 的低价候选。不要使用小红书、`wr xhs`、账号登录、Cookie 抓取、点赞评论、发帖、预订或付款。

### 4. 验证本地环境

```bash
node -v
npm -v
python3 --version
npm ls --depth=0
flyai --help
npm run doctor:webrooter
```

如果已经配置高德 MCP，可以在 Claude Code / Codex 中验证高德地理编码工具是否可用；如果没有 MCP，`map-route-builder` 里的脚本仍可通过高德 REST API 降级运行。

Web-Rooter 可用性可以用一条公开网页查询验证：

```bash
WEB_ROOTER_NO_RICH=1 WEB_ROOTER_MAX_OUTPUT_CHARS=12000 \
npm run --silent wr -- web "成都 大熊猫繁育研究基地 官方 预约 开放时间" --engine=quark --no-crawl --num-results=5 --command-timeout-sec=60
```

常用命令选择：

```bash
# 快速查一个点，先拿引用搜索结果
npm run --silent wr -- web "{景点} 官方 预约 开放时间" --engine=quark --no-crawl --num-results=8 --command-timeout-sec=60

# 找到可信 URL 后再读页面
npm run --silent wr -- visit "{url}"
npm run --silent wr -- html "{url}" --max-chars=12000

# 搜索并抓取多页
npm run --silent wr -- web "{景点} 值得去吗 避雷 排队 亲子" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120

# 多源交叉验证
npm run --silent wr -- deep "{城市} 亲子游 避雷 餐厅 住宿 区域" --engine=quark --variants=3 --crawl=3 --command-timeout-sec=180

# 酒店真实经验层：先判断住哪片区和档次组合，再回到 FlyAI 查库存/价格
npm run --silent wr -- web "{城市} 亲子 住哪里方便 酒店 推荐 档次 区域 避雷" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
npm run --silent wr -- web "{城市} {区域} 酒店 推荐 亲子 早餐 隔音 交通 避雷" --engine=quark --crawl-pages=3 --num-results=8 --command-timeout-sec=120
```

### 5. 使用方法

1. 在 Claude Code 中打开本项目目录。Claude Code 会从 `.claude/skills/{skill-name}/SKILL.md` 发现项目级 skills；如果你刚添加了新的 skill 目录但 slash 列表没有刷新，重启当前 Claude Code 会话。

2. 使用主路由 skill 开始规划：
   ```
   /roammate-travel-concierge 广州出发，5月15日中午出发去西安游玩三天两夜，并返回广州。我和一个朋友共两人。
   ```

   如果 slash command 暂时没有出现，也可以直接输入完整需求：
   ```
   广州出发，5月15日中午出发去西安游玩三天两夜，并返回广州。我和一个朋友共两人。请按 Roammate 完整五步流程生成所有产物。
   ```

3. 系统会自动执行完整的五步流程：
   - 生成目的地简报
   - 进行口碑调研
   - 规划详细行程
   - 构建地图和路线
   - 生成 dashboard 型交互旅行地图册

4. 所有产出物保存在 `TRAVEL/{目的地}-{日期}/` 目录

流程会先把可复用事实写入 `research-ledger.json`，再生成 `itinerary-data.json`、`map-data.json` 和 `guidebook-data.json`。`map.html` 和 `guidebook.html` 不应由模型手写：地图由 `map-route-builder/scripts/build_real_map.py` 生成并校验，主交付物 `guidebook.html` 由 `guidebook-maker/scripts/build-guidebook.mjs` 生成 dashboard 型 Travel Atlas，并自动合并同目录的 `map-data.json`。如果外部工具或密钥不可用，应输出降级说明，而不是把占位页冒充正式地图或手册。完整流程不得在第 3 步行程规划后输出最终总结；只有地图、手册、来源索引和 `validate:trip` 全部完成或明确降级后，才算交付。

完整产物可用以下命令检查：

```bash
npm run validate:trip -- TRAVEL/西安-20260515
```

如果需要单独重建来源索引：

```bash
npm run generate:sources -- TRAVEL/西安-20260515/research-ledger.json
```

不要用 `> sources.md` 重定向生成来源索引；脚本会直接写入默认 `sources.md`，也可以把输出路径作为第二个参数传入。

如果某些外部能力不可用，系统会继续生成文本行程，并在地图、酒店、路线等部分标注“估算”或“待核实”。

如果用户只提供月份、季节或“6月初”这类模糊时间，系统会默认选择合理的代表性日期区间继续完整流程，正常查询航班、火车、酒店、票务/套餐和路线；这些价格、库存、天气和票务结果会标注为代表性日期样例数据。

### 单独使用某个 Skill

如果只需要某个特定功能，可以单独调用：

```
/destination-brief 西安，5月15日出发，三天两夜
/local-reputation-research 西安，兵马俑、城墙、回民街
/itinerary-planner 西安，5月15日，三天两夜，两人，广州出发
/map-route-builder 西安，兵马俑、城墙、大雁塔、陕西历史博物馆
/guidebook-maker 西安，基于 TRAVEL/西安-20260515/ 生成手册
```

## 示例输出

以西安三天两夜旅行为例，系统会生成：

- **destination-brief.md** - 西安目的地概览，包含最佳旅行时间、交通方式、核心体验
- **reputation.md** - 兵马俑、城墙、陕西历史博物馆等景点的口碑分析和避雷指南
- **itinerary.md** - 详细的三天行程安排，包含时间表、交通、费用、预约提醒
- **research-ledger.json** - 信息总账，记录 Amap/FlyAI/官方/Web-Rooter 公开网页来源、可信度、取舍和下游使用情况
- **itinerary-data.json** - 行程结构化数据，供地图和手册复用
- **map-data.json** - 景点、坐标、路线和酒店的结构化地图数据
- **pois.json** - V1 兼容别名，内容同 `map-data.json`
- **map.html** - 独立高德地图 dashboard，标记所有景点、路线和酒店
- **guidebook-data.json** - Travel Atlas 渲染输入，保留每日卡片、POI 攻略档案、酒店组合、美食、预算、清单和来源标签
- **guidebook.html** - 主交付物：dashboard 型交互旅行地图册，集成地图、每日行程、地点详情、酒店、预算、清单和来源，可打印或分享
- **sources.md** - 来源索引和核实提醒

## 技术栈

- **Claude Code** - AI 驱动的开发环境
- **Codex** - 可读取项目级 AGENTS/skills 的开发环境
- **高德地图 API** - POI 搜索、地理编码、路线规划
- **FlyAI CLI** - 航班、火车、酒店、景点商品、门票/套餐参考（飞猪数据源）
- **Web-Rooter CLI** - 官方公告、公共网页搜索/抓取、游客口碑、餐厅口碑和可引用来源
- **Playwright** - HTML 转 PDF（可选）

## 设计原则

- **简体中文优先** - 默认输出简体中文
- **不使用小红书** - 不使用小红书 MCP / `wr xhs`
- **不代替用户操作** - 不预订、付款或登录
- **结构化 + 经验双层决策** - Amap/FlyAI 负责位置、路线、库存和价格，Web-Rooter + Quark 负责真实经验、口碑、攻略和酒店区域/档次校正；Claude Code 内置 Web Search 不自动兜底
- **降级友好** - 高德和 FlyAI 不可用时降级继续，标注估算
- **数据可信度标注** - 所有数据标注来源和可信度

## 注意事项

- 本项目专注于中国大陆旅行规划
- 需要配置高德地图、FlyAI 和 Web-Rooter 以获得完整功能；缺失时会降级为估算、文本建议或标注待核实，不自动使用 Claude Code 内置 Web Search 兜底
- 价格、开放时间等信息可能波动，建议出行前核实
- 生成的旅行手册仅供参考，不构成专业旅行建议

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- 基于 [Claude Code](https://claude.ai/code) 构建
- 使用 [高德地图 API](https://lbs.amap.com/)
- 集成 [FlyAI](https://www.flyai.com/) 旅行搜索

---

🤖 Generated with Claude Sonnet 4.6
