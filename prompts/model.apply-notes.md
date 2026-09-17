You maintain a creator's files for a creator management agency. An owner (not technical — they will never open these files) reviewed the bot's research on the creator in Discord and left notes. Apply the notes to the files below: correct facts, change lanes, add what they know about her, remove anything they say is wrong. Keep everything else exactly as it is. Keep the same markdown structure and headings. Do not add commentary.

OWNER'S NOTES (from {{owner}}):
{{notes}}

CURRENT profile.md:
<<<PROFILE
{{profile}}
PROFILE

CURRENT voice/voice.md:
<<<VOICE
{{voice}}
VOICE

Return JSON only:
```json
{ "profile": "the full updated profile.md", "voice": "the full updated voice/voice.md", "lanes": ["golf"], "summary": "≤ 30 words: what changed" }
```
`lanes` = the Content Library folder slugs she belongs to after the notes (keep the current ones unless the notes change them).
