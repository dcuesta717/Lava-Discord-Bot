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

## Reference creators (`library/genres.yaml → scout.reference_accounts`) — scraper check 2026-09-18
avaxreyess ✅ · sophieraiin ✅ (profile readable; the reels call returned a TMZ clip tagged with her — watch it) ·
juliafilippo_ ✅ · arikytsya ✅ (2.85M) · jellybeanbrains3 ✅ · **tak0bell — Locked (18+)** ·
**cecerose — returns a tiny account (60-like posts); probably the wrong handle, confirm the spelling with whoever wrote the brief.**

## Learned from Dan's saves (2026-09-18, `learn()`)
itsbecsmith → skits (1.2) · juliafilippo_ → skits (1.1) · hannahmina_twins → collabs (1.1)

## How to add one (Claude, no restart)
`INSERT INTO bot.library_sources (genre, kind, value, weight, added_by) VALUES ('<folder-slug>','account','<handle>',1.0,'dan via claude <date>')`
— one row per folder. Owners can do the same from Discord: `/library source add folder:<slug> value:@handle`.
