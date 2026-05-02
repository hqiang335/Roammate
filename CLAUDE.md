# Roammate Travel Concierge v3

中国大陆旅行规划助手，提供目的地简报、口碑调研、行程规划、地图路线和旅行手册。

## Skills

项目级 skills 位于 `.claude/skills/`，通过 `/roammate-travel-concierge` 触发主路由。

| Skill | 触发场景 |
| --- | --- |
| `roammate-travel-concierge` | 主路由，协调所有子 skill |
| `destination-brief` | 目的地概览、最佳季节 |
| `local-reputation-research` | 口碑调研、避坑、值不值得去 |
| `itinerary-planner` | 多日行程、家庭出行、自驾、预算 |
| `map-route-builder` | POI 规范化、路线图、高德、FlyAI 酒店 |
| `guidebook-maker` | HTML/PDF 旅行手册 |

## 工具与 API

- **高德地图 MCP**：`amap_maps` 服务器，自动注入 `AMAP_MAPS_API_KEY`
- **高德 Web JS API**：`AMAP_WEB_JS_API_KEY`，用于 `map.html` 前端渲染
- **FlyAI CLI**：`FLYAI_API_KEY`，用于酒店搜索

## 输出目录

旅行产出物写入 `TRAVEL/{目的地}-{日期}/`。

## 规则

- 默认简体中文输出
- 不使用小红书 MCP，不爬取大众点评/马蜂窝/携程
- 不代替用户预订、付款或登录
- 高德和 FlyAI 不可用时降级继续，标注估算
