#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const SITE_URL = 'https://zandani.co.ke';
const PUBLICATION_NAME = 'Za Ndani';
const postsDir = path.resolve(process.cwd(), 'content/posts');
const publicDir = path.resolve(process.cwd(), 'public');
const distDir = path.resolve(process.cwd(), 'dist');
const SITE_ORIGIN = new URL(SITE_URL).origin;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026apos;');
}
function slugify(value) { return String(value || '').toLowerCase().trim().replace(/[%']/g, ' ').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function dateValue(value) { const d = new Date(String(value || '')); return Number.isNaN(d.getTime()) ? null : d; }
function publishedAt(data) { return dateValue(data.publishDate || data.date); }
function stripMarkdown(value) { return String(value || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_~`]/g, ' ').replace(/\s+/g, ' ').trim(); }
function description(data, body) { return String(data.description || data.excerpt || stripMarkdown(body)).trim().slice(0, 300); }
function canonicalPath(pathname) {
  const clean = `/${String(pathname || '').replace(/^\/+/, '')}`;
  return clean === '/' ? '/' : clean.replace(/\/+$/, '');
}
function canonicalUrl(pathname) { return `${SITE_ORIGIN}${canonicalPath(pathname)}`; }
function assertCanonical(url) {
  const parsed = new URL(url);
  if (parsed.origin !== SITE_ORIGIN || parsed.search || parsed.hash) throw new Error(`Invalid canonical URL generated: ${url}`);
  return url;
}

async function loadPosts() {
  const files = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(postsDir, file), 'utf8');
      const parsed = matter(raw); const data = parsed.data || {};
      const published = publishedAt(data);
      if (!published || published.getTime() > Date.now()) continue;
      const slug = String(data.slug || file.replace(/\.md$/, '')).trim();
      if (!slug || slugify(slug) !== slug) throw new Error(`Invalid slug; use a URL-safe slug: ${slug}`);
      if (!data.title || !data.category || !data.author || !(data.publishDate || data.date)) {
        throw new Error('Missing required publication metadata');
      }
      const modified = dateValue(data.dateModified || data.updated || data.modified) || published;
      posts.push({ file, slug, title: String(data.title).trim(), description: description(data, parsed.content), category: String(data.category).trim(), author: String(data.author).trim(), tags: Array.isArray(data.tags) ? data.tags.map(String) : [], image: String(data.image || '').trim(), date: published, lastmod: modified });
    } catch (error) { console.warn(`Skipping ${file}: ${error.message}`); }
  }
  return posts.sort((a, b) => b.date - a.date);
}
function urlBlock(pathname, lastmod) { return `  <url><loc>${escapeXml(assertCanonical(canonicalUrl(pathname)))}</loc><lastmod>${lastmod.toISOString()}</lastmod></url>`; }
function urlset(blocks, extra = '') { return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extra}>\n${blocks.join('\n')}\n</urlset>\n`; }
function staticSitemap() {
  const paths = ['/', '/news', '/entertainment', '/sports', '/business', '/lifestyle', '/about', '/contact', '/privacy', '/terms', '/ethics', '/corrections', '/authors', '/tv'];
  const now = new Date(); return urlset(paths.map((p) => urlBlock(p, now)));
}
function categoriesSitemap(posts) {
  const map = { news: '/news', politics: '/news', opinions: '/news', showbiz: '/entertainment', entertainment: '/entertainment', gossip: '/entertainment', sports: '/sports', business: '/business', lifestyle: '/lifestyle' };
  const dests = [...new Set([...posts.map((p) => map[slugify(p.category)]).filter(Boolean), '/news', '/entertainment', '/sports', '/business', '/lifestyle'])];
  const now = new Date();
  return urlset(dests.map((p) => urlBlock(p, now)));
}
function articlesSitemap(posts) { return urlset(posts.map((p) => urlBlock(`/article/${encodeURIComponent(p.slug)}`, p.lastmod || p.date))); }
function tagsSitemap() { return urlset([]);
}
function newsSitemap(posts) { const cutoff = Date.now() - 48 * 60 * 60 * 1000; const recent = posts.filter((p) => p.date.getTime() >= cutoff).slice(0, 1000); const blocks = recent.map((p) => `  <url><loc>${escapeXml(assertCanonical(canonicalUrl(`/article/${encodeURIComponent(p.slug)}`)))}</loc><news:news><news:publication><news:name>${escapeXml(PUBLICATION_NAME)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${p.date.toISOString()}</news:publication_date><news:title>${escapeXml(p.title)}</news:title></news:news></url>`); return urlset(blocks, ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"'); }
function sitemapIndex(posts) {
  const latest = posts.reduce((max, p) => Math.max(max, (p.lastmod || p.date).getTime()), 0);
  const now = new Date(latest || Date.now()).toISOString();
  const files = ['sitemap-static.xml', 'sitemap-categories.xml', 'sitemap-articles.xml', 'news-sitemap.xml'];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((file) => `  <sitemap><loc>${escapeXml(assertCanonical(canonicalUrl(`/${file}`)))}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
}
function rss(posts) { const items = posts.slice(0, 100).map((p) => { const url = canonicalUrl(`/article/${encodeURIComponent(p.slug)}`); return `    <item><title><![CDATA[${p.title}]]></title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${p.date.toUTCString()}</pubDate><dc:creator><![CDATA[${p.author}]]></dc:creator><description><![CDATA[${p.description}]]></description></item>`; }).join('\n'); return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${escapeXml(PUBLICATION_NAME)}</title><link>${SITE_URL}</link><description>Kenya and world news, politics, sports and entertainment.</description><language>en-KE</language><atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>\n${items}\n</channel></rss>\n`; }
function robots() { return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /search\nDisallow: /search?\nDisallow: /admin\nDisallow: /newsletter\nDisallow: /*?page=\nDisallow: /tag/\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /search\nDisallow: /admin\nDisallow: /newsletter\nDisallow: /api/\nDisallow: /tag/\n\nUser-agent: Bingbot\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\nSitemap: ${SITE_URL}/news-sitemap.xml\n`; }
function llms(posts) { const recent = posts.slice(0, 20).map((p) => `- [${p.title}](${canonicalUrl(`/article/${encodeURIComponent(p.slug)}`)}): ${p.description}`).join('\n'); return `# Za Ndani\n\nSite: ${SITE_URL}\nLanguage: en-KE\nPublisher: Za Ndani (Nairobi, Kenya)\n\n## Sections\n- [Home](${SITE_URL}/)\n- [News](${SITE_URL}/news)\n- [Entertainment](${SITE_URL}/entertainment)\n- [Sports](${SITE_URL}/sports)\n- [Business](${SITE_URL}/business)\n- [Lifestyle](${SITE_URL}/lifestyle)\n\n## Recent stories\n${recent}\n\n## Discovery\n- Sitemap: ${SITE_URL}/sitemap.xml\n- News sitemap: ${SITE_URL}/news-sitemap.xml\n- RSS: ${SITE_URL}/feed.xml\n`; }
async function writeBoth(name, content) { await fs.mkdir(publicDir, { recursive: true }); await fs.mkdir(distDir, { recursive: true }); await Promise.all([fs.writeFile(path.join(publicDir, name), content, 'utf8'), fs.writeFile(path.join(distDir, name), content, 'utf8')]); }

const posts = await loadPosts();
console.log(`SEO: ${posts.length} published posts included.`);
await writeBoth('sitemap-static.xml', staticSitemap());
await writeBoth('sitemap-categories.xml', categoriesSitemap(posts));
await writeBoth('sitemap-articles.xml', articlesSitemap(posts));
await writeBoth('sitemap-tags.xml', tagsSitemap());
await writeBoth('news-sitemap.xml', newsSitemap(posts));
await writeBoth('sitemap.xml', sitemapIndex(posts));
await writeBoth('feed.xml', rss(posts));
await writeBoth('robots.txt', robots());
await writeBoth('llms.txt', llms(posts));
console.log('SEO assets generated.');
