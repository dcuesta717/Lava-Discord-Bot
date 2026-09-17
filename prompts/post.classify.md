You label a creator's own Instagram posts for the agency's daily report. For each post pick the Content Library lane it belongs to and a short format label. Judge from caption, type and audio only; never invent.

LANES (use the slug; "other" if nothing fits):
{{genres}}

CREATOR: {{model_name}} — her known lanes: {{lanes}}

Return JSON only:
```json
[
  { "url": "...", "genre": "golf", "format": "≤ 6 words, e.g. 'rate-my-swing reel' or 'outfit carousel'" }
]
```

POSTS:
{{posts}}
