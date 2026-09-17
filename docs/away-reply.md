# Away-reply — the bot covers for Dan

Dan: "if any of the girls message Dan the bot can reply automatically as if Dan was replying, but at the beginning it says this is Lava Bot replying while Dan is away — and some questions can be answered by the bot so it doesn't waste his time."

**The one limit:** Discord does not let a bot read or answer anyone's *personal* DMs (Dan's inbox). So the bot covers the two places it can see:

| Where | Trigger | When it replies |
|---|---|---|
| Her private channel | She @mentions an owner, or writes something that reads as a question | `auto` (default): only if no owner has replied within `delay` minutes (15) · `on`: immediately · `off`: never |
| DMs to **Lava Bot** | Any message from a creator | immediately |

Tell the girls: "DM Lava Bot for the quick stuff; it gets Dan when it needs to."

## What it may say
- Every reply starts with **"🤖 Lava Bot here while Dan's away — "** (owner name configurable: `/away owner_name:Marissa`).
- It answers only from **`knowledge/faq.md`** (edit it in GitHub — short, exact answers) plus live facts it has (her channels, Drive link, open requests, board count, live status, the commands).
- It never answers pay, percentages, contracts, leaving, disputes, other girls, health, safety, legal, or anything that promises on the agency's behalf — it says it flagged it and pings the owners.
- Persona rules apply: no pet names, no comments on looks, no flirting, no invented numbers.

## Where owners see it
`#girls-questions` (STAFF): every answer ("🤖 answered for Jane (drive link): …") and every escalation ("🚨 @Dan @Marissa Jane needs a human — pay question: …" with a link to the message). Also `bot.away_replies`. Read it weekly and fix the FAQ where the bot guessed or escalated something it could have answered.

## Commands
`/away mode:on|auto|off delay:<min> owner_name:<name>` (owners). `/away` alone shows the current state and today's count.

## How it decides
`prompts/away.reply.md` → `{ answer, escalate, reply, topic }`. `answer=false, escalate=false` = she was venting or joking → silence (no reply). Not-a-question messages never trigger it in channels; in DMs everything is considered.
