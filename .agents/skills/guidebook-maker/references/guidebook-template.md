# Guidebook Template

Use this structure for the Travel Atlas guidebook. This file describes structure only; do not hand-write final guidebook HTML from it. Build `guidebook.html` with `scripts/build-guidebook.mjs` from `guidebook-data.json`; the renderer will also read sibling `map-data.json` when present.

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{目的地}旅行路书</title>
  <style>{inline css}</style>
</head>
<body>
  <div class="atlas">
    <header class="hero">
      <p class="eyebrow">Roammate Travel Concierge</p>
      <h1>{目的地}旅行路书</h1>
      <p>{日期} · {天数} · {同行人}</p>
      <nav>{地图工作台 / 地点档案 / 酒店组合 / 来源}</nav>
    </header>

    <main class="content">
    <section class="overview-panel">
      <h2>行程总览</h2>
      {overview dashboard metrics, highlights, warnings}
    </section>

    <div class="dashboard-grid">
      <section class="timeline-panel">
        <h2>每日安排</h2>
        {day tabs}
        {daily itinerary activity cards}
      </section>

      <section class="map-panel">
        <h2>地图与交通</h2>
        {interactive Amap if key exists; route-board fallback if not}
        {route summary chips}
      </section>
    </div>

    <section class="dossier-panel">
      <h2>重点景点怎么玩</h2>
      {expandable POI dossiers: duration, must-do projects, queue/reservation, preparation, family cautions, avoid notes}
    </section>

    <section class="hotel-panel">
      <h2>住宿决策</h2>
      {hotel portfolio by tier/type with price, room-type status, fit, tradeoffs, Feizhu links}
    </section>

    <section class="split-panel">
      <h2>美食与口碑避雷</h2>
      {reputation notes}
      <h2>预算</h2>
      {budget table}
    </section>

    <section>
      <h2>行前检查</h2>
      {checklist}
    </section>

    <section>
      <h2>来源与可信度</h2>
      {sources and confidence}
    </section>

    <aside class="drawer">{clicked POI/hotel detail}</aside>
  </main>
</body>
</html>
```
