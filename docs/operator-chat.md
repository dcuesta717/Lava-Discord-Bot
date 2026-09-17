# Operator chat — owners just talk to the bot

Dan: "it would be nice for the owners to say 'hey @lavabot we're onboarding a new girl' and literally just chat with it."

**How:** in any staff channel (`#bot-dev`, `#daily-report`, anywhere that isn't a girl's private channel) an owner @mentions **Lava Bot**, replies to one of its messages, or DMs it. The bot answers in plain language and *runs things*.

```
Dan:  @Lava Bot we're onboarding a new girl, Jane Doe, that's @jane, IG is janedoe
Bot:  Onboarding **Jane Doe** — <@…>, IG @janedoe, no TikTok, New York time. Go?
Dan:  go
Bot:  on it — onboard model…
      ⏳ 1/3 building Jane Doe's private channels… ⏳ 2/3 researching @janedoe… ⏳ 3/3 writing models/jane-doe/ to GitHub…
      ✅ Jane Doe onboarded → models/jane-doe/ committed … lanes: golf (90%), words-on-screen (60%) …
Dan:  @Lava Bot what's coming up on the calendar?
Bot:  Halloween — Oct 31 (44d), ideas go out in 23d · Thanksgiving — Nov 26 …
Dan:  @Lava Bot add "Miami Swim Week" on 2027-05-28, beach/pool girls, angle: runway fits + hotel pool content
Bot:  added Miami Swim Week on 2027-05-28; ideas go out 7 days before to beach, pool
Dan:  @Lava Bot I'm off today, cover for me
Bot:  away-reply is on, covering for Dan
```

## What it can do (the actions)

Every module registers its capabilities with `ctx.action(name, {...})`; the operator exposes all of them to Claude as tools, so **adding a capability once makes it available in chat**. Today:

| action | does |
|---|---|
| `onboard_model` | full onboarding (channels → research → GitHub commit). Confirms once first. |
| `list_models`, `set_model_lanes` | who is onboarded; change a girl's folders |
| `run_library_scout`, `send_library_picks`, `add_library_source`, `add_library_video`, `library_stats` | the Content Library |
| `list_events`, `add_event`, `send_event_ideas` | the calendar |
| `daily_report` | today's numbers (owners' digest or one girl), optionally re-scraped |
| `set_away_mode` | on / auto / off, delay, whose absence |
| `list_owners` | who counts as an owner |

Slow actions (onboarding, scouting) get an "on it…" reply first and progress lines while they run. Everything the chat runs is logged in `#ops-log` (`operator ran`).

## Rules
- Owners only. A creator who @mentions the bot in a staff channel is pointed back to her channel.
- Never invents numbers; says what it can't do (read personal DMs, post to IG, move money, change owners).
- The persona (girls' channels) and the away-reply are separate brains with separate rules; this one is the ops brain.

## Adding an action
In any module: `ctx.action('do_thing', { description, input: <JSON schema>, ownersOnly, slow, run: async (input, actor) => 'result text' })`. Keep `description` explicit about when to use it and what it needs — that text is what Claude reads to decide.
