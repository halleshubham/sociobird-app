# Tracking Postiz upstream: what we took, what we skipped

SocioBird is a fork of `gitroomhq/postiz-app`. We do **not** want every upstream change, and our git history no longer
lines up with upstream's (we merged once, then diverged). So we do not use commit history to answer "what is synced".
We keep an explicit record instead.

## The three pieces

| File | Role |
|---|---|
| `baseline.env` | `BASE_SHA`: the upstream commit our tree was last fully merged from. `TRIAGED_THROUGH`: every upstream change up to here has a decision. |
| `ledger.tsv` | One row per upstream change (or feature) with its decision: `adopted`, `modified`, `skipped`, `deferred` (+ our PR/commit and a reason). **This is the answer to "what have we synced / declined".** |
| `divergences.md` | Why our tree differs from upstream, by area. Tells you where our version wins. `sync-status.sh divergences` prints the live file list (`git diff BASE_SHA HEAD`). |
| `sync-status.sh` | Reads the above plus upstream, lists untriaged upstream changes, likely conflicts, and records decisions. |

Identity of an upstream change = its **PR number** (`PR#2093`) or, if it has none, its short sha (`sha:2a0d6885`).
That does not depend on our history, so cherry-picks, squashes and rebases cannot hide a change.

## Quick questions

```
.claude/upstream/sync-status.sh report       # what have we adopted / modified / skipped / deferred so far
.claude/upstream/sync-status.sh fetch        # adds the `upstream` remote if needed and fetches upstream main
.claude/upstream/sync-status.sh status       # upstream changes since TRIAGED_THROUGH and whether each has a decision
.claude/upstream/sync-status.sh conflicts    # files upstream touched that we also changed (port these by hand)
.claude/upstream/sync-status.sh divergences  # exact list of files we added/modified/deleted vs the baseline
.claude/upstream/sync-status.sh check        # validate ledger.tsv
```

## How to run a sync (the user must say which features to take)

1. `fetch`, then `status`. Everything marked `UNTRIAGED` needs a decision.
2. Group the untriaged changes into features. Read the upstream PRs (title, description, files). Add a short summary of each feature.
3. `conflicts` and `divergences.md`: for each feature say whether it touches an area where ours wins (billing, branding, Botsab, MCP widget, public API, uploads).
4. **Present the list to the user and let them choose** adopt / skip / defer per feature. Do not decide alone and never merge `upstream/main` wholesale.
5. Port the chosen features onto a branch from `main`. Prefer `git cherry-pick -x` of the upstream commits (`-m 1` for merge commits) so the origin is in the message;
   resolve conflicts keeping our side in the "ours wins" areas. Obey `CLAUDE.md`:
   - never edit an existing workflow file or activity signature; add a new versioned one,
   - keep shared code provider-generic,
   - re-implement billing/quota changes against Razorpay and `pricing.ts`,
   - **rebrand check:** grep the diff for `Postiz`, `postiz.com`, `gitroom` in user-facing strings and fix them,
   - check new Prisma schema changes: `prisma db push --accept-data-loss` runs on every container start.
6. Record every decision, including the skipped ones, with the PR/commit that implemented it and a one-line reason:
   `sync-status.sh record <key> <adopted|modified|skipped|deferred> "<title>" "<our PR or sha>" "<reason>"`.
7. When every change up to some upstream commit has a row: `sync-status.sh advance <upstream-sha>`. It refuses if anything is undecided.
8. PR with the usual template and a `# QA` section; add an entry to `.claude/docs/DEVELOPMENT_LOG.md`; update `divergences.md` if a new area now differs.
9. Build, deploy to QAT, verify, then production. See `.claude/docs/DEVELOPMENT.md`.

`deferred` is not a decision to forget: `report` lists them, and a later sync should ask the user about them again.

## When to move BASE_SHA

Only after another **full** merge of upstream (rare). Then set `BASE_SHA` to that upstream commit, `OUR_MERGE_COMMIT` to ours, add a
`BASE:<sha>` row to the ledger, and review `divergences.md`. Ordinary selective syncs only move `TRIAGED_THROUGH`.

## Limits of this mechanism (be honest about them)

- The seed ledger covers the baseline as a whole, not each of the hundreds of upstream PRs merged before `48490b81`.
  The three `skipped` rows are the upstream features we know we removed. If you discover another removed feature, add a row.
- `status` reads only upstream's **first-parent** history. Direct pushes to upstream main show up as `sha:` keys; merge-noise subjects are skipped.
- `conflicts` is a file-name heuristic (changed upstream since `TRIAGED_THROUGH` and changed by us since `BASE_SHA`). It cannot see semantic conflicts.
- The repo clone in cloud sessions is shallow. `BASE_SHA` is present in it; if a command says a commit is missing, `git fetch --deepen` or fetch upstream.
