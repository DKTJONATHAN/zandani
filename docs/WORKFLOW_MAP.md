# Za Ndani — automation control map

Automation scheduling and run history are managed server-side. The public repository contains only deployment/version-control definitions and article output.

## Nairobi clock (EAT)

| Desk | Cadence |
|------|---------|
| News | Hourly |
| Ghafla | Every 2 hours |
| Mpasho | Every 2 hours |
| Entertainment | Every 2 hours |
| Africa | Twice daily |
| Agriculture | Twice weekly |
| Business | Twice daily |
| Lifestyle | Twice weekly |
| Opinions | Twice weekly |
| Sports | Twice daily |
| Technology | Twice daily |
| Diano | Twice daily |
| Jaj | Monday + Thursday |

## Editorial contract

The source is research material, not an article template. Content generation uses GAP/angle analysis, independent article structure, freshness checks, source-body similarity checks, factual safeguards and image-quality gates.

Run metadata, model version, prompt version, GAP version and image-pipeline version are retained server-side for future upgrades and rollback.

The administrator can manually trigger desks from the admin panel. Scheduling and execution state are not stored in repository JSON files.
