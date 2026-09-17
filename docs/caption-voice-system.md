# Caption voice system — how captions don't sound like AI

The problem is not the model, it's the inputs. A caption prompt with no examples produces "✨ living my best life ✨". The fix is five layers, all in this repo:

## 1. Per-model voice files (`models/<slug>/voice/`)
- `voice.md` — written by a human in 20 minutes *from her real posts*: case, median length, punctuation, emoji habits, slang she uses / never uses, CTA habits, platform differences, 5 perfect captions, 3 she hated. This is injected verbatim into every generation.
- `caption-examples.md` — her real captions (`import-captions` via Apify, top performers first, with stats), hand-picked favourites, and everything a human later approves or edits (auto-appended). The generator samples 40 spread across the file; the critic sees 15.
- `hooks.md` — first-3-words patterns from her top posts.
- `banned-phrases.md` — her personal blocklist + `allow:` overrides of the global one.

## 2. Generation prompt (`prompts/caption.generate.md`)
Writes **as her**, not for her. Rules that matter most: match her *median* length, no CTA unless she uses CTAs, no hashtags unless she does, never describe the video, three meaningfully different candidates (deadpan / playful / hook-based). Temperature 1.0.

## 3. Critic prompt (`prompts/caption.critic.md`)
A second, cold (T=0) call that scores each candidate on `voice`, `slop`, `hook` and lists the "tells". It may fix ≤5 words. If nothing scores ≥7/7 it returns `final: null` and the generator retries once with the violations fed back.

## 4. Deterministic lint (`src/modules/captions/lint.ts`)
Runs on every candidate: length/emoji/hashtag budgets from `model.yaml` (set from the import stats), lowercase rule, the global blocklist `prompts/slop-blocklist.txt` (✨, em dashes, "vibes", "main character", "which one are you", "link in bio", #fyp spam…), and her personal list. A caption that fails lint is never shown as the pick.

## 5. Human loop that improves the files
Approval card → ✅ approve / ✏️ edit (modal) / 🔁 regen / ❌. Approved and edited captions are appended to `caption-examples.md` (edited ones tagged, weighted higher later). Monthly `agents/voice-audit.md` re-scores the last 30 approvals, promotes repeated "tells" into her banned list, and tightens `voice.md`. Edit rate > 40% = voice.md is wrong, fix the file, not the prompt.

## What "done" looks like
Dan approves 8/10 captions unedited for a model whose `voice.md` is filled. Until then, keep editing — every edit is training data.

## Things that make it worse
- Filling `voice.md` with adjectives ("fun, bubbly, confident") instead of observed facts ("never uses periods; 😭 as punctuation; 4-word median").
- Global hashtags. Generic hooks. Letting the bot describe the video.
- Raising temperature to "get variety" — variety comes from the three-mode candidate rule, not randomness.
