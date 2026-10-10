# SocioBird developer docs (for humans and Claude Code sessions)

Start here. These files give a new session the context that is not obvious from the code.
`/CLAUDE.md` stays the authoritative list of coding rules; these docs add the *why*, the
*where* and the *what happened*.

| File | Read it when |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | you need to know how the system fits together, where code lives, or how a feature flows end to end |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | you are about to change code, open a PR, build an image or deploy |
| [OPERATIONS.md](./OPERATIONS.md) | you touch production/QAT, debug "posts did not publish", or need infra and incident history |
| [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) | you want to know what changed recently, and why. Append to it after meaningful work |
| [../upstream/README.md](../upstream/README.md) | the user asks to "sync with Postiz", "pull upstream features" or "what have we taken from Postiz" |

## Rules for keeping these docs useful

1. **After meaningful work, add a dated entry to `DEVELOPMENT_LOG.md`** (what, why, PR numbers, anything surprising). Newest first.
2. If you change architecture, deploy steps or infra, update the matching doc in the same PR.
3. If you make a decision about an upstream Postiz feature (take it, modify it, skip it), record it in
   `../upstream/ledger.tsv` with `sync-status.sh record`, not only in a PR description.
4. **Never write secrets here.** No API tokens, passwords, keys, IPs or database URLs. This repo is public.
   Refer to things by name (for example "the Coolify app `postiz-v2`") and let the session look up identifiers.
5. State facts you verified. Mark anything you inferred as "(inferred)" or "(verify)".
6. Docs are a snapshot. When a doc contradicts the code, the code is right: fix the doc.

## One-paragraph orientation

SocioBird is a social-media (and WhatsApp) scheduler sold at sociobird.app and hosted at go.sociobird.app.
It is a **fork of the open-source Postiz scheduler** (`gitroomhq/postiz-app`) maintained by ShackyApps.
We added Razorpay billing (INR and USD), SocioBird branding, a Botsab (WhatsApp) provider, an MCP upload
widget, public multipart uploads and other changes, and we take upstream features selectively.
Production runs as Docker images built from this repo and deployed through Coolify.
