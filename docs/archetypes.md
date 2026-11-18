# Creator archetypes ("buckets") — Dan's niche profiles for the girls

Dan (2026-09-18): the agency's girls each fit a niche identity; he wants reference creators per bucket so their content
funnels to the girls in that bucket. Design (agreed in chat): **folders stay formats** (what the video is) and **buckets are
creator profiles** — a name, the folders it pulls from (her `model.yaml → lanes`), and the reference creators who do it best
(her `sourcing/reels-sources.yaml → seed_accounts`, i.e. her 10 AM personal reels scout). Onboarding a girl = pick her
archetype → lanes + seed creators filled from it.

**Live since Nov 18, 2026 — `library/archetypes.yaml` is the source of truth** (Dan: "make sure we have seed creators and
versions for all of the girls and niches and constantly look for new as well"):
- `buckets:` name, lanes (first = primary folder), reference creators. On every boot each reference creator is seeded into the
  daily scout under the bucket's lanes (`bot.library_sources`, weight 1.1, `added_by archetype:…`).
- `girls:` the roster — key = her slug, its first part, or her first name — with `bucket`, optional `lanes` override and her own
  `references` ("inspirational pages": Madi → vivylue). `/model add` applies it: her `model.yaml → lanes` = the roster lanes and
  her `seed_accounts` = bucket references + her own; `/model refresh`, 🔁 Redo and the Sunday refresh keep those seeds
  (backlog N fixed). Girls not yet onboarded sit on the roster with lanes taken from their Content House lists.
- **Discovery** — after every scout, any creator whose video the judge kept (score ≥ 0.75) becomes a seed for that folder at
  weight 0.8 (`added_by discovered`) and is listed in #daily-report ("🧭 new creators the scout found today"); 👎 on her videos
  lowers the weight, below 0.3 the scout stops scanning her. Folders with fewer than 3 seed creators pull double hashtag results.
This file stays as the readable history (who Dan named, who is locked). Edit the yaml, not this table, to change behaviour.

Readability legend as in `docs/creator-list.md`: Readable = the logged-out scraper returns her reels · Locked = 18+ gate ·
Empty = public but no posts returned. Locked/Empty creators still belong to the bucket; they activate with the throwaway account.

## Buckets Dan named (2026-09-18) — filled in as he sends creators

| Bucket (Dan's words) | Lanes (folders it pulls from) | Reference creators (Dan) | Status |
|---|---|---|---|
| Car OF creator | car, hot-girl-filler | selenaxsteele (**Locked**, Indiana, "food & gaming luvr") · officiallykatierose (Readable, 22k, "friendly neighborhood redhead") · bbymorgz05 (from the earlier list) | readable ones on the `car` watch list |
| Versatile OF creator | most lanes (skits, funny, words-on-screen, personality, hot-girl-filler, collabs, transitions, pool, beach, gym-girl) | madi.ruve (Readable, 637k, underwater photography → scanned under beach) · juliafilippo_ (on skits + reference) · barbellinaa (Readable, 253k → gym-girl) · luluromanova_ (**Locked**, TX, Penthouse Pet) · bella.saintclaire (**Empty** — verified, no posts/counts returned) · xneleah (on personality) · daisymaylilly (Readable, 354k → personality) · krystalharperxo (Readable, 261k → hot-girl-filler) | readable ones on the watch list |
| Niche — pajama review creator | *(new format folder needed: Pajama Review — blocked by the 20-folder ceiling)* → meanwhile personality | — | waiting |
| Yapper OF creator | podcast-questions, long-form, personality, of-personality (bucket `yapper`) | fran.tills (Francesca — **Locked**) · taylorwatson (Readable, 1.3M, "lifestyle + yaps", conspiracy-theory talkers — Claude Nov 18) · juliafilippo_ | on the watch list |
| Words on screen OF creator | words-on-screen, skits | iamselinaamy (Selina Amy — Readable; long text-led "3 things about me" talking videos, modest numbers) · maddoxfaithwells (Maddox Wells — Readable, 6.4k, fitness/lifestyle) · davisamanda_ (already on words-on-screen from Dan's saves) · memequeen (4.4M **meme aggregator page**, not a creator — not added unless Dan insists) | readable creators on the watch list |
| Big boobs OF creator | big-boobs, hot-girl-filler, pool, beach | maliholt (**not found** as typed) · minaaaparkerx (**Locked**) · jadeella2.0 (Readable, 119k, second account of @jadejacobs.xo) · csmodeling_arizona (Cheyenne Swenson — **Locked**, "comedy, skits") · jokesonella (already on big-boobs) · alexisaevans (Readable, 1.12M, "Miami mama") · maddiepricelol (**Locked**, "FL car & gym girl") | readable ones on the big-boobs watch list |
| Personality / Skit OF creator | personality, skits, funny | whoispiperpresley2.0 (Piper Presley — Readable, 818k, comedian) · bblair.bear (on skits, learned from Dan's saves) | on the watch list |
| Petite school girl OF creator | *(Freshman (Just 18) folder drafted — ceiling)* → personality, hot-girl-filler; adults-only rule, zero tolerance | — | waiting |
| Petite / Personality creator | personality, hot-girl-filler | kim__jule (Readable, 339k, **Germany** — Dan listed her a second time, added; the judge still rejects non-US frames) · tessaa._x0 (Tessa Capri — Readable, 290k, "Florida girl") | on the hot-girl-filler watch list |
| Big booty OF creator | *(new format folder candidate: Big Booty — ceiling)* → gym-girl, hot-girl-filler, dance | emelyelikeslemonade (Readable, 677k, second account — main @emelyeender) | scanned under hot-girl-filler until a Big Booty folder exists |
| Young girl playful ditsy OF creator | hot-girl-filler, words-on-screen, personality, skits (bucket `young-playful`) | vivylue (Readable, 359k, "18", 8–15 s fit checks / sleepwear / text-on-screen — Dan Nov 18: "the cute girl young girl vibe", **for Madi**) | on the watch list; Madi's roster entry |
| Bikini gym OF creator | gym-girl, pool, beach, hot-girl-filler | leileiav (Leila Faler — **Locked**) | waiting for the throwaway |
| Niche content creator | personality, skits, funny, words-on-screen (quirky-persona creators) | treena_berry_ (Readable, on skits; Dan typed "treena_berry") · georgieanderson__ (Readable, 12.7k, "girl mom · single mom life · outfits" — two underscores; the one-underscore account is an 888-follower stranger; kids-in-frame rule applies) · kateluxxe (on funny) · crexmpiechloexx (**Locked**) · emlouisecutie (Readable, 1.07M) · kyliebelle0 (Kylie Belle — **Locked**, "19") · sydneycolettee (Readable, on personality; Dan moved her here from the young-girl label) · tru.kait (Kaitlin Trujillo — Readable, 2.4M, heritage flags 🇲🇽🏴󠁧󠁢󠁳󠁣󠁴󠁿🇪🇸 in bio; judge decides per video) | readable ones on the watch list |
| Soft existing OF creator / girl next door | personality, hot-girl-filler, words-on-screen, funny, collabs (bucket `girl-next-door`) | kyla.doddsss (Readable, 593k — Dan Nov 18: "lifestyle normal cute girl content and she just happens to have an OF… not super sexualized… a really good blend"; also a reference creator for the judge; "sprinkled into girls' content options" = her folders are the girls' lanes) | on the watch list + reference |

## How Claude applies a bucket by hand during the tuning window
1. Check each creator (readable / locked / empty) and log her in `docs/creator-list.md`.
2. Readable creators → `bot.library_sources` under the bucket's **primary** folder (one row; the judge spreads videos with `also` tags).
3. When a girl is assigned a bucket: `/model lanes slug: lanes:<bucket lanes>` (restart) and add the bucket's creators to her
   `models/<slug>/sourcing/reels-sources.yaml → seed_accounts` (restart; note backlog N — the weekly refresh overwrites this file).

## Nov 18, 2026 — seed review by Claude (Dan: "review Instagram and start dropping relevant content into all of these niches")
Hashtag pages for golf / dance / transitions were ~90 % non-US, men or families, so seeds came from creators the judge had
already kept plus a profile check (US, English, solo girl or girls, video-first). Added to `bot.library_sources`:
golf → golfwithquinn (10k, "golf gal — kinda funny, kinda hot"), jennnbellee (453k, bev-cart girl), clairehogle (996k),
carmellacuts (51k, San Diego, +7 hcp — more sport than tease, 0.9) · dance → ayiahsoufi (240k, LA singer-dancer),
the.madison.b (ex-NBA dancer, choreo groups) · transitions → onlyonealiya (747k, makeup/outfit transitions, bikini brand),
kerina.wang (2M, outfit reveals, 0.9) · podcast-questions → taylorwatson, da_rozie (street-interview channel, 0.8 — a male
interviewer would fail the judge) · collabs → burchtwins (327k identical twins), rissandlou (two moms, friendship humor, 0.9),
summerxiris (4.1M "ur gamer girlfriend", also beach + filler) · words-on-screen / hot-girl-filler → alesalaslopez (1.1M, "rate
this on me" questions), neonrose.official (521k, "rate my date outfit"). Rejected on the country rule: cantomalu (🇧🇷),
brookeandjess / glambyflo / jocelynmeiere (UK), lauraelizabe.th (Sydney), fayelouise_brennan (Dublin), crissy_brat (Taiwan),
the.moretti (IT/PT captions), mollye.sleepwear (Vietnam brand); not a fit: skatemoss (pottery/e-bikes), elinasinz (pro golfer,
photos), lizzigreer, hannahbleiner, christyonthecourse (photos, low numbers), callursister (brother on camera, kids),
yourbestinternetfriends (128 followers), nikkiraeunplugged (mental-health content), bagstie_la (reseller ads).
Seasonal hashtags until Dec 26 (`added_by seasonal:christmas-2026`): #santababy #christmasoutfit (hot-girl-filler),
#matchingpajamas (collabs), #christmasbaking (trad-wife), #christmasgrwm (personality) — delete them after Christmas.
