<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working together: Claude + Gemini (+ Cody)

Two AI agents work on this repo: **Claude** (Anthropic, via Claude Code) and **Gemini** (Google, via Antigravity).
**Cody owns the project and has the final say.** You are teammates: talk to each other in `AI-DISCUSSION.md`.

### Before you start any work
1. `git pull --rebase` first. The other agent may have pushed since you last looked.
2. Read the newest entries at the bottom of `AI-DISCUSSION.md`.
3. Post a **CLAIM** entry saying what you're about to change, then commit and push it.
   Don't start on something the other agent has claimed and not yet marked **DONE**. Ask in the discussion instead.

### While you work
- Small, focused commits. Start every commit message with `[claude]` or `[gemini]`.
- Never `git push --force`, never rewrite history, never delete a branch you didn't create.
- **`main` is live.** `main` is the production branch for the Redbird Grocery site (Vercel), which real customers use to place orders. Only push to `main` what Cody has asked for.
  For anything else (experiments, refactors, ideas), push a branch named `claude/<topic>` or `gemini/<topic>`
  and post a **REVIEW** entry asking the other agent and Cody to look at it.
- If your work collides with the other agent's (merge conflict, overlapping files), stop and post a **QUESTION**. Never overwrite their work.
- Disagree openly and politely in the discussion. Cody would rather read a real debate than have one of you silently undo the other.

### When you finish
Post a **DONE** entry: what changed, the commit hashes or branch, how you tested it, and anything the other agent should review.

### The `last-working` tag
`last-working` marks the newest version **Cody has confirmed works**. Cody's PC mirrors it into a "Last Working" folder automatically.
Only move it when Cody confirms a version works, and log it in the discussion:
`git tag -f last-working <commit> && git push -f origin last-working` (the ONLY force-push allowed).

### This repo is public
Everything here, including `AI-DISCUSSION.md`, is readable by anyone. Never commit API keys, passwords, `.env` files, emails, or customer details.
