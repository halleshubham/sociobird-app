# Postmill (`postmill-ai/postmill-app`): another Postiz fork

Reviewed on 2026-10-18 at commit `c9dc79b1` (v1.2.0). It is **not** a drop-in source: Postmill rewrote the platform (Inngest instead of Temporal, a "ProviderKernel" module system, packages renamed to `@postmill-ai/*`,
bring-your-own-key AI with 30 providers, a Konva designer, a comment inbox, campaign hub, brand kits, persisted analytics). Code from it must be re-implemented against our tree, never cherry-picked.
License is AGPL-3.0, same as ours; keep attribution in the commit message when porting an idea or code (`Ported from postmill-ai/postmill-app <sha>`).
Clone it read-only with `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 300 https://github.com/postmill-ai/postmill-app` (the session needs `add_repo` for it first).

## Taken from Postmill (do not redo)

| Postmill commit | What | Our file |
|---|---|---|
| `cfa05acf` | Invite cookie lived 15 min while the invite link is valid longer: invitees silently landed in a new personal workspace. Cookie now 1 h; refused invite joins are logged | `apps/frontend/src/proxy.ts`, `organization.repository.ts` (`addUserToOrg` warnings) |
| `49277b74` | Sentry drops client-aborted request noise (`ECONNABORTED`) | `sentry/initialize.sentry.ts` (`beforeSend`) |
| `466c9e69` | Instagram OAuth token-exchange errors mapped to actionable messages (used code, redirect URI mismatch, invalid app id/secret) | `instagram.provider.ts` `handleErrors` (also serves `instagram.standalone`) |

Not taken from `cfa05acf`: the 409 on duplicate `createTeamUser` (we have no such endpoint). Date-format locale bug `1b256858`: checked, our locales do not have it.

## Candidates, by value for an agency like Osumare (none started)

| Idea | Postmill reference | Why it might matter | Cost |
|---|---|---|---|
| Persisted daily analytics snapshots with period-over-period trends | README "Persisted multi-channel analytics" | Today analytics are live fetches; trends and client reports need history | Large (new tables, daily job, UI) |
| Cross-channel comment inbox | README "Cross-channel comment inbox" | Replies from all channels in one place | Large, per-provider comment APIs |
| Campaign hub / client grouping with goals and reports | README "Campaign Hub", "Multi-brand publishing" | Agencies report per client | Large |
| Instagram-standalone `rootInternalId` (app-scoped id for Meta deauth/data-deletion callbacks) | `1e2c65d3` | Needed when INSTAGRAM_APP_ID/SECRET are set and standalone is enabled | Small, do together with enabling standalone |
| Composer empty state when no channel is connected | `565fa77a` | Blank page instead of a hint when a channel is missing or disabled | Small |
| Throttle on billing verification routes, dependency advisory sweep | `c5e7f3ba`, `d7e7cc0b` | Hardening; run `pnpm audit --prod` (it timed out in the Oct 2026 session) | Small |
| Per-channel VPN egress, spend caps, guardrails | README | Probably not for us | n/a |
