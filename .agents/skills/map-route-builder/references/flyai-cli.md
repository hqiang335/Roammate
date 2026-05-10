# FlyAI CLI Reference

Use FlyAI CLI as a first-choice source for covered booking-market facts and a supplemental source for semantic trip advice. For hotels, FlyAI provides inventory, price, brand, star, and booking-market links; Quark public web evidence decides whether the area, tier, and candidate quality fit the trip.

## Use Cases

- Search flights and trains between origin and destination.
- Search hotels near a destination or core POI.
- Search Marriott hotels or packages when the user prefers Marriott or premium hotel packages.
- Search attraction listings, ticket products, tours, and packages.
- Use semantic search for scenic tips, preparation, play time, reservation friction, queues, family suitability, and package ideas.
- Get rough price and availability reference.
- Compare areas for families, older adults, or transit convenience.

## Command Shapes

```bash
flyai search-flight --origin "{出发地}" --destination "{目的地}" --dep-date YYYY-MM-DD --sort-type 3
flyai search-train --origin "{出发地}" --destination "{目的地}" --dep-date YYYY-MM-DD --sort-type 4
flyai search-hotel --dest-name "{城市或目的地}" --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-hotel --dest-name "{城市}" --poi-name "{景点}" --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-hotel --dest-name "{城市}" --poi-name "{区域或景点}" --hotel-stars 4,5 --sort rate_desc --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-hotel --dest-name "{城市}" --key-words "{区域/商圈/地铁站/酒店名}" --hotel-types hotel --sort distance_asc --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-hotel --dest-name "{城市}" --poi-name "{区域或景点}" --hotel-types homestay,inn --max-price 800 --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-hotel --dest-name "{城市}" --poi-name "{区域或景点}" --hotel-bed-types twin,multi --sort rate_desc --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
flyai search-poi --city-name "{城市}" --keyword "{景点关键词}"
flyai keyword-search --query "{景点} 门票 预订 套餐"
flyai ai-search --query "{景点} 游玩须知 准备材料 避雷 排队 预约 游玩时长 适合小孩"
flyai search-marriott-hotel --dest-name "{城市}" --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD --sort price_asc
flyai search-marriott-package --keyword "{城市} 万豪 套餐" --sort-type price_asc
```

The CLI reads `FLYAI_API_KEY` from the environment or from `~/.flyai/config.json` after running:

```bash
flyai config set FLYAI_API_KEY "{key}"
```

## Rules

- Treat output as price reference, not guaranteed final booking price.
- Do not book or submit forms.
- Run date-specific booking commands (`search-flight`, `search-train`, `search-hotel`, `search-marriott-hotel`, date-specific package/price queries) with the user's exact dates when provided.
- For month-only, season-only, holiday-window, or vague-date requests, choose representative dates that match the requested duration, run booking commands normally, and label prices/inventory as representative-date sample data.
- Dedicated commands are preferred for flights, trains, hotels, POIs, and Marriott hotels.
- For hotels, run targeted queries after Quark identifies suitable stay areas and tiers. Use `--poi-name`, `--key-words`, `--hotel-types`, `--hotel-stars`, `--max-price`, `--sort rate_desc`, and `--sort distance_asc` instead of accepting an unfiltered cheapest list.
- `search-hotel` has no `--max-results` option. Do not add unsupported flags; use several targeted queries and de-duplicate results instead.
- Preserve `detailUrl` or `jumpUrl` as the Feizhu link for every accepted hotel candidate. Preserve the returned price as a volatile booking-market sample. Preserve room type only if FlyAI returns a real room/bed field; otherwise write `FlyAI未返回具体房型，需点击飞猪链接确认` and do not invent a room name.
- Use `ai-search` for qualitative travel guidance, not as sole proof for official facts, exact prices, or numeric ratings.
- `keyword-search` can surface tickets, tours, packages, and product links, but prices may be missing; mark as search reference.
- For restaurants, FlyAI is unreliable for detailed reviews; use Amap around search plus web sentiment instead.
- If FlyAI is unavailable or returns empty/504, provide structure-level guidance and say the booking-market query failed.
- Always mark prices, availability, ticket policy, and package contents as volatile.
