const GSC_HTML = "google-site-verification: google4a7d26b466f41330.html\n";
const GSC_TXT = "968a6d115d3240a3acbc3448c398978d\n";

const GITHUB_OWNER = "DKTJONATHAN";
const GITHUB_REPO = "zandani";
const GITHUB_BRANCH = "main";
const SUBS_PATH = "data/subscribers.json";
const SCHED_STATE_PATH = "data/scheduler-state.json";
const SCHED_LOG_PATH = "data/scheduler-log.json";
const RESEND = "https://api.resend.com";
const SITE = "https://zandani.co.ke";
const FROM_DEFAULT = "Za Ndani <onboarding@resend.dev>";
const TZ = "Africa/Nairobi";

const DESKS = {
  // Hourly desks — staggered minutes (Africa/Nairobi)
  news: { label: "News", workflow: "za-news.yml", cron: "0 * * * *", cadence: "hourly at :00" },
  africa: { label: "East Africa", workflow: "za-africa.yml", cron: "12 * * * *", cadence: "hourly at :12" },
  agriculture: { label: "Agriculture", workflow: "za-agriculture.yml", cron: "24 * * * *", cadence: "hourly at :24" },
  diano: { label: "George Diano", workflow: "za-diano.yml", cron: "36 * * * *", cadence: "hourly at :36" },
  jaj: { label: "Jaj", workflow: "za-jaj.yml", cron: "48 * * * *", cadence: "hourly at :48" },
  // Every 2 hours — not the same cadence as news; staggered
  sports: { label: "Sports", workflow: "za-sports.yml", cron: "6 */2 * * *", cadence: "every 2h at :06" },
  business: { label: "Business", workflow: "za-business.yml", cron: "18 */2 * * *", cadence: "every 2h at :18" },
  technology: { label: "Technology", workflow: "za-technology.yml", cron: "30 */2 * * *", cadence: "every 2h at :30" },
  opinions: { label: "Opinions", workflow: "za-opinions.yml", cron: "42 */2 * * *", cadence: "every 2h at :42" },
  // Entertainment cluster — every 2 hours, different minutes
  entertainment: { label: "Entertainment", workflow: "za-entertainment.yml", cron: "8 */2 * * *", cadence: "every 2h at :08" },
  mpasho: { label: "Mpasho", workflow: "za-mpasho.yml", cron: "20 */2 * * *", cadence: "every 2h at :20" },
  lifestyle: { label: "Lifestyle", workflow: "za-lifestyle.yml", cron: "32 */2 * * *", cadence: "every 2h at :32" },
  ghafla: { label: "Ghafla", workflow: "za-ghafla.yml", cron: "44 */2 * * *", cadence: "every 2h at :44" },
};
