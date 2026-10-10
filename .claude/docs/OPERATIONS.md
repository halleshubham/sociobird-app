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
- The Botsab tutorial video and the "Generate posts" video in the docs are incomplete.
