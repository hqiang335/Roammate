---
name: itinerary-planner
description: Plan mainland China multi-day trips with daily themes, timelines, transport, meals, budgets, reservation reminders, backup plans, and feasibility checks for families, older adults, self-driving, rail, and mixed travel.
---

# Itinerary Planner

Use this nested skill for day-by-day travel planning.

## Workflow

1. Parse destination, dates, duration, origin, transport mode, travelers, budget, interests, pace, and required outputs.
2. If the user has not provided destination context, use `../destination-brief/SKILL.md`.
3. If POI fit or reputation matters, use `../local-reputation-research/SKILL.md`.
4. Read `references/itinerary-rules.md`.
5. Build the itinerary around geography, opening hours, reservations, meals, and physical effort.
6. Run `scripts/validate_itinerary.py` when a JSON draft is available.
7. Revise any day that is too dense, physically unrealistic, or missing key constraints.

## Output

```markdown
# {目的地}{天数}行程

## 行程参数
- 日期：
- 出发地：
- 同行人：
- 交通方式：
- 预算：
- 节奏：

## 总体安排
| 天数 | 主题 | 区域 | 强度 | 重点提醒 |
| --- | --- | --- | --- | --- |

## 每日行程
### Day 1 · {主题}
| 时间 | 安排 | 交通 | 费用 | 备注 |
| --- | --- | --- | --- | --- |

今日餐食：
预算估算：
预约提醒：
雨天/疲劳备用：

## 预算汇总
| 项目 | 经济 | 舒适 | 备注 |
| --- | --- | --- | --- |

## 出行前检查
- 预约：
- 证件：
- 装备：
- APP：

## 来源与可信度
- Research conducted: {YYYY-MM-DD}
- 可能波动：
```

## Rules

- Each normal sightseeing day should have 3-5 activities, fewer for older adults, children, heat, rain, or high-altitude routes.
- Mark all volatile facts: prices, opening hours, reservation policy, traffic duration, weather.
- Do not auto-book anything.
- If Amap data is unavailable, use approximate distance/time and mark it with `约`.
