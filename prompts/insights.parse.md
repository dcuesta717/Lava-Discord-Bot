The image is a screenshot of Instagram's **Insights → Overview** screen (mobile app). Extract the numbers exactly as displayed. Do not estimate, do not compute anything that is not shown.

Return ONLY a JSON object with these keys (use null when the value is not visible):

```json
{
  "date_range_text": "the date range label shown, e.g. '7 days' or 'Sep 1 - Sep 7'",
  "views": 1660613,
  "net_followers": 7084,
  "interactions": 68973,
  "pct_followers": 8.3,
  "pct_non_followers": 91.7,
  "viewers": 543960,
  "reels_views": 1200000,
  "posts_views": 290000,
  "stories_views": 168000,
  "live_views": 0,
  "confidence": 0.95,
  "notes": "anything odd: cropped, wrong tab, wrong date range, not an Insights screenshot"
}
```

Rules:
- Numbers with K/M suffixes: convert (1.2M → 1200000, 290K → 290000).
- Strip commas and '+' signs.
- If the screenshot is not an Instagram Insights Overview screen, set confidence to 0 and explain in notes.
- Percentages: numbers only (8.3, not "8.3%").
