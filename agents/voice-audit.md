# Agent: voice audit (monthly, per model)

Goal: keep captions sounding like her as she changes.

1. Pull her last 30 real captions (`npm run import-captions -- <slug> 30` writes them) and the last 30 bot-approved ones (`captions` table, status approved|edited).
2. Run `prompts/caption.critic.md` over the 30 bot ones using the 30 real ones as examples. Record average voice/slop scores.
3. List every "tell" the critic flagged ≥3 times → add to `voice/banned-phrases.md`.
4. If ≥30% of approvals were **edited**, diff edited vs original: what did the human change (length? emoji? tone?) → update `voice/voice.md` "How she actually types".
5. Refresh `voice/hooks.md` from her current top-10.
6. Commit with message `voice(<slug>): monthly audit — avg voice X.X slop X.X`.
