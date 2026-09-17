# Notion schema (optional mirror)

The bot writes with `integrations/notion.ts → createRow(db, title, props)`. Property names below must match exactly (type in parentheses). Leave a database id empty in `.env` to disable that mirror.

| .env | Database | Properties |
|---|---|---|
| `NOTION_DB_MODELS` | **Models** | Name (title) · Slug (text) · Code (text) · Timezone (text) · Instagram (text) · TikTok (text) · Manager (person) · Status (select: active/paused) |
| `NOTION_DB_LIVE_SESSIONS` | **Live Sessions** | Name (title) · Model (text) · Platform (text) · Started (date) · Ended (date) · Minutes (number) · Ended by (select) |
| `NOTION_DB_WEEKLY_METRICS` | **Weekly Metrics** | Name (title) · Model (text) · Week start (date) · Views (number) · Net followers (number) · Interactions (number) · % non-followers (number) · Screenshot (url) |
| `NOTION_DB_CONTENT_REQUESTS` | **Content Requests** | Name (title) · Model (text) · Status (select: requested/uploaded/edited/posted/cancelled) · Deadline (text) · Drive (url) · Brief (text) |
| `NOTION_DB_REELS_BOARD` | **Reels Board** | Name (title) · Model (text) · Category (select) · Source (url) · Score (number) · Status (select: new/on_drive/posted/skipped) · Brief (text) |
| `NOTION_DB_POSTS` | **Posts** | Name (title) · Model (text) · Status (select) · Scheduled for (text) · Zernio (text) · Post URL (url) |

`createRow` maps values by type: number → number, boolean → checkbox, `YYYY-MM-DD…` string → date, `http…` string → url, other strings → rich_text. Select properties are set afterwards with `setSelect()` (the bot only does this for Status today).

Give the integration access to each database (Share → Connections). Supabase stays the source of truth (and its Table Editor already gives Dan/Marissa a dashboard, so Notion is optional); Notion is for anything you want to see next to your other Notion pages.
