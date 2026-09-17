# models/

One folder per model. The folder name is the slug used everywhere (`/caption model:amari`, custom ids, DB rows).

```
models/<slug>/
├─ model.yaml                 ids, handles, timezone, thresholds — everything non-voice
├─ notes.md                   private staff context for the persona
├─ voice/
│  ├─ voice.md                HOW SHE WRITES — the anti-slop file. Fill it with her, by hand.
│  ├─ caption-examples.md     her real captions (imported) + hand-picked + bot-era approved (auto-appended)
│  ├─ hooks.md                openers that worked
│  └─ banned-phrases.md       her personal never-say list (+ "allow:" overrides of the global list)
├─ sourcing/
│  └─ reels-sources.yaml      seed accounts / hashtags the daily Apify scout uses for her
└─ playbooks/                 links or copies of the guides she's been given
```

`_template/` is the starting point (`npm run new-model -- <slug> "Display Name" ABC`). Folders starting with `_` or `.` are ignored by the loader.

Nothing in here is optional for captions to sound like her: an empty `voice.md` = generic captions. Budget 20 minutes per model with Dan/Marissa to fill it, then let `import-captions` and the approve/edit loop do the rest.
