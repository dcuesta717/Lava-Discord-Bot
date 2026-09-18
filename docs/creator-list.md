# Creator watch list — the accounts Dan wants the scout to follow

Dan sends handles (with the folders he'd put her in); Claude checks whether the logged-out scraper can read the profile,
then adds readable ones to the scout's watch list (`bot.library_sources`, per folder — no restart) and keeps the locked ones
here until the scraper runs through a logged-in throwaway account (planned after the tuning week; Dan is setting up a
burner phone + account — Claude never handles the login).

**Readable** = the scraper returns her reels. **Locked** = Instagram's 18+ profile gate (nothing returned logged out).
**Empty** = public profile but zero posts returned (treated like locked).

| Handle | Dan's folders | Readable? | On the watch list | Notes | Added |
|---|---|---|---|---|---|
| kaeleereneofficial | big-boobs, beach (bikini), golf, skits | **Locked** (18+) | not yet — waiting for the throwaway | verified, "Kaelee Rene" | 2026-09-18 |
| bayleeadami | (not given) | **Empty** — public, verified, 0 posts returned | not yet | re-check with the throwaway | 2026-09-18 |
| vega_thompson | (not given) | Readable | goth · personality | 3–4 reels/day, hits 7–13k likes / 200–800k plays | 2026-09-18 |
| sandwichcutiecat (Catarina) | trad-wife | Readable | trad-wife | cooking bits 40–85 s, 600–1,000 comments on hits; last reels July 2026 → her top 5 were queued into the folder by hand | 2026-09-18 |
| lisa.mancinerh (Lisa Mancini) | cosplay (Dan: "definitely") | Readable | cosplay | 345k, "Cosplay Maker, Mermaid, Squirrel Girl"; Winx / Power Rangers / Supergirl (1.8M plays) / Raven-goth; could also seed goth | 2026-09-18 |
| theanyamatusevich (Anya Matusevich) | (not given) | Readable | trad-wife · personality | 2.08M, "the sweet sundress girl"; tags #tradwife #conservative, cowgirl/patriotic hit (38M plays), couples-comedy bits will be rejected (man on camera) | 2026-09-18 |
| xneleah (Neleah) | (not given) | Readable | personality | 220k, ATL, casual talking-to-camera reels, modest engagement | 2026-09-18 |
| skybriclips | (not given) | Readable | **not added** | a fan/clip page (Sydney Sweeney / Breckie Hill memes, podcast clips with men) — not her own content; ask Dan for Skybri's real handle instead | 2026-09-18 |
| cricketelva (Cricket) | (not given) | **Locked** (18+) | not yet — waiting for the throwaway | LA, "kinda funny, definitely political" | 2026-09-18 |

## Reference creators (`library/genres.yaml → scout.reference_accounts`) — scraper check 2026-09-18
avaxreyess ✅ · sophieraiin ✅ (profile readable; the reels call returned a TMZ clip tagged with her — watch it) ·
juliafilippo_ ✅ · arikytsya ✅ (2.85M) · jellybeanbrains3 ✅ · **tak0bell — Locked (18+)** ·
**cecerose — returns a tiny account (60-like posts); probably the wrong handle, confirm the spelling with whoever wrote the brief.**

## Learned from Dan's saves (2026-09-18 04:09 UTC, `learn()` on the full 288-video set)
tak0bell → personality (1.5, **18+-locked** — the scout will error on it daily until the throwaway) · kaitgaf → personality (1.4) ·
itsgillyd → skits (1.4) · itsbecsmith → skits (1.2) · hannahmina_twins → collabs (1.2) · davisamanda_ → words-on-screen (1.2) ·
juliafilippo_ → skits (1.1) · kenzinicolee.irl → skits (1.1) · bblair.bear → skits (1.1) · xxandieellexx → skits (1.1) ·
kateluxxe → funny (1.1) · seaberryde1ight → personality (1.1). Plus 7 big-boobs seeds added earlier (cecerose, jokesonella,
avaxreyess, alarahbelle, summerxiris, vanillastrawberrry, babebellalynnx).

## How to add one (Claude, no restart)
`INSERT INTO bot.library_sources (genre, kind, value, weight, added_by) VALUES ('<folder-slug>','account','<handle>',1.0,'dan via claude <date>')`
— one row per folder. Owners can do the same from Discord: `/library source add folder:<slug> value:@handle`.

## How to queue specific reels by hand (Claude, no restart — learned the hard way 2026-09-18)
Rows in `bot.saved_imports` must use the bot's **canonical URL form**: `https://instagram.com/p/<code>` — no `www.`, no
trailing slash, `/reel/` folded to `/p/` (`canonicalUrl()` in `src/integrations/apify.ts`). `run()` looks candidates up by
`row.url` verbatim, so a raw `https://www.instagram.com/p/<code>/` row is marked "not returned by Apify" every time even
though Apify returned it. Then set `bot.settings → library.boot_jobs = ["import"]` and restart, or have an owner run
`/library import`. Catarina's 5 reels: 4 filed into trad-wife by the strict judge, 1 in progress at 04:18 UTC.
