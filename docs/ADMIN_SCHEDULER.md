# Admin Desk Scheduler (Africa/Nairobi)

Autonomous, alarm-style dispatcher that reads the server-side desk schedule and triggers the currently deployed desk runner from the Cloudflare Worker using **Africa/Nairobi** time. Individual desk GitHub `schedule` entries have been removed; manual `workflow_dispatch` remains available during the migration.

## Architecture

| Layer | Role |
|-------|------|
| Cloudflare Cron (`* * * * *`) | Wakes the Worker every minute (UTC). |
| `worker.js` `scheduled()` | Interprets desk crons in **Africa/Nairobi** and dispatches due workflows. |
| Admin UI `/admin` → **Scheduler** | Live clock, desk cards, manual trigger, dispatch log. |
| Supabase | `automation_desks`, `automation_runs`, `automation_jobs` |

## Configure secrets

In Cloudflare Dashboard → Workers → **zandani** → Settings → Variables:

| Name | Required | Description |
|------|----------|-------------|
| `PERSONAL_GITHUB_TOKEN` or `ACTIONS_GITHUB_TOKEN` | Yes | PAT with `actions:write` + `contents:write` on `DKTJONATHAN/zandani` |
| `USE_ADMIN_SCHEDULER` | No | `true` (default) or `false` to disable Worker-side dispatch |

Classic PAT scopes: `repo` + `workflow`. Fine-grained: Actions (Read and write), Contents (Read and write).

## Enable / disable

- **Primary (Worker):** `USE_ADMIN_SCHEDULER=true` (default). Cloudflare wakes the Worker every minute; it dispatches each enabled desk at the exact Africa/Nairobi cron in `worker.js`.
- **Fallback only:** set `USE_ADMIN_SCHEDULER=false`. Desk schedules are not duplicated in GitHub.
- Desk schedules live in `worker.js`; `config/desk-schedules.json` is a documentation mirror. Keep them synchronized. The Celestine news workflow retains its hourly GitHub schedule as a separate fallback.

## Desk map

- **Twice weekly:** agriculture (Tue/Fri 07:00), lifestyle (Tue/Fri 12:00), opinions (Tue/Fri 16:00)  
- **Other desk cadences:** news, Africa, Diano, Jaj, sports, business, technology, entertainment, Mpasho and Ghafla follow their individual schedules in `config/desk-schedules.json`  

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
