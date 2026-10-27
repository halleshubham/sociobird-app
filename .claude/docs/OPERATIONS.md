# Operations

No secrets, IPs or UUIDs here on purpose. Look infrastructure up by name through the Coolify API.

## Environments

| | Production | QAT |
|---|---|---|
| URL | go.sociobird.app | social-qat.shackyapps.in |
| Coolify app | `postiz-v2` | `postiz-v2-qat` |
| Server | SM-L4 | ShackyApps.in |
| Temporal | `postiz-prod-temporal` (+ `postiz-prod-elasticsearch`, capped 4 GB) | `postiz-qat-temporal` (+ `postiz-qat-elasticsearch`, capped 700 MB) |
| Storage | R2 bucket `postiz` | the **same** bucket |
| Image tag now | `v1.0.9-sociobird` | `v1.0.9-sociobird` |

Coolify admin: https://admin.shackyapps.in (token supplied by the user at runtime).
Coolify version at the time of writing exposes no live memory metrics or exec endpoint in its API.

## Servers (Coolify)

| Server | Size | Hosts |
|---|---|---|
| **SM-L4** | 8 CPU, 33.7 GB | production SocioBird, StreamBird, gmapssaas, socialize, Botsab, sociobird-site |
| **ShackyApps.in** | 2 CPU, 8.3 GB | QAT SocioBird, khata, forms, films, janata-test, the docs site (shackyapps-landing) |
| **localhost** | 2 CPU, 8.3 GB | Coolify itself, janata, lingayatjagar, volunteer-connect, wp-mcp |

Memory check on 2026-10-10 (from `docker stats` pasted by the user):
- SM-L4: containers about 5.9 GiB; `free` shows 24 GiB available, swap untouched. Largest: production Elasticsearch 2.6 GiB, production app 1.8 GiB.
- localhost: containers about 2.9 GiB of 8.3 GB (janata api/web 1.2 GiB, Coolify 0.8 GiB). `free -h` not captured.
- ShackyApps.in: not measured yet.

To re-check, run on the server: the `docker stats` + `awk` one-liner (convert to MiB, sort) and `free -h`.

## Image and deploy history

| Tag | From | Notes |
|---|---|---|
| `v1.0.5-sociobird` | `3d1c2a1` (#7) | good; ran in production for days; the rollback target during the incident |
| `v1.0.6-sociobird` | `2a40dee` (#8) | **bad**: orchestrator silent on QAT |
| `v1.0.7-sociobird` | `eb2b53a` (#10) | boots on QAT; **failed on production** (orchestrator never started) |
| `sha-eb2b53a3` | `eb2b53a` | failed on production Oct 4 to 6 |
| `hc-test` | branch build with a health-check script | QAT experiment only |
| `v1.0.8-sociobird` | `8bbfa83` (main after reverting #10 to #12) | first attempt failed to pull (containerd layer error), second succeeded Oct 9; production Oct 9 14:28 UTC |
| `v1.0.9-sociobird` | `1d3cc3e` (#15 public multipart uploads) | QAT then production Oct 9 15:51 UTC. Current |

## Incident: scheduled posts did not publish (Oct 4 to 6, 2026)

- **Symptom:** posts scheduled for 08:30 IST were not published. PM2 showed the orchestrator "online" but it logged nothing
  (no `Starting Nest application`); Temporal task queues never started and the idle ones unloaded.
- **Cause of the missed posts:** the worker never polled after production moved to a new image. Rolled back to `v1.0.5-sociobird` (about 8 minutes without a worker in one case).
- **Root cause: unresolved.** The same compiled code booted on QAT and on a clean CI container. It only hung on production.
  `v1.0.8` and `v1.0.9` booted normally on production, so it did not reproduce. Suspects not ruled out: something in the production
  environment (stale env vars such as an old `NEXT_PUBLIC_VERSION`, leftover `COOLIFY_*` vars), a startup race with `prisma db push`, or the host.
- **What was tried and removed:** a CI image build with a boot check (PRs #10, #11) and a Coolify health-check gate using a script in the image (#12)
  were built, tested on QAT (the gate keeps the old container when the new one is unhealthy), then **reverted** (#14) at the owner's request.
  Both are in git history if you want them back. A runbook for the gate lived outside the repo; the idea is: image contains `healthcheck.js` that
  hits `/health/status` on 3002, Coolify health check type `cmd`.
- **Standing advice:** deploy to QAT first, watch production boot logs for 3 minutes, re-check at 5 minutes, keep the previous tag ready.

## Manual subscriptions (super admin)

Use these to grant, change or take away a plan by hand, with no payment. The super admin impersonates the user (or sends the `impersonate` cookie/header);
both routes act on the impersonated user's organization. Bodies are JSON, cookie `auth` is the super admin's login.

```
POST /api/billing/add-subscription     {"subscription": "TEAM"}     # STANDARD (Solo) | TEAM | PRO (Agency) | ULTIMATE (Scale)
POST /api/billing/remove-subscription                               # only removes a manual subscription
```

- **`add-subscription`** is database-only: it sets the tier, adjusts channels/team members, and writes a subscription row with a `manual_...` identifier, MONTHLY, no expiry.
  Calling it again on an org that has a manual subscription **changes the tier** (upgrade or downgrade). It **refuses** an unknown tier and refuses an org that has a real
  Razorpay/Stripe/RevenueCat or lifetime subscription (it used to overwrite it and orphan the paid one).
- **`remove-subscription`** removes a manual subscription only: downgrades to FREE (disables all channels, disables non-admin team members, terminates autopost workflows),
  deletes the row and clears the placeholder `paymentId`. A real subscription is refused with a message to cancel it at its provider.
- **In the app:** impersonate the user, then use the red **Manage Billing** modal (lists charges, **Cancel subscription**, Apply coupon) and the **ADD ... SUBSCRIPTION** dropdown.
  Both show the server's reason in a toast when a request is refused (they used to reload silently).
- **`POST /billing/cancel-subscription`** (the modal's Cancel button) ends the plan immediately: a manual subscription is removed (same as `remove-subscription`);
  a real Razorpay subscription is cancelled at Razorpay (if Razorpay fails and the subscription is still live, nothing is deleted) and the row removed.
  Lifetime plans are refused. **`GET /billing/charges`** lists the paid Razorpay invoices (empty for manual plans). **`refund-charges`** is not available on Razorpay (use the
  Razorpay dashboard) and **`coupon-info`** answers `supported: false`. On Stripe orgs these routes behave as before.
- **After removal, adding or upgrading again works** (`add-subscription` again, or the user pays through checkout), but know what is *not* restored:
  channels disabled by the downgrade stay disabled (re-enable them in the app; the plan's channel limit applies), and autopost items need to be switched on again.
  Team members are re-enabled automatically when going back to a team tier.
- A manual subscription has no Razorpay subscription behind it, so the user's own "cancel" in billing fails (Razorpay is asked to cancel an id it does not know).
  Remove it with `remove-subscription`.
- Never paste a `curl` with cookies into chat: the `auth` token is a super-admin credential that does not expire.

## Runbook: "posts did not publish"

1. Production app logs: is there `Starting Nest application`, `Orchestrator health check listening`, and 34 `RUNNING` workers incl. `main`? If not, the orchestrator is down: roll back.
2. Temporal logs: queues `Started` after the last deploy? Any `Stopped` for `main`?
3. Calendar: is the post in an error state (expired channel token, rejected media)? Failure emails exist per user setting.
4. Only then look at provider-specific errors in the app logs.

## Known loose ends (check the log for status)

- Add an **R2 lifecycle rule** to abort incomplete multipart uploads after 1 to 2 days (cancelled mobile uploads leave parts behind). Owner task.
- Production Coolify env has stale entries (old `NEXT_PUBLIC_VERSION`, old `COOLIFY_CONTAINER_NAME`) and duplicated preview/normal entries.
- Rotate Coolify tokens and test-account passwords that were pasted into chat.
- QAT and production share one R2 bucket; test uploads on QAT land in the production bucket.
- Site FAQ says "New accounts start with a free trial": unverified against billing code.
- Dead Polotno leftovers: `apps/frontend/src/app/polonto.css` (imported by `global.scss`) and `NEXT_PUBLIC_POLOTNO` in `docker-compose.yaml`. Safe cleanup candidate (needs a frontend build to confirm).
- The Botsab tutorial video and the "Generate posts" video in the docs are incomplete.

## Giving an organization more X posts (manual)

X costs us money per post, so X posting has a monthly allowance with the plan (Solo 30, Team 100, Agency 300, Scale 1,000, Free none; a post with a link counts 10, links are removed from X posts by default). A customer who reaches it sees "X post allowance reached ... contact support".
1. Agree a price and collect payment yourself (for example a Razorpay payment link). Roughly: a post costs us about ₹1.3, charge at least ₹2 a post.
2. Impersonate the customer, open **Org options** in the bar, and under the X allowance enter the new monthly number, then **Set allowance**. The usage shown there is for the current calendar month.
3. The override stays until you press **Use plan allowance**, so put a reminder to reset it when the extra period ends.
