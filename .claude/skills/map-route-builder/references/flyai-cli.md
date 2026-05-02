# FlyAI CLI Reference

Use FlyAI CLI as an optional hotel research enhancement.

## Use Cases

- Search hotels near a destination or core POI.
- Get rough price and availability reference.
- Compare areas for families, older adults, or transit convenience.

## Suggested Command Shape

```bash
flyai search-hotel --dest-name "{城市或目的地}" --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
```

If the CLI supports a POI parameter in the current environment, add it only after confirming the command help:

```bash
flyai search-hotel --dest-name "{城市}" --poi-name "{景点}" --check-in-date YYYY-MM-DD --check-out-date YYYY-MM-DD
```

The CLI reads `FLYAI_API_KEY` from the environment or from `~/.flyai/config.json` after running:

```bash
flyai config set FLYAI_API_KEY "{key}"
```

## Rules

- Treat output as price reference, not guaranteed final booking price.
- Do not book or submit forms.
- If FlyAI is unavailable, provide hotel area guidance and suggest manual checking on Fliggy/Ctrip/Trip.com.
- Always mark hotel prices as volatile.
