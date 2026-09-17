# Agent: onboard a model

**Input:** slug, display name, IG/TikTok handles, her Discord user id, Drive folder id, Zernio account ids.
**Output:** `models/<slug>/` fully filled, her Discord category created, first captions approved.

1. `npm run new-model -- <slug> "<Display Name>" <ABC>`; fill `model.yaml` handles/timezone.
2. `npm run setup-server -- <slug> <user_id>` → paste the printed ids into `model.yaml`.
3. `npm run import-captions -- <slug>` → note the stats line (median length, hashtag %, emoji %, lowercase %) and set `caption.*` in `model.yaml` to match. If lowercase % < 60, set `lowercase: false`.
4. Draft `voice/voice.md` **from her imported captions**, not from imagination:
   - Read all imported captions. Quote 5 that best show her voice into the "PERFECT examples" section.
   - Fill "How she actually types" with observed facts (count them: periods, emoji, hashtags, caps).
   - List slang she uses (≥3 occurrences) and slang she never uses.
   - Ask Dan/Marissa for the "3 captions she hated" — this is the fastest signal.
5. Fill `voice/hooks.md` from her top-10 by views: first 3 words of each.
6. Fill `sourcing/reels-sources.yaml` with 5–10 seed accounts in her lane (ask her; she knows who she watches).
7. Run `/caption model:<slug> brief:"<one of her recent posts>"` three times; have Dan/Marissa pick or edit. Edited versions land in caption-examples.md automatically.
8. Post the welcome message in her #general (persona will handle it if you @mention the bot with "say hi to <name> and explain the commands").
9. Commit `models/<slug>/`. Run `/graphify .` if installed.
