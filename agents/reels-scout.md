# Agent: reels scout (deep pass)

The bot's daily cron does a shallow pass (Apify → classify → board). Run this weekly with Claude Code for a deeper pass per model.

1. Read `models/<slug>/voice/voice.md` and `sourcing/reels-sources.yaml`.
2. Run the Apify actors with 3× the usual `results_per_query`, last 7 days only.
3. For each candidate: fetch the thumbnail; if the actor provides a transcript/caption use it. Classify with `prompts/reels.classify.md`.
4. Post only the top 10 by score to her board (`/reel model:<slug> url:<...>`), spread across categories — never 10 Fillers.
5. Prune: any board reel older than 14 days with status `new` → mark `skipped` in the DB and note it in #ops-log.
6. Update `sourcing/reels-sources.yaml`: add seed accounts that produced ≥2 keepers; drop ones that produced none in 3 runs.
