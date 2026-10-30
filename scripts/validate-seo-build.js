import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const origin = 'https://zandani.co.ke';
const failures = [];
const warnings = [];
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && (entry.name === 'index.html' || entry.name.endsWith('.html'))) htmlFiles.push(file);
  }
}
function attr(tag, name) {
  const match = tag.match(new RegExp('\\\\b' + name + '\\\\s*=\\\\s*(["\\\\'])(.*?)\\\\1', 'i'));
  return match ? match[2] : null;
}
function pageFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { decoded = pathname; }
  const clean = decoded.replace(/\\\\/+$/, '') || '/';
  const candidates = clean === '/'
    ? [path.join(dist, 'index.html')]
    : [path.join(dist, clean.slice(1), 'index.html'), path.join(dist, clean.slice(1) + '.html'), path.join(dist, clean.slice(1))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}
function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
if (!fs.existsSync(dist)) throw new Error('dist/ does not exist. Run the production build first.');
walk(dist);

const titles = new Map();
const canonicals = new Map();
let checkedPages = 0;
let checkedImages = 0;
let checkedLinks = 0;

for (const file of htmlFiles) {
  if (path.basename(file) === '404.html') continue;
  const html = fs.readFileSync(file, 'utf8');
  const robots = [...html.matchAll(/<meta\\\\b[^>]*name=["']robots["'][^>]*>/gi)].map((m) => attr(m[0], 'content') || '').join(',').toLowerCase();
  if (robots.includes('noindex')) continue;

  const titlesOnPage = [...html.matchAll(/<title\\\\b[^>]*>([\\\\s\\\\S]*?)<\\\\/title>/gi)];
  const descriptions = [...html.matchAll(/<meta\\\\b[^>]*name=["']description["'][^>]*>/gi)];
  const canonicalTags = [...html.matchAll(/<link\\\\b[^>]*rel=["']canonical["'][^>]*>/gi)];
  const h1Count = [...html.matchAll(/<h1\\\\b/gi)].length;
  const label = path.relative(dist, file);

  if (titlesOnPage.length !== 1 || !titlesOnPage[0][1].trim()) failures.push(label + ': expected exactly one non-empty title');
  if (descriptions.length !== 1 || !(attr(descriptions[0]?.[0] || '', 'content') || '').trim()) failures.push(label + ': expected exactly one non-empty meta description');
  if (canonicalTags.length !== 1) failures.push(label + ': expected exactly one canonical link');
  if (h1Count !== 1) failures.push(label + ': expected exactly one H1, found ' + h1Count);

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

  for (const match of html.matchAll(/<img\\\\b[^>]*>/gi)) {
    const alt = attr(match[0], 'alt');
    if (alt === null || !alt.trim()) failures.push(label + ': image is missing meaningful alt text: ' + match[0].slice(0, 140));
    checkedImages += 1;
    const src = attr(match[0], 'src');
    if (src && src.startsWith('/') && !src.startsWith('//')) {
      const imagePath = path.join(dist, decodeURIComponent(src.split('?')[0]).replace(/^\\\\//, ''));
      if (!fs.existsSync(imagePath)) failures.push(label + ': missing local image ' + src);
    }
  }

  for (const match of html.matchAll(/<a\\\\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1].trim();
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    let target;
    try { target = new URL(href, origin); } catch { failures.push(label + ': malformed link ' + href); continue; }
    if (target.origin !== origin) continue;
    if (!pageFile(target.pathname)) failures.push(label + ': broken internal link ' + href);
    checkedLinks += 1;
  }
  checkedPages += 1;
}

for (const sitemap of ['sitemap.xml', 'sitemap-static.xml', 'sitemap-categories.xml', 'sitemap-articles.xml', 'news-sitemap.xml']) {
  const file = path.join(dist, sitemap);
  if (!fs.existsSync(file)) { failures.push('Missing generated sitemap: ' + sitemap); continue; }
  const xml = fs.readFileSync(file, 'utf8');
  if (!xml.startsWith('<?xml')) failures.push(sitemap + ': missing XML declaration');
  for (const match of xml.matchAll(/<loc>([\\\\s\\\\S]*?)<\\\\/loc>/gi)) {
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
const robotsFile = path.join(dist, 'robots.txt');
if (!fs.existsSync(robotsFile)) failures.push('Missing robots.txt');
else {
  const robots = fs.readFileSync(robotsFile, 'utf8');
  if (!/User-agent:\\\\s*Googlebot[\\\\s\\\\S]*?Allow:\\\\s*\\\\//i.test(robots)) failures.push('robots.txt does not explicitly allow Googlebot');
  if (!robots.includes(origin + '/sitemap.xml')) failures.push('robots.txt does not advertise the sitemap index');
}

console.log('SEO build audit: ' + checkedPages + ' indexable HTML pages, ' + checkedImages + ' images, ' + checkedLinks + ' internal links checked.');
if (warnings.length) warnings.forEach((warning) => console.warn('WARN: ' + warning));
if (failures.length) {
  failures.forEach((failure) => console.error('FAIL: ' + failure));
  console.error('SEO build audit failed with ' + failures.length + ' issue(s).');
  process.exit(1);
}
console.log('SEO build audit passed.');
