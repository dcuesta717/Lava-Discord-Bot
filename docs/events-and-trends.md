# Events & trend radar

Dan: "Our systems need to be very intelligent on upcoming events, upcoming holidays, anything that can be used to ride social or viral trends. On Memorial Day they need video ideas for that specific thing — five or six at a time. The bot also needs to scrape what is trending in the last 24 hours."

## Events → ideas (`modules/events`)

- **Calendar:** `knowledge/events.yaml` — recurring moments with a `date` (MM-DD) or a `rule` (nth weekday of a month, e.g. last Monday of May), a `lead_days`, optional `lanes` (only girls in those folders), and an `angle` (what the moment means for *our* content — fed to the generator verbatim). One-offs from Discord: `/event add name: date: angle: lanes: lead_days:` (stored in `bot.events`).
- **07:30 daily:** every event inside its lead window → every eligible model who hasn't received ideas for this occurrence gets `ideas` (default 5) in her `#💬-general-chat`: title, hook, what to film, text on screen, a caption in her voice, why men comment. Generated from her `profile.md` + `voice/voice.md` by `prompts/event.ideas.md`. Owners see a one-liner in `#daily-report`. Sent once per model per occurrence (`bot.event_ideas`).
- `/event list` — next 45 days, when ideas go out, who already got them. `/event ideas name: [model] [again]` — send now.

Tuning: the `angle` lines are the lever. A bad angle = generic ideas. Lead days: 10 for most, 21 for Halloween/Christmas (costumes and gifts need prep), 5-7 for one-day jokes.

## Trend radar (in `modules/library`, runs right after the 7 AM scout)

- Every scout run tallies the **audio** and **hashtags** of *all* candidate reels it looked at (not just the ones it posted) into `bot.trend_signals` per day and genre.
- A signal is **trending** when today's count ≥ 4 and ≥ 3× its average over the previous 7 days. Seed hashtags from `genres.yaml` are ignored (they are everywhere by design).
- Up to 3 alerts per day, once per signal per 14 days (`bot.trend_alerts`): posted in `#agency-lounge` (all girls) and `#daily-report` — what it is, how to ride it this week (`prompts/trend.alert.md`), and a sample reel.

Signal quality grows with the number of seed accounts/hashtags the scout scans; with the defaults it sees ~1 000 reels/day. External sources (a TikTok-trends or Google-Trends Apify actor) can be added later as extra rows in `trend_signals` — the radar does not care where a signal comes from.
