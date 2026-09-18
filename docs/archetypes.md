# Creator archetypes ("buckets") — Dan's niche profiles for the girls

Dan (2026-09-18): the agency's girls each fit a niche identity; he wants reference creators per bucket so their content
funnels to the girls in that bucket. Design (agreed in chat): **folders stay formats** (what the video is) and **buckets are
creator profiles** — a name, the folders it pulls from (her `model.yaml → lanes`), and the reference creators who do it best
(her `sourcing/reels-sources.yaml → seed_accounts`, i.e. her 10 AM personal reels scout). Onboarding a girl = pick her
archetype → lanes + seed creators filled from it. The archetype feature itself is post-tuning-window code
(`library/archetypes.yaml` + `/model archetype`); until then this file is the source of truth and Claude applies it by hand.

Readability legend as in `docs/creator-list.md`: Readable = the logged-out scraper returns her reels · Locked = 18+ gate ·
Empty = public but no posts returned. Locked/Empty creators still belong to the bucket; they activate with the throwaway account.

## Buckets Dan named (2026-09-18) — filled in as he sends creators

| Bucket (Dan's words) | Lanes (folders it pulls from) | Reference creators (Dan) | Status |
|---|---|---|---|
| Car OF creator | car, hot-girl-filler | selenaxsteele (**Locked**, Indiana, "food & gaming luvr") · officiallykatierose (Readable, 22k, "friendly neighborhood redhead") · bbymorgz05 (from the earlier list) | readable ones on the `car` watch list |
| Versatile OF creator | most lanes (skits, funny, words-on-screen, personality, hot-girl-filler, collabs, transitions, pool, beach, gym-girl) | madi.ruve (Readable, 637k, underwater photography → scanned under beach) · juliafilippo_ (on skits + reference) · barbellinaa (Readable, 253k → gym-girl) · luluromanova_ (**Locked**, TX, Penthouse Pet) · bella.saintclaire (**Empty** — verified, no posts/counts returned) · xneleah (on personality) · daisymaylilly (Readable, 354k → personality) · krystalharperxo (Readable, 261k → hot-girl-filler) | readable ones on the watch list |
| Niche — pajama review creator | *(new format folder needed: Pajama Review — blocked by the 20-folder ceiling)* → meanwhile personality | — | waiting |
| Yapper OF creator | personality, podcast-questions, of-personality | fran.tills (Francesca — **Locked**) | waiting for the throwaway |
| Words on screen OF creator | words-on-screen, skits | iamselinaamy (Selina Amy — Readable; long text-led "3 things about me" talking videos, modest numbers) | on the words-on-screen watch list |
| Big boobs OF creator | big-boobs, hot-girl-filler, pool, beach | maliholt (**not found** as typed) · minaaaparkerx (**Locked**) · jadeella2.0 (Readable, 119k, second account of @jadejacobs.xo) · csmodeling_arizona (Cheyenne Swenson — **Locked**, "comedy, skits") · jokesonella (already on big-boobs) · alexisaevans (Readable, 1.12M, "Miami mama") · maddiepricelol (**Locked**, "FL car & gym girl") | readable ones on the big-boobs watch list |
| Personality / Skit OF creator | personality, skits, funny | whoispiperpresley2.0 (Piper Presley — Readable, 818k, comedian) · bblair.bear (on skits, learned from Dan's saves) | on the watch list |
| Petite school girl OF creator | *(Freshman (Just 18) folder drafted — ceiling)* → personality, hot-girl-filler; adults-only rule, zero tolerance | — | waiting |
| Petite / Personality creator | personality, hot-girl-filler | kim__jule (Readable, 339k, **Germany** — Dan listed her a second time, added; the judge still rejects non-US frames) · tessaa._x0 (Tessa Capri — Readable, 290k, "Florida girl") | on the hot-girl-filler watch list |
| Big booty OF creator | *(new format folder candidate: Big Booty — ceiling)* → gym-girl, hot-girl-filler, dance | emelyelikeslemonade (Readable, 677k, second account — main @emelyeender) | scanned under hot-girl-filler until a Big Booty folder exists |
| Young girl playful ditsy OF creator | *(Freshman (Just 18) — ceiling)* → funny, personality; adults only | — | waiting |
| Bikini gym OF creator | gym-girl, pool, beach, hot-girl-filler | — | waiting |
| Niche content creator | personality, skits, funny, words-on-screen (quirky-persona creators) | treena_berry_ (Readable, on skits; Dan typed "treena_berry") · georgieanderson__ (Readable, 12.7k, "girl mom · single mom life · outfits" — two underscores; the one-underscore account is an 888-follower stranger; kids-in-frame rule applies) · kateluxxe (on funny) · crexmpiechloexx (**Locked**) · emlouisecutie (Readable, 1.07M) · kyliebelle0 (Kylie Belle — **Locked**, "19") | readable ones on the watch list |
| Soft existing OF creator | *(Girl Next Door / Soft Girl folder drafted — ceiling)* → personality, words-on-screen | — | waiting |

## How Claude applies a bucket by hand during the tuning window
1. Check each creator (readable / locked / empty) and log her in `docs/creator-list.md`.
2. Readable creators → `bot.library_sources` under the bucket's **primary** folder (one row; the judge spreads videos with `also` tags).
3. When a girl is assigned a bucket: `/model lanes slug: lanes:<bucket lanes>` (restart) and add the bucket's creators to her
   `models/<slug>/sourcing/reels-sources.yaml → seed_accounts` (restart; note backlog N — the weekly refresh overwrites this file).
