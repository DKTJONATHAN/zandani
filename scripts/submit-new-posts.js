#!/usr/bin/env node

/**
 * Build-time script that submits post URLs to IndexJump.
 *
 * Goals:
 * - Work on Cloudflare Workers Builds / CI (including shallow clones)
 * - Submit URLs for BOTH new posts and edited posts
 * - Fall back to submitting all posts if we can't determine a diff
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const INDEXJUMP_API_KEY = process.env.INDEXJUMP_API_KEY;
const SITE_URL = 'https://zandani.co.ke';

if (!INDEXJUMP_API_KEY) {
  console.log('⚠️  INDEXJUMP_API_KEY environment variable not set, skipping indexing');
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function toPostUrlFromFile(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  const slugMatch = content.match(/^slug:\s*["']?(.+?)["']?\s*$/m);
  const slug = slugMatch ? slugMatch[1] : path.basename(filePath, '.md').toLowerCase();
  return `${SITE_URL}/article/${slug}`;
}

async function submitBulk(urls) {
  // Docs: https://indexjump.com/api
  // POST https://api.indexjump.com/index/bulk?token=YOUR_TOKEN
  const bulkEndpoint = `https://api.indexjump.com/index/bulk?token=${INDEXJUMP_API_KEY}`;

  const res = await fetch(bulkEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bulk submit failed (${res.status}): ${text}`);
  }

  return res.json().catch(() => ({}));
}

async function submitSingle(url) {
  const indexUrl = `https://api.indexjump.com/index?url=${encodeURIComponent(url)}&token=${INDEXJUMP_API_KEY}`;
  const res = await fetch(indexUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Single submit failed (${res.status}): ${text}`);
  }
}

function getChangedMarkdownFilesFromGit() {
  // Prefer CF / CI SHAs when available, then fall back to HEAD~1.
  const prev = process.env.CF_PAGES_COMMIT_SHA
    ? null
    : (process.env.GITHUB_EVENT_BEFORE || null);
  const curr = process.env.CF_PAGES_COMMIT_SHA
    || process.env.GITHUB_SHA
    || null;

  const candidates = [];
  if (prev && curr) {
    candidates.push(`git diff --name-only ${prev} ${curr}`);
  }
  candidates.push('git diff --name-only HEAD~1 HEAD');

  for (const cmd of candidates) {
    try {
      const out = execSync(cmd, { encoding: 'utf8' }).trim();
      if (!out) return [];

      const changedFiles = out.split('\n').filter(Boolean);
      return changedFiles.filter((file) => file.includes('content/posts/') && file.endsWith('.md'));
    } catch (e) {
      // try next candidate
    }
  }

  return null; // indicates we couldn't diff
}

async function getAllMarkdownPosts() {
  const dir = path.resolve(process.cwd(), 'content/posts');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `content/posts/${e.name}`);
}

async function main() {
  console.log('🔍 IndexJump: preparing URL submission...');

  const changedPostFiles = getChangedMarkdownFilesFromGit();

  let postFiles = [];
  let strategy = '';

  if (Array.isArray(changedPostFiles)) {
    postFiles = changedPostFiles;
    strategy = 'git-diff';
  } else {
    // If we can't reliably compute a diff (shallow clone / first build / multiple commits),
    // submit ALL posts so edits are still re-crawled.
    postFiles = await getAllMarkdownPosts();
    strategy = 'full-resubmit-fallback';
  }

  if (postFiles.length === 0) {
    console.log('📝 No post changes detected; nothing to submit.');
    return;
  }

  const urls = await Promise.all(postFiles.map(toPostUrlFromFile));

  console.log(`🚀 Strategy: ${strategy}. Submitting ${urls.length} URL(s) to IndexJump...`);

  // Try bulk first (faster + fewer requests). If it fails, fall back to single URL calls.
  try {
    await submitBulk(urls);
    console.log(`✅ Bulk submitted ${urls.length} URL(s) to IndexJump`);
    return;
  } catch (err) {
    console.log(`⚠️  Bulk submit failed, falling back to single URL submits: ${err?.message || err}`);
  }

  let successful = 0;
  for (const url of urls) {
    try {
      await submitSingle(url);
      console.log(`✅ Indexed: ${url}`);
      successful++;
    } catch (error) {
      console.log(`❌ Failed: ${url} - ${error?.message || error}`);
    }

    // Keep under IndexJump's typical rate limits (docs mention 100/min).
    await sleep(700);
  }

  console.log(`\n📤 Successfully indexed ${successful}/${urls.length} post URL(s)`);
}

main().catch((e) => {
  console.error('❌ IndexJump submission script failed:', e?.message || e);
  process.exit(1);
});
