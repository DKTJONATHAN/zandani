import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const origin = 'https://zandani.co.ke';
const failures = [];
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && (entry.name === 'index.html' || entry.name.endsWith('.html'))) htmlFiles.push(file);
  }
}
function attr(tag, name) {
  const attributes = [...tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)];
  const found = attributes.find((match) => match[1].toLowerCase() === name.toLowerCase());
  return found ? (found[2] ?? found[3] ?? '') : null;
}
function pageFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { decoded = pathname; }
  const clean = decoded.replace(/\/+$/, '') || '/';
  const candidates = clean === '/'
    ? [path.join(dist, 'index.html')]
    : [path.join(dist, clean.slice(1), 'index.html'), path.join(dist, clean.slice(1) + '.html'), path.join(dist, clean.slice(1))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}
const redirectRules = fs.existsSync('public/_redirects')
  ? fs.readFileSync('public/_redirects', 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => line.split(/\s+/)).filter((parts) => parts.length >= 2 && !parts[0].includes(':'))
  : [];
const workerCategoryRedirects = {
  '/category/news': '/news', '/category/politics': '/news', '/category/national': '/news', '/category/opinions': '/news',
  '/category/entertainment': '/entertainment', '/category/gossip': '/entertainment', '/category/showbiz': '/entertainment', '/category/celebrity': '/entertainment', '/category/music': '/entertainment',
  '/category/sports': '/sports', '/category/sport': '/sports',
  '/category/business': '/business', '/category/finance': '/business', '/category/economy': '/business',
  '/category/lifestyle': '/lifestyle', '/category/fashion': '/lifestyle', '/category/health': '/lifestyle', '/category/travel': '/lifestyle',
  '/privacy-policy': '/privacy',
};
function oneHopRedirect(pathname) {
  if (workerCategoryRedirects[pathname]) return workerCategoryRedirects[pathname];
  const legacyArticle = pathname.match(/^\/article\/(.+?)-+$/);
  if (legacyArticle) return '/article/' + legacyArticle[1];
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '');
  const rule = redirectRules.find((parts) => parts[0] === pathname);
  return rule ? rule[1] : null;
}
function pageOrOneHopRedirect(pathname) {
  if (pageFile(pathname)) return true;
  const target = oneHopRedirect(pathname);
  return Boolean(target && pageFile(target));
}
function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
if (!fs.existsSync(dist)) throw new Error('dist/ does not exist. Run the production build first.');
walk(dist);

const titles = new Map();
const descriptionsSeen = new Map();
const canonicals = new Map();
let checkedPages = 0;
let checkedImages = 0;
let checkedLinks = 0;

for (const file of htmlFiles) {
  if (['404.html', 'app-shell.html', 'google4a7d26b466f41330.html'].includes(path.basename(file))) continue;
  const html = fs.readFileSync(file, 'utf8');
  const robots = [...html.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*>/gi)].map((m) => attr(m[0], 'content') || '').join(',').toLowerCase();
  if (robots.includes('noindex')) continue;

  const titlesOnPage = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  const descriptions = [...html.matchAll(/<meta\b[^>]*name=["']description["'][^>]*>/gi)];
  const canonicalTags = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)];
  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  const label = path.relative(dist, file);

  if (titlesOnPage.length !== 1 || !titlesOnPage[0][1].trim()) failures.push(label + ': expected exactly one non-empty title');
  if (descriptions.length !== 1 || !(attr(descriptions[0]?.[0] || '', 'content') || '').trim()) failures.push(label + ': expected exactly one non-empty meta description');
  if (canonicalTags.length !== 1) failures.push(label + ': expected exactly one canonical link');
  if (h1Count !== 1) failures.push(label + ': expected exactly one H1, found ' + h1Count);

  const descriptionText = attr(descriptions[0]?.[0] || '', 'content')?.trim();
  if (descriptionText) {
    if (descriptionsSeen.has(descriptionText)) failures.push(label + ': duplicate meta description also used by ' + descriptionsSeen.get(descriptionText));
    else descriptionsSeen.set(descriptionText, label);
  }

  const title = titlesOnPage[0]?.[1]?.replace(/<[^>]+>/g, '').trim();
  if (title) {
    if (titles.has(title)) failures.push(label + ': duplicate title also used by ' + titles.get(title));
    else titles.set(title, label);
  }
  if (canonicalTags.length === 1) {
    const href = attr(canonicalTags[0][0], 'href');
    try {
      const canonical = new URL(href, origin);
      if (canonical.origin !== origin || canonical.search || canonical.hash) failures.push(label + ': invalid canonical ' + href);
      if (canonicals.has(canonical.href)) failures.push(label + ': duplicate canonical also used by ' + canonicals.get(canonical.href));
      else canonicals.set(canonical.href, label);
    } catch { failures.push(label + ': malformed canonical URL'); }
  }

  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => { try { return JSON.parse(match[1]); } catch { failures.push(label + ': invalid JSON-LD'); return null; } })
    .filter(Boolean);
  const schemaTypes = jsonLd.flatMap((entry) => Array.isArray(entry['@graph']) ? entry['@graph'].map((node) => node['@type']) : [entry['@type']]).flat();
  const routePrefix = label.split(path.sep)[0];
  if (routePrefix === 'article' && (!schemaTypes.includes('NewsArticle') || !schemaTypes.includes('BreadcrumbList'))) failures.push(label + ': missing NewsArticle or BreadcrumbList schema');
  if (routePrefix === 'author' && !schemaTypes.includes('ProfilePage')) failures.push(label + ': missing ProfilePage schema');
  if (routePrefix === 'faq' && !schemaTypes.includes('FAQPage')) failures.push(label + ': missing FAQPage schema');
  if (routePrefix === 'category' && !schemaTypes.includes('BreadcrumbList')) failures.push(label + ': missing category breadcrumb schema');

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const alt = attr(match[0], 'alt');
    if (alt === null || !alt.trim()) failures.push(label + ': image is missing meaningful alt text: ' + match[0].slice(0, 140));
    checkedImages += 1;
    const src = attr(match[0], 'src');
    if (src && src.startsWith('/') && !src.startsWith('//')) {
      let localPath;
      try { localPath = decodeURIComponent(src.split('?')[0]); } catch { localPath = src.split('?')[0]; }
      const imagePath = path.join(dist, localPath.replace(/^\//, ''));
      if (!fs.existsSync(imagePath)) failures.push(label + ': missing local image ' + src);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1].trim();
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    let target;
    try { target = new URL(href, origin); } catch { failures.push(label + ': malformed link ' + href); continue; }
    if (target.origin !== origin) continue;
    if (!pageOrOneHopRedirect(target.pathname)) failures.push(label + ': broken internal link or redirect target ' + href);
    checkedLinks += 1;
  }
  checkedPages += 1;
}

for (const sitemap of ['sitemap.xml', 'sitemap-static.xml', 'sitemap-categories.xml', 'sitemap-articles.xml', 'news-sitemap.xml']) {
  const file = path.join(dist, sitemap);
  if (!fs.existsSync(file)) { failures.push('Missing generated sitemap: ' + sitemap); continue; }
  const xml = fs.readFileSync(file, 'utf8');
  if (!xml.startsWith('<?xml')) failures.push(sitemap + ': missing XML declaration');
  for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
    const url = decodeXml(match[1].trim());
    try {
      const parsed = new URL(url);
      if (parsed.origin !== origin) { failures.push(sitemap + ': off-site URL ' + url); continue; }
      if (parsed.pathname.endsWith('.xml')) {
        if (!fs.existsSync(path.join(dist, parsed.pathname.slice(1)))) failures.push(sitemap + ': missing child sitemap ' + parsed.pathname);
      } else if (!pageFile(parsed.pathname)) failures.push(sitemap + ': URL has no generated page ' + parsed.pathname);
    } catch { failures.push(sitemap + ': invalid URL ' + url); }
  }
}
const manifestFile = path.resolve('public/posts-manifest.json');
const authorFile = path.resolve('public/content/authors.json');
if (!fs.existsSync(manifestFile)) failures.push('Missing public/posts-manifest.json');
if (!fs.existsSync(authorFile)) failures.push('Missing generated public/content/authors.json');
if (fs.existsSync(manifestFile) && fs.existsSync(authorFile)) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const authors = JSON.parse(fs.readFileSync(authorFile, 'utf8'));
  for (const author of new Set(manifest.map((post) => post.author).filter(Boolean))) {
    if (!authors[author]?.bio?.trim()) failures.push('Published author has no unique editorial bio: ' + author);
    const profilePage = pageFile('/author/' + String(author).toLowerCase().trim().replace(/[%']/g, ' ').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'));
    if (!profilePage) failures.push('Published author has no generated profile page: ' + author);
  }
  for (const post of manifest) {
    if (!pageFile('/article/' + encodeURIComponent(post.slug))) failures.push('Published article has no prerendered page: ' + post.slug);
  }
}
if (!fs.existsSync(path.join(dist, 'content', 'authors.json'))) failures.push('Generated author profiles are not publicly served from /content/authors.json');

const robotsFile = path.join(dist, 'robots.txt');
if (!fs.existsSync(robotsFile)) failures.push('Missing robots.txt');
else {
  const robots = fs.readFileSync(robotsFile, 'utf8');
  if (!/User-agent:\s*Googlebot[\s\S]*?Allow:\s*\//i.test(robots)) failures.push('robots.txt does not explicitly allow Googlebot');
  if (!robots.includes(origin + '/sitemap.xml')) failures.push('robots.txt does not advertise the sitemap index');
}

console.log('SEO build audit: ' + checkedPages + ' indexable HTML pages, ' + checkedImages + ' images, ' + checkedLinks + ' internal links checked.');
if (failures.length) {
  failures.forEach((failure) => console.error('FAIL: ' + failure));
  console.error('SEO build audit failed with ' + failures.length + ' issue(s).');
  process.exit(1);
}
console.log('SEO build audit passed.');
