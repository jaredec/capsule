<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hosting

This repo is `jaredec/capsule`; `main` deploys to the `capsule` Vercel project. The "Capsule" routing rule on the `jaredconnolly-com` Vercel project rewrites jaredconnolly.com/capsule to this project's production domain. Capsule will eventually move into Fast Takeoff (`jaredec/fast-takeoff`), which isn't public yet.

## Curating picks

Whenever you write or edit a file in `data/picks`, follow the `SYSTEM` prompt in `scripts/lib/pick.ts` as your editorial rules. In particular:

- Pick what people in the US and Canada were actually talking about that day. Size comes first. No subject is off limits.
- The North America rule is about who was discussing it, not where it happened. A UK or French event that Americans were talking about counts.
- The editor's own read of what was big on X is ground truth and overrides any signal.
- Headline counts are not a measure of X discussion. Press coverage can raise a score, but few or no headlines must never lower one. You cannot see X, so you do not know how big something was there.
- Score `reach` and `dominance` against the calibration anchors in that prompt and use the whole range. Most days top out at 6-8. Do not default to 8.
- `crossover` is false unless you can point to people outside that world reposting it.
- Include `novelty` (1-10) and `dull` (true/false) on every story.
- Feature the post people actually saw, not a follow-up to it.
- List the runner-up stories you considered after the pick, so the editor can see what it beat. `npm run curate` features the first story with a usable source, so the runner-ups also act as fallbacks in that order.
