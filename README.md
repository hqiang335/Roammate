# Roammate Travel Concierge

中国大陆旅行规划助手，提供目的地简报、口碑调研、行程规划、地图路线和旅行手册生成功能。

## 项目简介

Roammate 是一个基于 Claude Code 的智能旅行规划系统，专注于中国大陆旅行。通过整合高德地图 API 和 FlyAI 酒店搜索，为用户提供从目的地调研到完整旅行手册的一站式服务。

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
   - FlyAI 酒店搜索
   - 互动地图生成（HTML）

5. **guidebook-maker** - 旅行手册
   - 完整 HTML 旅行手册
   - 精美排版，支持打印
   - 整合所有规划内容
   - 可选 PDF 导出

## 项目结构

```
claude-roammate-v3/
├── .claude/
│   ├── skills/                    # 五个核心 skills
│   │   ├── destination-brief/
│   │   ├── local-reputation-research/
│   │   ├── itinerary-planner/
│   │   ├── map-route-builder/
│   │   └── guidebook-maker/
│   └── settings.json              # Claude Code 配置
├── TRAVEL/                        # 旅行产出物目录
│   └── {目的地}-{日期}/
│       ├── destination-brief.md
│       ├── reputation.md
│       ├── itinerary.md
│       ├── pois.json
│       ├── map.html
│       └── guidebook.html
├── CLAUDE.md                      # 项目说明文档
├── package.json                   # Node.js 依赖
└── README.md                      # 本文件
```

## 快速开始

### 前置要求

- Claude Code CLI 或 Desktop App
- Node.js (用于 PDF 生成，可选)
- 高德地图 API Key (可选)
- FlyAI API Key (可选)

### 使用方法

1. 在 Claude Code 中打开本项目目录

2. 使用主路由 skill 开始规划：
   ```
   /roammate-travel-concierge 广州出发，5月15日中午出发去西安游玩三天两夜，并返回广州。我和一个朋友共两人。
   ```

3. 系统会自动执行完整的五步流程：
   - 生成目的地简报
   - 进行口碑调研
   - 规划详细行程
   - 构建地图和路线
   - 生成旅行手册

4. 所有产出物保存在 `TRAVEL/{目的地}-{日期}/` 目录

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
- **pois.json** - 8 个景点的结构化数据（坐标、地址、电话、评分）
- **map.html** - 高德地图互动版本，标记所有景点和路线
- **guidebook.html** - 完整的旅行手册，可直接打印或分享

## 技术栈

- **Claude Code** - AI 驱动的开发环境
- **高德地图 API** - POI 搜索、地理编码、路线规划
- **FlyAI CLI** - 酒店搜索（飞猪数据源）
- **Web Search** - 口碑调研和实时信息
- **Playwright** - HTML 转 PDF（可选）

## 设计原则

- **简体中文优先** - 默认输出简体中文
- **不使用小红书 MCP** - 不爬取大众点评/马蜂窝/携程
- **不代替用户操作** - 不预订、付款或登录
- **降级友好** - 高德和 FlyAI 不可用时降级继续，标注估算
- **数据可信度标注** - 所有数据标注来源和可信度

## 注意事项

- 本项目专注于中国大陆旅行规划
- 需要配置高德地图和 FlyAI API 密钥以获得完整功能
- 价格、开放时间等信息可能波动，建议出行前核实
- 生成的旅行手册仅供参考，不构成专业旅行建议

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- 基于 [Claude Code](https://claude.ai/code) 构建
- 使用 [高德地图 API](https://lbs.amap.com/)
- 集成 [FlyAI](https://www.flyai.com/) 酒店搜索

---

🤖 Generated with Claude Sonnet 4.6
