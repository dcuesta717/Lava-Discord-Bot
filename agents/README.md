# agents/

Playbooks for work that runs on a schedule or as a Claude Code / Cowork task rather than inside the bot process.
Each file is a self-contained instruction set: what to read, what to produce, where to put it.

| Playbook | Runs | Purpose |
|---|---|---|
| `onboard-model.md` | once per model, by a human + Claude Code | Create folder, import captions, draft voice.md from her real posts, set caption budgets |
| `reels-scout.md` | daily (bot cron does the fetch; this is the manual/deep version) | Pull candidates, classify, post to boards, prune stale |
| `weekly-report.md` | Monday, after insights come in | Per-model + agency summary for Dan/Marissa |
| `voice-audit.md` | monthly | Re-score last 30 approved captions vs her real posts; tighten voice.md and banned lists |
