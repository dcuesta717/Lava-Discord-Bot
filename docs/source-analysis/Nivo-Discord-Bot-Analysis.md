# Nivo HQ — Discord + "Larry The Bot" Teardown & Build Blueprint

**Source:** 112-second iPhone screen recording (RPReplay_Final1788970774.MOV) narrated by the creator ("Amari Preeti") while she is signed into another agency's Discord server ("Nivo HQ" / nivomanagement).
**Method:** audio transcribed with Whisper; 3,377 frames extracted at 30 fps, deduplicated to 174 distinct screens, every distinct screen read at 1.8× zoom. Fast scrolls re-extracted at full frame rate so nothing was missed.
**Prepared for:** Dan (owner) / Aaron (tech) — Lava Mgmt.

---

## 0. TL;DR — what they actually have

It is **not** an off-the-shelf bot. It is one custom Discord app ("Larry The Bot") wired to an LLM, a scheduler, Google Drive, Notion and the agency's own OnlyFans/chat-team data. Per creator, they spin up a **private category with 7 channels**, and the bot does 7 jobs:

| # | Job | Where | Trigger | What the bot does |
|---|-----|-------|---------|-------------------|
| 1 | **Live tracker** | #general-chat | `/live-started`, `/live-ended` slash commands | Posts "Live started — chat team notified ✅", pings the chat team. 40 min in, asks "Are you still on LIVE?" with 🟢/🔴 buttons, re-asks every 30 min, auto-ends after 2 h if no answer. |
| 2 | **Weekly IG insights** | #notification | Cron: **9:00 AM the morning after each 7-day window closes** (seen Mon 8/31 and Tue 9/8 for "1–7 September") | Asks for an Instagram Insights screenshot for that window (gives click-path). When she posts it, reacts 👀, replies "aight lemme read this… ✅ got it" and extracts **views, view ratio, % followers, % non-followers** with vision. |
| 3 | **Reels copy board** | reels-copy-board (Forum) | Staff/bot posts | Read-only forum. Each post = "🎬 **recreate this** · Filler" + embedded reference reel + buttons **✅ on drive / 📤 already posted / ❌ skip**. Creator recreates trending reels and marks status. |
| 4 | **Content requests from chat team** | #ressources & #general-chat | Chat manager submits a request | Bot rewrites it in Larry's voice: "Yo Amari, we been cookin lately! Here's what the Chat Manager needs from you…" + itemised list with target durations + Drive upload folder link. |
| 5 | **Revenue hype / milestones** | #general-chat | OF earnings data | "Bestie we're at $25,054.17 in the month so far, which is more than $10,000 over your previous highest month…" + meme image. |
| 6 | **Conversational persona** | #general-chat | @mention / reply | Claude-style chat with slang persona ("just larry is fine tho, no need to get formal on me. what's up?"). |
| 7 | **Announcements** | #general-chat | Manual/Scheduled | "Full content plan coming soon… 👀" + meme; explanation posts when a feature changes. |

Non-bot parts of their system: **weekly invoice PDFs** posted by the owner in #invoices (creator reacts ✅), a **Notion site** of playbooks (Street Interviews, TikTok Livestream Growth), **Google Drive** as the content pipeline (creator uploads raw → agency edits → renames files ✅ / 💛 / 1-5), and an **iMessage group** ("Amari - Nivo") for fast texting.

---

## 1. Audio transcript (creator's narration, timestamps in seconds)

```
[  0.0 -   2.2] Okay, so this is — I don't know if you can hear me or not —
[  2.2 -   7.6] this is the general chat where I, like, put in when I'm live pretty much,
[  7.6 -  13.2] and then they do like little updates and stuff, and like if they need to tell me anything.
[ 13.2 -  17.9] But also I have his phone number so we text on there. And then this is my reels copy board.
[ 17.9 -  24.4] I don't necessarily copy these — this would actually be kind of cute. Um, I do some of them, and then…
[ 25.5 -  29.5] shit. I don't know what this is.                                   ← opens empty #custom channel
[ 30.9 -  38.6] Notifications is to keep track of my progress and… it'll like, yeah, pretty much.
[ 39.0 -  44.5] Not very good at explaining, I can never do a voice-over. And then here's like resources,
[ 44.5 -  51.7] so everything that I like need to do. So here's like the street interviews and he tells me exactly like what to do.
[ 51.7 -  57.9] So here are the examples of interviews, and then — fuck, sorry — and
[ 58.2 -  66.6] then tells me how they're gonna edit it, and then tells me exactly like how to talk to the people, and then here are all the questions that I need to ask,
[ 66.8 -  73.0] what I need to prioritize, and… then yeah, there's that. And then
[ 73.9 -  75.9] here's my Google Drive.
[ 76.9 -  81.8] Okay wait, no, fuck. Okay, this is getting a little off track, but
[ 86.1 -  88.4] here's the — let's say from the content house.
[ 88.4 -  95.3] So this was everything that I took at the house and I put it all into here, and he went in and edited,
[ 97.0 - 101.7] like, that — he edited everything and then put it, labeled it one through five.
[104.0 - 106.4] But yeah, and then
[108.7 - 111.9] Invoices is just where he invoices. So easy.
```

Key takeaways from the narration: (1) #general-chat is where she reports going live; (2) she does *some* of the reels on the copy board, not all; (3) she does not even know what #custom is (it is empty, so unused for her); (4) #notification = "keep track of my progress"; (5) #ressources = "everything I need to do" — the Notion guides are the instruction layer; (6) Drive is the raw→edited handoff, agency edits and labels 1–5 in posting order; (7) invoices are one-way from the agency.

---

## 2. Frame-by-frame walkthrough

Timestamps are video seconds. Discord dates are the message timestamps shown in the app (recorded 9/9/2026 at 12:18–12:19 PM local).

### 2.1 — 0:00–0:03 · Server sidebar
- Only one server in her sidebar: **Nivo HQ** (teal "N" icon). She's in a server dedicated to her, or a server where she can only see her own category.
- Category: **Amari Preeti** (creator's name — one category per creator).
- Channels (every text channel has the 🔒 private badge):
  - `#💬-general-chat`
  - `reels-copy-board` (Forum-channel icon)
  - `#🌸-custom`
  - `#🔔-notification`
  - `#📚-ressources` (sic — French spelling; the team is likely French/Quebec)
  - `#💵-invoices`
  - `🔊 call` (voice)
- Logged in as **amari preeti** (Online).

### 2.2 — 0:03–0:14 · `#💬-general-chat` (scrolled bottom → top)

Newest first:

**9/8/26 4:15 PM — Larry The Bot [APP]**
> Full content plan coming soon… 👀
> Apologies for the short delay, we have absolutely no reason for it
> *(Kevin Hart meme image)*

**9/5/26 2:07 PM — Larry The Bot**
> Hey! This is forwarded from the chat manager on the content priorities we currently need.
> **For wall-feed content:** • 3-5 batches of 5-10 photos, with a different lingerie set for each batch.
> **For video content:** • 1 full script with a different outfit than last time.
> **Additional content:** • If you have any new sextapes, a whale bought all of the previous ones and only buys tapes
> **Drive link :** When ready, upload the content in the appropriate folder inside the folder below
> `https://drive.google.com/drive/folders/1z7sYDBr5SWWS0KNJ8yoS32pLgqGLPDWq?usp=sharing` *(Google Drive embed)*

→ The chat team (people who DM fans on OF) feed demand signals ("a whale only buys tapes") into a request; the bot relays it to the creator with the upload location.

**8/30/26 2:19 AM — jay.ktb (owner 👑)**
> Here's what it'll look like
> *(screenshot: "@jay.ktb Are you still on LIVE?" with green **[Yes, still live]** and red **[No, I ended it]** buttons)* ❤️ 1

**8/30/26 2:02 AM — Larry The Bot** (feature announcement, verbatim)
> Hey! quick update on how the new live notifications work
> nothing changes when you go live. You still just "/live-started" in your channel.
> what's new is what happens after:
> **40 min in**, I'll post in your channel asking "Are you still on LIVE?" with two buttons:
> 🟢 **Yes, still live** — nothing happens, keep going. I'll check again in 30 min, and every 30 after that.
> 🔴 **No, I ended it** — I notify the chat team for you. **You don't need to run "/live-ended".** I'll confirm right there so you know it went through.
> **if you don't answer at all**, after 2 hours I'll let the chat team know your live ended anyway. That's about the average live length, and it's better they hear a bit early than not at all.
> and you can always run "/live-ended" yourself whenever, before or in-between the notifications, that stops the check-ins right away, and like usual, tells the chat team you're off
> that's it! the whole point is so you never have to remember the ending part!

**8/30/26 1:33 AM — Larry:** `**Live ended** — chat team notified ✅`
**8/29/26 8:43 PM — Larry:** `**Live started** — chat team notified ✅`

**8/28/26 2:29 PM — amari:** "god mf damn"
**8/28/26 2:29 PM — jay.ktb:**
> Just saw this from last week, a fan spent $3,120 in 2h including 15 x $199 PPV. Ngas be feinin for u
> *(screenshot "Spending breakdown": 15 × $199 = $2,985 gross / $2,388 net; 1 × $69; 1 × $42; 1 × $24; TOTAL $3,120 gross / $2,496 net; "Total net after the 20% OnlyFans fee: $2,496.00 · OnlyFans fees: $624.00")*

**8/28/26 2:17 PM — Larry (replying to amari):** "lmao no problem 😭 just larry is fine tho, no need to get formal on me. what's up?"
**8/28/26 2:17 PM — amari:** "@Larry The Bot thank you sir"
**8/28/26 2:16 PM — Larry:**
> Bestie we're at $25,054.17 in the month so far, which is more than $10,000 over your previous highest month. Gooners be gooning heavy. We pushing 🅿️
> *(meme: guy giving thumbs-up in a car)*

**8/26/26 — Larry:** Live started 1:25 PM → Live ended 1:47 PM; Live started 7:37 PM → Live ended 8:06 PM (all "chat team notified ✅")

**8/24/26 10:30–11:09 PM — setup/testing conversation** (oldest visible):
- amari: "keep it professional larry  we on the clock"
- Larry: "mb babygirl 🙏🏼"
- amari: "bro😭😭😭😭😭😭" / jay: "he wildin / I told him to stop calling girls that" / amari: "i'm dead"
- jay: "alright let me run a test" → Larry: "Live started — chat team notified ✅ / Live ended — chat team notified ✅"
- jay: "now when you do the command, it if worked, this message will appear" → amari: "okay"
- jay: "do you got time tn to do the thing on the payment platform i talked about earlier or should I put that on my sched for tmrw?" → amari: "i can do it now" → jay: "bet lmk if you need any help" / "Send me a text when you've done it, I'll finish the set up and then we'll test it"

→ Observations: the bot free-chats with an LLM persona (and had to be reined in), the live commands were rolled out 8/24 and the check-in buttons on 8/30, and onboarding to a "payment platform" happened in the same week.

### 2.3 — 0:14–0:27 · `reels-copy-board` (Forum channel)
- Forum view: one post **"Fillers"** by jay.ktb (20 h ago) — "Original message was deleted", 0 comments; "OLDER POSTS" section empty. `Sort & View` control; `+` new-post button (she can't post — inside the thread it says **"Channel is read-only."**).
- Inside "Fillers": a stream of bot messages, each:
  - `Larry The Bot [APP]  <date>`
  - `🎬 **recreate this** · Filler`
  - an embedded short vertical video (reference reel from some other creator — bedroom/kitchen/"eye contact challenge"/"what do you wanna eat for lunch" style filler clips)
  - three buttons: **✅ on drive** (green) · **📤 already posted** (blurple) · **❌ skip** (red)
- Dates visible: 9/8/26 4:03 PM (several), 9/4/26 4:43 PM, 8/26/26 2:29 PM (several) — i.e. batches dropped a few times a week.
- Channel info sheet: *reels-copy-board — Forum Channel*; tabs Members / Media / Pins / Threads / Links / Files. **Members: Online — amari preeti, GoldenJake; Offline — jay.ktb 👑, Larry The Bot [APP].** So this creator's category is visible to exactly: her, one staffer (GoldenJake), the owner and the bot.

### 2.4 — 0:27–0:29 · `#🌸-custom`
- Empty private channel ("Welcome to #🌸-custom! This is the start of the #🌸-custom private channel."). Reserved for custom-content requests from fans; unused for her so far ("I don't know what this is").

### 2.5 — 0:29–0:39 · `#🔔-notification`

**8/31/26 1:59 PM — Larry:** "👀 aight lemme read this… ✅ got it" →
```
views: 321,299
view ratio: N/A
% followers: 23.4%
% non-followers: 76.6%
```
(preceded by her screenshot of IG Insights for Aug 24–29: viewers 57,413; Reels 188K, Posts 68K, Stories 64K, Live 0 — bot reacted 👀)

**9/8/26 9:00 AM (Tuesday — the morning after the 1–7 window closed) — Larry:**
> 👋 hey Amari! can u send a screenshot of ur **instagram insights** for the week of **1–7 September**
> *(insights → overview → set the date range to 1–7)*

**9/8/26 12:53 PM — amari:** screenshot (IG Insights, Overview, 7 days: Views **1,660,613**, Net followers **+7,084**, Interactions **68,973**; 8.3% followers / 91.7% non-followers; Viewers 543,960; Reels 1.2M, Posts 290K, Stories 168K, Live 0) — bot reacted 👀 1

**9/8/26 12:53 PM — Larry:** "👀 aight lemme read this… ✅ got it" →
```
views: 1,660,613
view ratio: N/A
% followers: 8.3%
% non-followers: 91.7%
```
→ Pattern: scheduled 9:00 AM ask the day after a 7-day window (their windows look date-based: …24–30 Aug, 1–7 Sep) → creator uploads screenshot → bot OCR/vision-parses within the same minute → structured metrics logged. ("view ratio: N/A" = a field the parser expects but IG's overview doesn't show; probably views÷followers or reels-vs-posts they compute elsewhere.)

### 2.6 — 0:39–0:47 · `#📚-ressources`

Oldest → newest:

**Larry The Bot (bot avatar visible, header scrolled off — posted before 8/31):**
> Yo Amari, we been cookin lately! Here's what the Chat Manager needs from you whenever you get a chance. Ain't no rush tho, just tap in when you can.
> **Welcome message pics (cute pictures of you (clothed))**
> **Striptease video (no nudity)** : 0:30 minutes
> **Handjob video** : 1:30 minutes
> **Intense dildo blowjob video** : 2:30 minutes
> **Doggy video** : 3:30 minutes
> Remember, only do what you're actually comfortable with. Don't force anything just for content. Appreciate you homie 🤞🏼

**8/31/26 4:59 PM — jay.ktb:** Google Drive folder link (`…/folders/1ZNhKRchmKfOx0_5zns9W45kmrAd6iSw_`)
**8/31/26 8:01 PM — jay.ktb:** `https://nivomanagement.notion.site/TikTok-Livestream-Growth-3cd717d2783a801d8355ef8a96705039` (Notion embed "TikTok Livestream Growth")
**9/4/26 1:39 AM — jay.ktb:** Google Drive folder link (`…/folders/1QEidvdLn62tPALrDn1T9_yUcetUVZCn1`)
**9/6/26 7:25 PM — jay.ktb:** `https://nivomanagement.notion.site/Street-Interviews-3bc717d2783a804b80b0f108f47a0752` — embed: "Street Interviews | Notion — Here are a couple of examples of street interviews with winning concepts" (DJI Mic image)

### 2.7 — 0:47–1:12 · Notion page "Street Interviews" (opened in Discord's in-app browser)
Structure of the playbook (this is the "instruction layer" the creator praises):
1. **Intro callout:** "Here's a quick guide on the best way to make street interviews"
2. **📷 Equipement** (sic) → *Microphone*: always test the mic first by simulating an interview; in loud/crowded places test with and without background-noise reduction; the mics come as a pair — give one to the interviewee or pass one back and forth. (DJI Mic 2 image)
3. **Filming:** clean the lens; check lighting (subject well-lit, no strong backlight, natural light best); keep camera steady, two hands; lens at eye level (eye/chest level of interviewee); check framing (centered, headroom). "Here's what the framing should look like:" → 6 example videos embedded (street-interview reels: girl with pink mic, "would you rather be trans or a transformer?", "HOW MUCH DOES…" fit-check, two guys w/ US flag, etc.)
4. **⚙️ Structure:** "multiple ways we can structure a Reel during the editing process… volume is extremely important — aim to interview **at least 10–20 people per filming session**."
   - **Compilation** (red block): instead of Guy1 full → Guy2 full → Guy3 full, **intercut** Guy1 → Guy2 → Guy3 → Guy1 → Guy3 → Guy2; connect answers, not chronology; every cut introduces a new face = retention.
   - **🎬 Full Interview** (blue block): one person carries the whole reel. Structure **Question → Answer → Follow-up → Explanation → Payoff**. Example: "Could your girlfriend have a guy best friend?" → "Honestly, if she has a guy best friend, I'm out." → "Why?" → "Because every time I've—" → *explains story* → "And then I found out she was actually—". Cut pauses/filler; make it a short story; works when someone is charismatic/funny/controversial.
5. **❓ Question Ideas** (each tagged with how many answers needed):
   - "Would you rather be gay or gamer?" *(needs 5-7 answers)*
   - "Would you rather be trans or transformer?" *(needs 5-7 answers)*
   - "What's the biggest red flag in a girl?" Make them elaborate *(needs 5-7 answers)*
   - "Would you rather have a gay son or a thot daughter? Why?" *(needs 1 good answer)*
   - "What's worse: cheating or lying about cheating?" *(needs 1 good answer)*
   - "Would you forgive cheating if they told you immediately? Why?" *(needs 5-7 answers)*
   - "What's the biggest green flag in a girl?" Make them elaborate *(needs 5-7 answers)*
   - "Would you date your best friend's ex? Why or why not" *(needs 5-7 answers)*
   - "How much does the fit cost?" ragebait by saying every piece looks cheaper / you don't believe them *(needs 1 good answer)*
6. **➡️ Prioritize:** for regular questions push them to elaborate; for the 3 "would you rather" questions ask **at least 5–7 different guys per question** so one compilation reel can be cut ("gay or gamer", "trans or transformer", "homo or a home owner").
7. **💡 How an Interaction With a Guy Should Look:** 1. Approach him → 2. Start with the 3 "Would You Rather" questions → 3. Ask one open-ended question ("What's the biggest green flag in a girl?") → 4. Get his answer ("She never goes out.") → 5. Follow up and make him elaborate ("Why is that a good thing?") → 6. Repeat with another guy, different open-ended question. Goal: variety of funny/unexpected answers usable across different reels.

She then backs out to #ressources (1:12–1:14).

### 2.8 — 1:14–1:18 · Google Drive "WallFeed" folder (from Discord link)
- Folder **WallFeed** → subfolders **10k shoot** (Modified Sep 4) and **already uploaded** (Modified Sep 4). → Wall-feed photo sets, with an "already uploaded" done-bucket.

### 2.9 — 1:18–1:26 · Off-track: home screen & iMessage
- She swipes out to the iPhone home screen (Discord, Sheets, Cash App, Wise, Flex etc. — not relevant) and opens Messages.
- Business-relevant thread: **"Amari - Nivo"** iMessage group (Nivo "N" logo) with **jack onlyfans** and **jay onlyfans**. Visible exchange: "Yup perfect" / "okay posted" ❤️ / "Did you end up doing interviews or no luck?" / "no there were only families unfortunately / emma was twerking and there were kids behind her we had to go😭" / GIF. → Day-to-day nudging happens over text, not Discord.
- Group **Links** tab: *Voice Samples – Google Drive*, *SRS (srs.chat)*, *SRS (clients.sigsyn.io)* — an unidentified client portal, *Edited Pictures – Google Drive*, *Pictures – Google Drive*, *Content House – Google Drive*, *Easy Split-Payment… (nivomanagement.notion.site — "click on 'money map'")*, *Check out Amari Pre… (link.me)*.
- (Other personal contacts/phone numbers on screen are omitted here on purpose.)

### 2.10 — 1:26–1:45 · Google Drive "Content House" folder
- Her *My Drive* root: `53021welcome letter.pdf` (Mar 5), `Copy of Intake Form` (Sheets, Jul 21), two raw .mov, a screen recording, an old form. → She received a welcome letter + intake form when onboarded.
- **Content House** (shared folder, people-icon on every file): ~20 video clips. Naming convention after the agency edits: files renamed to **✅** (edited/approved, Modified Sep 2 & Sep 5), one **💛**, and **1, 2, 3, 4, 5** (posting order); the untouched raw uploads keep iOS UUID names (`3CC96BAC-…`, `25218260aa1f…mov`, Modified Aug 27).
- She opens "✅" → 8-second pool-hall clip with caption "🎱: « the ball is too far I can't reach it »" (a recreated filler reel, French-style « » quotes → editor is French-speaking). Opens "5" → 9-second bikini doorway clip.
- Narration confirms: she dumps everything from the content-house shoot into Drive, "he" edits and labels 1–5.

### 2.11 — 1:47–1:52 · Back to Discord → `#💵-invoices`
- Private channel. Owner posts one PDF per week, creator reacts ✅:
  - 8/7/26 2:14 PM — `INV-AMA-2026-001.pdf` (3.78 KB) ✅
  - 8/15/26 3:05 PM — `INV-AMA-2026-002.pdf` (3.67 KB) ✅
  - 8/22/26 12:10 PM — `INV-AMA-2026-003.pdf` (3.67 KB) ✅
  - 8/30/26 2:22 PM (edited) — `INV-AMA-2026-004.pdf` (3.68 KB) ✅
  - 9/8/26 9:16 AM — `INV-AMA-2026-005.pdf` (3.79 KB) — not yet ✅
- Naming: `INV-<3-letter creator code>-<year>-<seq>`. ~3.7 KB = generated PDF (template/script, not a scan). Weekly cadence, Fri–Mon.

---

## 3. Reconstructed architecture of THEIR system

```
                    ┌──────────────────────────── Discord "Nivo HQ" ────────────────────────────┐
                    │  Category per creator (private): general-chat · reels-copy-board(forum)     │
                    │  · custom · notification · ressources · invoices · call                     │
                    │  Members: creator + 1 staffer + owner + Larry The Bot                       │
                    └───────────────▲──────────────────────────────▲──────────────────────────────┘
                                    │ slash cmds, buttons, msgs     │ posts, embeds, reactions
                    ┌───────────────┴──────────────────────────────┴──────────────────────────────┐
                    │                      "Larry The Bot" (custom Discord app)                    │
                    │  • LLM persona (Claude/GPT) w/ system prompt = slang, memes, hype            │
                    │  • Scheduler: weekly 09:00 insights ask; live check-ins @40m, +30m…, 2h cap  │
                    │  • Vision: parses IG Insights screenshots → views / %followers / …           │
                    │  • Forum poster: reference reels + 3 status buttons                          │
                    │  • Relay: chat-manager requests → creator-friendly message + Drive link       │
                    │  • Earnings: monthly running total vs. best month → hype message              │
                    └──────┬───────────────┬────────────────┬─────────────────┬────────────────────┘
                           │               │                │                 │
              ┌────────────▼──┐   ┌────────▼───────┐  ┌─────▼──────┐  ┌───────▼─────────────┐
              │ Chat team /   │   │ Google Drive   │  │ Notion site│  │ OF stats / CRM      │
              │ manager       │   │ (WallFeed,     │  │ playbooks  │  │ (spending breakdown,│
              │ (gets live    │   │ Content House, │  │ (Street    │  │ monthly totals)     │
              │ on/off pings, │   │ per-request    │  │ Interviews,│  │                     │
              │ sends content │   │ upload folders)│  │ TikTok Live│  │                     │
              │ requests)     │   │ raw→edit→✅/1-5 │  │ Growth)    │  │                     │
              └───────────────┘   └────────────────┘  └────────────┘  └─────────────────────┘
                                          Side channels: iMessage group "Amari - Nivo", weekly invoice PDFs
```

### Design choices worth copying
1. **One private category per creator** with an identical channel template → the bot can be multi-tenant with a `creators` table (`discord_category_id`, channel ids, IG handle, drive folder ids, invoice code).
2. **Forum channel + buttons** for the reels board: each reference reel is a message with its own state machine (`on_drive` / `posted` / `skipped`). Read-only for the creator so the board stays clean.
3. **Slash commands with follow-up check-ins** instead of trusting people to remember `/live-ended`. Timeout defaults are tuned to their average live length (2 h).
4. **Ask for a screenshot, not API access.** IG's API for insights is a pain; a weekly cron + vision parse is a 1-hour build and the creator already knows how to screenshot.
5. **Bot rewrites staff requests in a friendly voice** — the chat manager writes a blunt list, Larry turns it into "Yo Amari, we been cookin…" with a consent reminder. That framing is a big part of why the creator likes it.
6. **Everything the creator must *learn* lives in Notion; everything she must *do* lives in Discord.** Discord links out to Notion/Drive; nothing heavy is pasted into chat.
7. **Drive file-renaming as workflow state** (raw UUID → ✅ / 1–5). Cheap, visible in the mobile Drive app, no extra tool.
8. **Persona guardrails were needed** ("stop calling girls that"). Put tone rules in the system prompt from day one.

---

## 4. Build blueprint for Lava Mgmt (Discord + Claude + Notion + GitHub + Drive)

### 4.0 Decisions locked (Aaron, Sept 17) — and what changed
| Decision | Effect on the build |
|---|---|
| Invoices are not important | `#invoices` dropped from the per-model template; no invoice module. |
| "Team" = owners (Dan, Marissa) + the creator | No separate chat-team; live alerts and upload pings go to a staff `#live-alerts` / `#content-requests-inbox` that Dan and Marissa see, and the model's own channel. `OWNER_IDS` in `.env`. |
| Reels sourcing via a paid scraper (Apify) | Daily cron per model pulls TikTok/IG candidates from `models/<slug>/sourcing/reels-sources.yaml`; Claude classifies + writes the recreate brief; posts to her forum board. |
| Auto-posting via Zernio | `/post` → preview card → ✅ → Zernio presign/upload + `POST /posts` (verified against docs.zernio.com). Nothing posts without a tap. |
| Dan gets bot admin | `BOT_ADMIN_IDS` = Dan; `OWNER_IDS` = Dan + Marissa; per-model `manager_ids` for anyone else. |
| ~15 models, each with own files + own Discord | One folder per model (`models/<slug>/`: config, voice, sourcing, notes, playbooks) and one **private category per model** in a single Lava server (that's how Nivo does it — she only sees her own). `guild_id` per model is supported if a model ever needs a fully separate server. |
| Captions must not sound like AI | Five-layer voice system: per-model `voice.md` + her real captions (imported via Apify) → generator (3 modes) → cold critic → deterministic slop lint → human approve/edit loop that feeds back into her examples. See `docs/caption-voice-system.md`. |
| Agency chat with all the girls | `#agency-lounge` (all models + owners) with Friday shout-outs and long-live shout-outs; never numbers. |
| graphify | Added to the repo setup (`graphify install` + git hook) so Claude Code has a knowledge graph of 15 model folders + code instead of grepping. |

The repo scaffold implementing all of this is `lava-discord-bot/` (typechecks clean; live tracker, persona, insights, requests, reels, captions, posting, earnings and agency modules are all real code, not stubs).

### 4.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Bot runtime | **Node 20 + discord.js v14** (or Python + discord.py if Aaron prefers) | Slash commands, buttons, forum channels, reactions all first-class. |
| AI | **Anthropic API — Claude Sonnet 4.5** for chat/persona/rewrites; same model with **vision** for insight screenshots; **Claude Agent SDK / Claude Code** for building and for scheduled "agents" | One vendor; vision + tool use in one call. |
| Data / ops UI | **Notion** databases (Creators, Content Requests, Reels Board, Weekly Metrics, Live Sessions, Invoices) | Dan/staff already live in Notion; every bot action mirrors to a Notion row so nothing is Discord-only. |
| Files | **Google Drive API** (service account with access to a "Lava Content" shared drive) | Same raw→edited→✅ flow; bot can watch folders and post "new upload" pings. |
| State | Postgres (Supabase/Neon) or SQLite for a single VPS | Timers for live check-ins must survive restarts. |
| Scheduler | node-cron inside the bot (or Cowork/Claude scheduled tasks for the "agent" jobs) | Weekly insights ask, weekly invoices, daily reels scrape. |
| Hosting / CI | **GitHub repo** → GitHub Actions → Railway / Fly.io / a $6 VPS with pm2 | Push-to-deploy; secrets in env. |
| Auto-posting (phase 4) | **Zernio** social-posting API (Aaron's suggestion; single API to 15+ networks, built for AI agents) or Meta Graph API for IG-only | Creator taps ✅ approve → bot posts. |
| Invoices | PDF generated from a template (pdf-lib / React-PDF) from a Notion/Sheets row; or Stripe/Wave/Invoice Ninja API if Dan invoices from a platform | Weekly cron, posted to #invoices, ✅ reaction = acknowledged. |

### 4.2 Discord server template (per creator, private)
```
📁 <Creator Name>            (role: @creator-<slug>, visible only to her + assigned staff + owner + bot)
 ├ #💬-general-chat          creator ↔ manager ↔ bot; /live-started /live-ended live here
 ├ 🎬 reels-copy-board       FORUM, read-only for creator; posts per category (Fillers, Street Interviews, Trends, GRWM…)
 ├ #🌸-custom                custom-content requests from chat team (bot posts request card + deadline + price)
 ├ #🔔-notification          weekly insights ask + parsed metrics + streaks/milestones
 ├ #📚-resources             playbooks (Notion links), content-request briefs, Drive folders
 ├ #💵-invoices              weekly PDF, ✅ to acknowledge
 └ 🔊 call
📁 STAFF (hidden from creators)
 ├ #chat-team-alerts         "Amari is LIVE" / "Amari ended live" pings (this is what "chat team notified ✅" means)
 ├ #content-requests-inbox   chat managers drop requests here (or a Notion form) → bot rewrites + relays
 ├ #reels-inbox              staff paste reel URLs → bot classifies + posts to the right creator board
 ├ #ops-log                  every bot action (audit)
 └ #bot-dev                  Aaron
```

### 4.3 Bot modules (build in this order)

**M1 · Core + persona (day 1)**
- `/setup-creator name ig_handle drive_folder invoice_code` → creates category + 7 channels + role, writes Notion Creator row.
- Message handler: on @mention or reply in the creator's channels → Claude with a persona system prompt (name it — e.g. "Lava" / "Rico"), per-creator memory pulled from Notion (name, goals, last metrics, open requests). Hard tone rules: no pet names, no sexual comments toward creators, keep it hype but professional.
- Log every message to #ops-log.

**M2 · Live tracker (day 1–2)** — replicate exactly:
- `/live-started [platform]` → post "**Live started** — chat team notified ✅" in creator channel + "🔴 <Creator> is LIVE on <platform>" in #chat-team-alerts; create `live_sessions` row (start_ts).
- Timer at +40 min → "Are you still on LIVE?" with buttons `🟢 Yes, still live` / `🔴 No, I ended it`. Yes → re-ask every 30 min. No → mark ended, notify chat team, confirm in-thread. No answer by +120 min → auto-end + notify + "auto-ended after 2h" note.
- `/live-ended` at any time cancels timers. Persist timers in DB so a restart re-arms them. Weekly summary of total live minutes → Notion.

**M3 · Weekly insights (day 2)**
- Cron Monday 09:00 (creator's timezone; Mon–Sun windows are simpler than Nivo's date-based ones) → post the ask with the date range and the click-path.
- On image attachment in #notification → react 👀, send to Claude vision with a JSON schema {views, net_followers, interactions, pct_followers, pct_non_followers, reels_views, posts_views, stories_views, live_views}. Reply "✅ got it" + metrics block; write Notion Weekly Metrics row; add week-over-week delta ("↑ 5.2× vs last week") and a 4-week sparkline image.
- If no screenshot by Tuesday 12:00 → gentle reminder; escalate to staff channel Wednesday.

**M4 · Content requests relay (day 3)**
- Chat manager posts in #content-requests-inbox (or fills a Notion form): creator, items with durations, deadline, drive subfolder.
- Bot → Claude rewrites into the friendly brief (with the consent line), posts in creator's #resources with the Drive link, creates Notion Content Request row (status = requested).
- Drive watcher: new files in that subfolder → status = uploaded, ping the requester in staff channel; editor renames to ✅ → status = edited; posted → done. Weekly "open requests" digest to staff.

**M5 · Reels copy board (day 4–5)**
- Ingest: staff paste reel URLs in #reels-inbox **or** a daily agent (Apify TikTok/IG scrapers or the platforms' trending pages) pulls candidates per niche keyword; Claude scores hook/format and tags a category (Filler, Street Interview, Trend, GRWM…).
- Bot posts to the creator's forum thread for that category: `🎬 recreate this · <Category>` + video (download & re-upload ≤25 MB so it embeds, or link) + buttons `✅ on drive` / `📤 already posted` / `❌ skip`. Button press → update Notion Reels Board row + edit message (disable buttons, show state + who/when).
- Nudges: if a reel sits untouched 7 days → "3 reels waiting on your board 👀".

**M6 · Earnings & milestones (day 5)**
- Source of truth: whatever Dan uses for OF stats (CRM export, Google Sheet, or manual `/earnings set 25054.17`). Daily agent compares month-to-date vs best month / vs goal; on crossing a threshold, Claude writes the hype message + picks a meme from an approved folder. Optional: weekly "top spender" card like jay's screenshot.

**M7 · Invoices (day 5)**
- Cron weekly (e.g. Monday 09:15) → build PDF from the invoicing system or a Notion row (`INV-<CODE>-<YYYY>-<NNN>`), post to #invoices, wait for ✅ reaction → mark acknowledged in Notion; remind after 48 h.

**M8 · Approve-to-autopost (phase 2)**
- Editor drops the final cut in Drive `Ready to Post/` → bot posts preview in creator channel with `✅ Approve` / `✏️ Changes` / `❌ Reject` → on approve, schedule via Zernio (IG/TikTok/X) at the creator's best time slot; write back the post URL + later pull its stats into Weekly Metrics.

### 4.4 Notion databases (schema sketch)
- **Creators**: name, slug, code (AMA…), discord_category_id, channel ids, role id, ig_handle, tz, drive_root, invoice_day, persona_notes, goals.
- **Live Sessions**: creator, platform, start, end, ended_by (creator / button / timeout), minutes.
- **Weekly Metrics**: creator, week_start, views, net_followers, interactions, pct_followers, pct_non_followers, reels/posts/stories/live views, screenshot url, delta_vs_prev.
- **Content Requests**: creator, requested_by, items (JSON), deadline, drive_folder, status (requested/uploaded/edited/posted), discord_msg_id.
- **Reels Board**: creator, category, source_url, caption/hook, score, status (new/on_drive/posted/skipped), discord_msg_id, acted_at.
- **Invoices**: creator, number, period, amount, pdf_url, posted_at, acknowledged_at.

### 4.5 Repo layout (GitHub)
```
lava-discord-bot/
  src/
    index.ts             client, command registry, event router
    persona/             system prompts, memory loader (Notion)
    modules/live/        commands + timers + chat-team alerts
    modules/insights/    cron + vision parser + notion writer
    modules/requests/    inbox listener, rewrite, drive watcher
    modules/reels/       ingest, classify, forum poster, buttons
    modules/earnings/    thresholds, hype writer
    modules/invoices/    pdf builder, poster, ack tracker
    integrations/        anthropic.ts notion.ts drive.ts zernio.ts
    db/                  schema + migrations
  scripts/setup-creator.ts
  .github/workflows/deploy.yml
  CLAUDE.md              (this doc's §3–4 condensed, so Claude Code builds against it)
```

### 4.6 Guardrails / gotchas
- **Persona rules in the system prompt** (no pet names, no comments on bodies, no sexual talk with creators, never promise money numbers it didn't get from data). Nivo had to correct this live.
- **Consent line on every content request** ("only do what you're actually comfortable with") — keep it, it is both ethical and retention-positive.
- **Privacy**: creator categories fully private; bot logs contain earnings — restrict #ops-log to owner/tech.
- **Discord limits**: 25 MB upload on non-boosted servers (compress reels or link them), 5 buttons per row, forum threads auto-archive (set to 1 week+), slash commands need re-registration on change.
- **Timers must be durable** (DB-backed) or a redeploy mid-live silently kills the check-ins.
- **Vision parsing**: ask for the *Overview* tab with a fixed date range; validate numbers (views ≥ viewers, percentages sum to 100) before posting.
- Aaron's own caveat stands: the foundation is a ~1-week build, but reels sourcing and content requests still need a human in the loop daily; the automation removes the *relaying and remembering*, not the editing.

---

## 5. Still open (everything else is decided — see §4.0)
1. Where do OF earnings live today (CRM export? spreadsheet?) — until then `/earnings model:<slug> mtd:<usd>` is manual.
2. The bot's name (env `BOT_NAME`, default "Lava") — pick something the girls will actually type.
3. Which Apify actors to buy (defaults set to the two most-used public ones; `normalize()` maps their fields).
4. Zernio: connect each model's IG/TikTok once in the Zernio dashboard, then paste the account ids into her `model.yaml`.
