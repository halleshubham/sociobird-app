---
description: Triage Postiz upstream changes and port the ones the user picks (never a blind merge)
---

You are running an upstream sync for SocioBird. Follow `.claude/upstream/README.md` exactly.

1. Run `.claude/upstream/sync-status.sh fetch` then `.claude/upstream/sync-status.sh status`. If the `upstream` remote is not reachable from this
   session, say so and ask the user how to get upstream access (for example attaching `gitroomhq/postiz-app` read-only); do not guess.
2. Show the user `sync-status.sh report` (what we already decided) and then the UNTRIAGED changes grouped into features, each with a one-line summary and
   whether it touches an area listed in `.claude/upstream/divergences.md` (use `sync-status.sh conflicts`).
3. **Ask the user** which features to adopt, adapt, skip or defer. Do not choose for them. Never merge `upstream/main` wholesale.
4. Port the chosen features on a branch from `main`, following the porting rules in the README (versioned workflows, provider-generic code, Razorpay billing,
   rebrand grep, Prisma caution). Run the CI-equivalent checks that are possible and re-read your diff against neighbouring code.
5. Record a ledger row for every upstream change in range, including skips, with `sync-status.sh record`; then `sync-status.sh advance <sha>`.
6. Open a PR using `.github/PULL_REQUEST_TEMPLATE.md` (detailed "What kind of change", real `# QA` steps), update `.claude/docs/DEVELOPMENT_LOG.md`
   and `divergences.md`, and tell the user what is left `deferred`.
7. Do not deploy anything unless the user asks; deployment steps are in `.claude/docs/DEVELOPMENT.md`.
