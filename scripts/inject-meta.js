import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const distDir = path.join(process.cwd(), 'dist');
const postsDir = path.join(process.cwd(), 'content/posts');
const indexHtmlPath = path.join(distDir, 'index.html');
const SITE_URL = 'https://zandani.co.ke';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

if (!fs.existsSync(indexHtmlPath)) {
  console.error('No dist/index.html found. Run vite build first.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase().trim()
    .replace(/[%']/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateValue(value) {
  const d = new Date(String(value || ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPublished(post) {
  const published = dateValue(post.publishDate || post.date);
  return published && published.getTime() <= Date.now();
}

function absoluteImage(image) {
  if (!image) return DEFAULT_IMAGE;
  return String(image).startsWith('http') ? String(image) : `${SITE_URL}${String(image).startsWith('/') ? '' : '/'}${image}`;
}

function cleanMeta(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/ig, '')
    .replace(/<meta[^>]*name=["']description["'][^>]*>/ig, '')
    .replace(/<meta[^>]*name=["']robots["'][^>]*>/ig, '')
    .replace(/<meta[^>]*property=["']og:title["'][^>]*>/ig, '')
    .replace(/<meta[^>]*property=["']og:description["'][^>]*>/ig, '')
    .replace(/<meta[^>]*property=["']og:image["'][^>]*>/ig, '')
    .replace(/<meta[^>]*property=["']og:url["'][^>]*>/ig, '')
    .replace(/<meta[^>]*property=["']og:type["'][^>]*>/ig, '')
    .replace(/<meta[^>]*name=["']twitter:title["'][^>]*>/ig, '')
    .replace(/<meta[^>]*name=["']twitter:description["'][^>]*>/ig, '')
    .replace(/<meta[^>]*name=["']twitter:image["'][^>]*>/ig, '')
    .replace(/<link[^>]*rel=["']canonical["'][^>]*>/ig, '');
}

function injectHead(html, meta) {
  return cleanMeta(html).replace(/<head>/i, `<head>\n${meta}`);
}

function injectRoot(html, bodyHtml) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${bodyHtml}</div>`);
}

function writeRoute(route, html) {
  const target = path.join(distDir, route.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
}

const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md'));
const posts = files.map((file) => {
  const raw = fs.readFileSync(path.join(postsDir, file), 'utf8');
  const parsed = matter(raw);
  const data = parsed.data || {};
  const slug = String(data.slug || file.replace(/\.md$/, '')).trim();
  const title = String(data.title || 'Za Ndani Article').trim();
  const description = String(data.description || data.excerpt || parsed.content.replace(/[#>*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)).trim();
  return {
    file,
    slug,
    title,
    description,
    image: absoluteImage(data.image),
    category: String(data.category || 'News').trim(),
    author: String(data.author || 'Za Ndani').trim(),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    date: data.date,
    publishDate: data.publishDate || data.date,
    dateModified: data.dateModified || data.updated || data.modified || data.date,
    body: parsed.content,
  };
}).filter(isPublished);

posts.sort((a, b) => (dateValue(b.publishDate)?.getTime() || 0) - (dateValue(a.publishDate)?.getTime() || 0));

const baseRoutes = [
  '/', '/about', '/contact', '/privacy', '/privacy-policy', '/terms',
  '/advertise', '/careers', '/ethics', '/corrections', '/fact-check',
  '/trending', '/news', '/entertainment', '/sports', '/business', '/lifestyle',
  '/sports/live', '/sitemap', '/authors', '/podcast', '/tv', '/energy',
  '/education', '/finance', '/live'
];

const staticMeta = {
  '/': ['Za Ndani | Kenya News, Gossip & Entertainment', 'Breaking Kenyan news, celebrity gossip, entertainment, politics and sports — delivered daily by Za Ndani.'],
  '/news': ['Kenya Breaking News | Za Ndani', 'Latest breaking news and national stories from Kenya.'],
  '/entertainment': ['Kenya Entertainment News | Za Ndani', 'Celebrity, music, television and entertainment news from Kenya and beyond.'],
  '/sports': ['Kenya Sports News | Za Ndani', 'Latest Kenyan sports news, football, athletics and major sporting updates.'],
  '/business': ['Kenya Business News | Za Ndani', 'Kenya economy, markets, business and financial news from Za Ndani.'],
  '/lifestyle': ['Kenya Lifestyle News | Za Ndani', 'Lifestyle, culture, health, travel and everyday life stories from Kenya.'],
  '/trending': ['Trending News Kenya | Za Ndani', 'The stories people are talking about across Kenya right now.'],
  '/about': ['About Za Ndani | Kenya News & Entertainment', 'Learn about Za Ndani, a Kenya-first digital publisher covering news and entertainment.'],
  '/contact': ['Contact Za Ndani', 'Contact the Za Ndani newsroom and editorial team.'],
  '/ethics': ['Editorial Ethics | Za Ndani', 'Za Ndani editorial standards and commitment to accurate reporting.'],
  '/corrections': ['Corrections Policy | Za Ndani', 'How Za Ndani handles corrections and updates to published stories.']
};

function genericPage(route) {
  const [title, description] = staticMeta[route] || [`${route.replace(/^\//, '').replace(/-/g, ' ')} | Za Ndani`, 'Za Ndani — Kenyan news, entertainment and current affairs.'];
  const url = `${SITE_URL}${route === '/' ? '' : route}`;
  const meta = `\n<title>${escapeHtml(title)}</title>\n<meta name="description" content="${escapeHtml(description)}">\n<link rel="canonical" href="${escapeHtml(url)}">\n<meta property="og:title" content="${escapeHtml(title)}">\n<meta property="og:description" content="${escapeHtml(description)}">\n<meta property="og:url" content="${escapeHtml(url)}">\n<meta property="og:type" content="website">\n`;
  const links = posts.slice(0, 12).map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('');
  const body = `<main><section><h1>${escapeHtml(title.split(' | ')[0])}</h1><p>${escapeHtml(description)}</p><nav aria-label="Latest stories"><ul>${links}</ul></nav></section></main>`;
  return injectRoot(injectHead(baseHtml, meta), body);
}

for (const route of baseRoutes) writeRoute(route, genericPage(route));

const categoryNames = [...new Set(posts.map((p) => p.category))].sort();
for (const category of categoryNames) {
  const slug = slugify(category) || 'news';
  const route = `/category/${slug}`;
  const url = `${SITE_URL}${route}`;
  const items = posts.filter((p) => slugify(p.category) === slug).slice(0, 30);
  const list = items.map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a><time datetime="${escapeHtml(new Date(p.publishDate).toISOString())}">${escapeHtml(new Date(p.publishDate).toLocaleDateString('en-KE'))}</time></li>`).join('');
  const title = `${category} News | Za Ndani`;
  const description = `Latest ${category} news, breaking stories and updates from Kenya and around the world.`;
  const meta = `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(url)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:type" content="website">`;
  const body = `<main><section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><ul>${list}</ul></section></main>`;
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
  if (['news','entertainment','sports','business','lifestyle','politics'].includes(slug)) {
    writeRoute(`/${slug}`, injectRoot(injectHead(baseHtml, meta.replace(`/category/${slug}`, `/${slug}`)), body));
  }
}

const authors = [...new Set(posts.map((p) => p.author).filter(Boolean))];
for (const author of authors) {
  const slug = slugify(author);
  const route = `/author/${slug}`;
  const items = posts.filter((p) => p.author === author).slice(0, 30);
  const list = items.map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('');
  const title = `${author} | Za Ndani`;
  const description = `Stories by ${author} published by Za Ndani.`;
  const meta = `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${SITE_URL}${route}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${SITE_URL}${route}"><meta property="og:type" content="profile">`;
  const body = `<main><section><h1>${escapeHtml(author)}</h1><p>${escapeHtml(description)}</p><ul>${list}</ul></section></main>`;
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

const tags = [...new Set(posts.flatMap((p) => p.tags.map(slugify)).filter(Boolean))];
for (const tag of tags) {
  const route = `/tag/${tag}`;
  const items = posts.filter((p) => p.tags.some((t) => slugify(t) === tag)).slice(0, 30);
  const title = `${tag.replace(/-/g, ' ')} | Za Ndani`;
  const description = `Latest Za Ndani stories tagged ${tag.replace(/-/g, ' ')}.`;
  const meta = `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${SITE_URL}${route}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${SITE_URL}${route}"><meta property="og:type" content="website">`;
  const list = items.map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('');
  const body = `<main><section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><ul>${list}</ul></section></main>`;
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

// Search/admin/newsletter are application utilities, not search landing pages.
for (const route of ['/search', '/admin', '/newsletter']) {
  const title = `${route.slice(1) || 'Home'} | Za Ndani`;
  const meta = `<title>${escapeHtml(title)}</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE_URL}${route}">`;
  writeRoute(route, injectHead(baseHtml, meta));
}

for (const post of posts) {
  const route = `/article/${post.slug}`;
  const url = `${SITE_URL}${route}`;
  const published = dateValue(post.publishDate) || new Date();
  const modified = dateValue(post.dateModified) || published;
  const categorySlug = slugify(post.category) || 'news';
  const authorSlug = slugify(post.author) || 'za-ndani';
  const description = post.description || post.title;
  const articleHtml = marked.parse(post.body || '');
  const related = posts.filter((p) => p.slug !== post.slug && (slugify(p.category) === categorySlug || p.tags.some((tag) => post.tags.includes(tag)))).slice(0, 6);
  const relatedHtml = related.map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('');
  const body = `<main><article><header><p><a href="/category/${categorySlug}">${escapeHtml(post.category)}</a></p><h1>${escapeHtml(post.title)}</h1><p>${escapeHtml(description)}</p><p>By <a href="/author/${authorSlug}">${escapeHtml(post.author)}</a> · <time datetime="${published.toISOString()}">${published.toLocaleString('en-KE')}</time></p><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" width="1200" height="630" loading="eager"></header><div class="article-body">${articleHtml}</div><footer><h2>More from Za Ndani</h2><ul>${relatedHtml}</ul></footer></article></main>`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: post.title,
    description, image: [post.image], datePublished: published.toISOString(), dateModified: modified.toISOString(),
    author: { '@type': 'Person', name: post.author, url: `${SITE_URL}/author/${authorSlug}` },
    publisher: { '@type': 'Organization', name: 'Za Ndani', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  };
  const meta = `<title>${escapeHtml(post.title)} | Za Ndani</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><link rel="canonical" href="${escapeHtml(url)}"><meta property="og:title" content="${escapeHtml(post.title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(post.image)}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:type" content="article"><meta property="article:published_time" content="${published.toISOString()}"><meta property="article:modified_time" content="${modified.toISOString()}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(post.title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(post.image)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

// A real 404 response prevents Cloudflare's old SPA fallback from turning unknown URLs into soft-404s.
const notFound = `<!doctype html><html lang="en-KE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Za Ndani</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}/"></head><body><main><h1>Page not found</h1><p>The page you requested does not exist.</p><p><a href="/">Return to Za Ndani</a></p></main></body></html>`;
fs.writeFileSync(path.join(distDir, '404.html'), notFound, 'utf8');

console.log(`SEO prerender complete: ${posts.length} published articles, ${categoryNames.length} categories, ${authors.length} authors.`);
