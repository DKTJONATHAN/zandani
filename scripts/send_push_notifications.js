#!/usr/bin/env node
/**
 * Send Web Push notifications for newly published posts.
 *
 * Env:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT          (e.g. mailto:brief@zandani.co.ke)
 *   GITHUB_TOKEN           (optional — read subs from GitHub if local file missing)
 *
 * Usage:
 *   node scripts/send_push_notifications.js              # detect new vs previous commit
 *   node scripts/send_push_notifications.js --slugs a,b  # explicit posts
 *   node scripts/send_push_notifications.js --dry-run
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const SUBS_PATH = path.join(ROOT, "data", "push_subscriptions.json");
const SITE = "https://zandani.co.ke";
const MAX_PER_RUN = 5;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false, slugs: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") out.dryRun = true;
    if (args[i] === "--slugs" && args[i + 1]) {
      out.slugs = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return out;
}

function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = raw.slice(3, end);
  const data = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    data[m[1]] = v;
  }
  return data;
}

function newPostFiles() {
  try {
    const diff = execSync("git diff --name-only --diff-filter=A HEAD~1 HEAD -- content/posts/", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (!diff) return [];
    return diff.split("\n").filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

function postsFromSlugs(slugs) {
  return slugs
    .map((slug) => {
      const candidates = [
        path.join(POSTS_DIR, `${slug}.md`),
        path.join(POSTS_DIR, slug.endsWith(".md") ? slug : `${slug}.md`),
      ];
      const file = candidates.find((p) => fs.existsSync(p));
      return file ? path.relative(ROOT, file).replace(/\\/g, "/") : null;
    })
    .filter(Boolean);
}

function loadSubscriptions() {
  if (fs.existsSync(SUBS_PATH)) {
    const data = JSON.parse(fs.readFileSync(SUBS_PATH, "utf8"));
    return Array.isArray(data.subscriptions) ? data.subscriptions : [];
  }
  return [];
}

function payloadForPost(fileRel) {
  const abs = path.join(ROOT, fileRel);
  const fm = readFrontmatter(abs);
  if (!fm || !fm.title) return null;
  const slug = (fm.slug || path.basename(fileRel, ".md")).replace(/\.md$/, "");
  const category = fm.category || "News";
  const excerpt = (fm.excerpt || fm.description || "").slice(0, 120);
  return {
    title: fm.title.slice(0, 80),
    body: excerpt || `${category} · New on Za Ndani`,
    url: `${SITE}/article/${slug}`,
    category,
  };
}

async function main() {
  const opts = parseArgs();
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:brief@zandani.co.ke";

  if (!publicKey || !privateKey) {
    console.log("skip: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set");
    return 0;
  }

  let files = opts.slugs ? postsFromSlugs(opts.slugs) : newPostFiles();
  files = files.slice(0, MAX_PER_RUN);
  if (!files.length) {
    console.log("no new posts to notify");
    return 0;
  }

  const payloads = files.map(payloadForPost).filter(Boolean);
  if (!payloads.length) {
    console.log("no valid post payloads");
    return 0;
  }

  const subs = loadSubscriptions().filter(
    (s) => s && s.endpoint && s.keys && s.keys.p256dh && s.keys.auth
  );
  if (!subs.length) {
    console.log("no push subscriptions stored");
    return 0;
  }

  let webpush;
  try {
    webpush = require("web-push");
  } catch {
    console.error("web-push not installed — run: npm i web-push");
    return 1;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  console.log(`sending ${payloads.length} notification(s) to ${subs.length} device(s)`);

  const dead = new Set();
  let sent = 0;
  let failed = 0;

  for (const payload of payloads) {
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });
    for (const sub of subs) {
      if (dead.has(sub.endpoint)) continue;
      if (opts.dryRun) {
        sent += 1;
        continue;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          body,
          { TTL: 3600, urgency: "high" }
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const code = err.statusCode || err.statusCode === 0 ? err.statusCode : err.statusCode;
        if (code === 404 || code === 410) {
          dead.add(sub.endpoint);
        }
        console.warn("push fail", code || err.message);
      }
    }
  }

  console.log(`done sent=${sent} failed=${failed} dead=${dead.size}${opts.dryRun ? " (dry-run)" : ""}`);

  // Prune dead endpoints from local file (CI commit is optional)
  if (dead.size && fs.existsSync(SUBS_PATH) && !opts.dryRun) {
    try {
      const data = JSON.parse(fs.readFileSync(SUBS_PATH, "utf8"));
      data.subscriptions = (data.subscriptions || []).filter((s) => !dead.has(s.endpoint));
      data.updated = new Date().toISOString();
      fs.writeFileSync(SUBS_PATH, JSON.stringify(data, null, 2) + "\n");
      console.log(`pruned ${dead.size} dead subscription(s) locally`);
    } catch (e) {
      console.warn("prune failed", e.message);
    }
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
