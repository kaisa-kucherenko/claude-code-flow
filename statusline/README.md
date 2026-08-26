# Status line

Puts the context-usage percentage permanently in front of you. Watching this
number is how I found my working rule: quality is sharp below ~30% of the
context window, degrades noticeably after — so the thresholds are green <30%,
yellow 30–39% (time to `/handoff`), red at 40+. Not a benchmark, an
observation — but a stubbornly repeatable one.

Also shows model + active output style, git branch, virtualenv, and Pro/Max
rate-limit windows (5h / 7d) with the reset time.

## Install

```bash
cp statusline/statusline.sh ~/.claude/
chmod +x ~/.claude/statusline.sh
```

Register it in `~/.claude/settings.json`:

```json
{
  "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" }
}
```

Parses the status JSON with `jq` when present, falls back to `python3`. Runs
in ~20ms — it never slows the session down. GNU and BSD/macOS `date` both
supported.
