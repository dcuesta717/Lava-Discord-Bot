# Discord server template

One guild ("Lava HQ"). Models never see each other's categories. The bot builds the STAFF, AGENCY and CONTENT LIBRARY sections itself on boot (`modules/setup`, `modules/library`); `scripts/setup-server.ts` builds a model category.

```
📁 STAFF                          (Dan, Marissa, Aaron, bot)
 ├ #live-alerts                   "🔴 Jane is LIVE" / "⚫ ended · 47 min"; insights reminders escalate here
 ├ #content-requests-inbox        upload pings from the Drive watcher; also fine for staff to draft requests before /request
 ├ #reels-inbox                   paste "<slug> <url> [note]" → bot classifies + posts to her board
 ├ #ops-log                       every bot action (also in bot.event_log in Supabase)
 └ #bot-dev                       Aaron
📁 AGENCY                         (everyone)
 ├ #agency-lounge                 all models + owners; Friday shout-outs; long-live shout-outs; NO numbers ever
 └ #announcements                 owners post only
📁 🎬 CONTENT LIBRARY             (everyone; bot-created from library/genres.yaml — docs/content-library.md)
 ├ #📥-library-inbox              anyone pastes IG/TikTok links → filed into a folder with notes
 └ ⛳-golf 🏋-gym-girl 😂-funny …  one FORUM per genre, gallery view; girls browse, 🔥 vote, 📋 Copy this → her board
📁 <Model display name>           (her + owners + her managers + bot)     ← per model, ×15 — built by /model add
 ├ #💬-general-chat               /live-started /live-ended /caption /my-week; persona replies here; post previews land here
 ├ 🎬-reels-copy-board            FORUM · read-only for her (can react + reply in threads) · one thread per category
 ├ #🌸-custom                     custom-content requests (owners post; bot relays later if needed)
 ├ #🔔-notification               weekly insights ask + parsed numbers
 ├ #📚-resources                  content-request briefs, Drive links, playbook links
 └ 🔊 call
```

## Roles & permissions
| Role | Sees | Can |
|---|---|---|
| `@owner` (Dan, Marissa) | everything | all commands; approve posts; `BOT_ADMIN_IDS` (Dan) also gets config/ops commands |
| `@staff` (managers) | STAFF + assigned models' categories | staff commands for their models (`manager_ids` in model.yaml) |
| `@model-<slug>` | her category + AGENCY | `/live-*`, `/caption`, `/my-week`; approve her own posts; react/reply on the board |
| bot | everything | manage threads, embed links, attach files, add reactions |

## Bot application settings (Developer Portal)
- Privileged Gateway Intents: **Message Content** ON (persona + insights + inbox parsing), Server Members ON (setup-server role assignment).
- OAuth2 scopes: `bot`, `applications.commands`. Permissions: Manage Roles, Manage Channels (setup-server only — remove after), Manage Threads, Send Messages, Send Messages in Threads, Create Public Threads, Embed Links, Attach Files, Read Message History, Add Reactions, Use Slash Commands.

## Naming
- Categories: her display name. Channels: emoji-prefixed like Nivo's (they read well on mobile).
- Forum threads: category names from `prompts/reels.classify.md` (Filler, Street Interview, Trend, Skit, Talking Head).
- Custom ids: `module:action:slug:id`.
