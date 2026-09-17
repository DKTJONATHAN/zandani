# Admin Desk Scheduler (Africa/Nairobi)

Autonomous, alarm-style dispatcher that triggers GitHub Actions desk workflows from the Cloudflare Worker using **Africa/Nairobi** time. GitHub Actions `schedule` entries remain as a fallback.

## Architecture

| Layer | Role |
|-------|------|
| Cloudflare Cron (`* * * * *`) | Wakes the Worker every minute (UTC). |
| `worker.js` `scheduled()` | Interprets desk crons in **Africa/Nairobi** and dispatches due workflows. |
| Admin UI `/admin` → **Scheduler** | Live clock, desk cards, manual trigger, dispatch log. |
| GitHub files | `data/scheduler-state.json`, `data/scheduler-log.json` |

## Configure secrets

In Cloudflare Dashboard → Workers → **zandani** → Settings → Variables:

| Name | Required | Description |
|------|----------|-------------|
| `PERSONAL_GITHUB_TOKEN` | Yes | PAT with `actions:write` + `contents:write` on `DKTJONATHAN/zandani` |
| `USE_ADMIN_SCHEDULER` | No | `true` (default) or `false` to disable Worker-side dispatch |

Classic PAT scopes: `repo` + `workflow`. Fine-grained: Actions (Read and write), Contents (Read and write).

## Enable / disable

- **Primary (Worker):** `USE_ADMIN_SCHEDULER=true` (default). Cron fires desks at minute `0` EAT (hourly news; every 2h entertainment).
- **Fallback only:** set `USE_ADMIN_SCHEDULER=false`. GitHub workflow `schedule` blocks still run.
- **Disable GitHub cron entirely:** remove or comment `on.schedule` in each `za-*.yml` after confirming Worker dispatches succeed.

## Desk map

- **Hourly (`0 * * * *` EAT):** news, sports, business, africa, agriculture, technology, opinions, diano, jaj  
- **Every 2 hours (`0 */2 * * *` EAT):** entertainment, mpasho, lifestyle, ghafla  

Config mirror: `config/desk-schedules.json`.

## Verify

1. Open `https://zandani.co.ke/admin` → **Scheduler**.
2. Confirm Nairobi clock and desk **Next** times.
3. Click **Trigger now** on one desk → GitHub → Actions should show a new run within seconds.
4. Check **Dispatch log** for HTTP 204/OK rows.
5. Optional: `curl -X POST https://zandani.co.ke/api/scheduler/tick`

## API

- `GET /api/scheduler/status`
- `GET /api/scheduler/logs?limit=50`
- `POST /api/scheduler/trigger/:desk`
- `POST /api/scheduler/tick`
