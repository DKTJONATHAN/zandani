import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const distDir = path.join(process.cwd(), 'dist');
const postsDir = path.join(process.cwd(), 'content/posts');
const indexHtmlPath = path.join(distDir, 'index.html');
const SITE_URL = 'https://zandani.co.ke';
// Neutral placeholder — never use the brand logo as a default article/OG image.
const DEFAULT_IMAGE = `${SITE_URL}/images/default-og.svg`;

if (!fs.existsSync(indexHtmlPath)) {
  console.error('No dist/index.html found. Run vite build first.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');
// Preserve the untouched Vite shell for Worker SSR; prerendered index.html is a crawler fallback.
fs.writeFileSync(path.join(distDir, 'app-shell.html'), baseHtml, 'utf8');
const authorProfilesPath = path.join(process.cwd(), 'public/content/authors.json');
const authorProfiles = fs.existsSync(authorProfilesPath) ? JSON.parse(fs.readFileSync(authorProfilesPath, 'utf8')) : {};

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
  const rawSlug = String(data.slug || file.replace(/\.md$/, '')).trim();
  const slug = slugify(rawSlug);
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
  '/', '/about', '/contact', '/privacy', '/terms',
  '/advertise', '/careers', '/ethics', '/corrections', '/fact-check',
  '/trending', '/news', '/entertainment', '/sports', '/business', '/lifestyle',
  '/sports/live', '/sitemap', '/authors', '/podcast', '/tv', '/energy',
  '/education', '/finance', '/live', '/faq', '/newsletter'
];

const staticMeta = {
  '/': ['Za Ndani | Kenya News, Politics, Sports & Entertainment', 'Independent-minded coverage of Kenya news, public affairs, business, sports, entertainment and culture, with context on the stories shaping everyday life.'],
  '/news': ['Kenya Breaking News & National Affairs | Za Ndani', 'Follow breaking news, national developments, public institutions and current affairs from Kenya, with clear context and timely updates.'],
  '/entertainment': ['Kenya Entertainment, Music & Celebrity News | Za Ndani', 'The latest on Kenyan entertainment, music, film, television, celebrity culture and the creative industries across East Africa.'],
  '/sports': ['Kenya Sports News, Football & Athletics | Za Ndani', 'Kenyan football, athletics and other sports coverage, including match reports, team developments and major international competitions.'],
  '/business': ['Kenya Business, Markets & Economy News | Za Ndani', 'Business and economic reporting on Kenyan companies, markets, entrepreneurship, finance, jobs and policy affecting consumers.'],
  '/lifestyle': ['Kenya Lifestyle, Culture & Society | Za Ndani', 'Stories on lifestyle, culture, wellbeing, travel and the social trends shaping how people live across Kenya.'],
  '/trending': ['Trending Stories in Kenya Today | Za Ndani', 'Explore developing and widely discussed stories across Kenya, from public affairs and entertainment to sport and culture.'],
  '/about': ['About Za Ndani | Our Newsroom & Editorial Mission', 'Learn about Za Ndani, its Kenya-focused coverage, editorial mission and approach to news, entertainment and public-interest reporting.'],
  '/contact': ['Contact the Za Ndani Newsroom | Story Tips & Enquiries', 'Contact Za Ndani with story tips, corrections, right-of-reply requests, editorial enquiries and partnership questions.'],
  '/privacy': ['Privacy Policy | Za Ndani', 'Read how Za Ndani handles website data, cookies, contact enquiries, newsletter subscriptions and privacy requests.'],
  '/privacy-policy': ['Privacy Policy | Za Ndani', 'Understand the information Za Ndani collects through its website, why it is used and how visitors can make privacy requests.'],
  '/terms': ['Terms of Use | Za Ndani', 'Review the terms that apply when accessing Za Ndani, using its website features and engaging with published content.'],
  '/advertise': ['Advertise with Za Ndani | Reach Kenyan Readers', 'Explore advertising and partnership enquiries with Za Ndani, a digital publisher covering Kenyan news, culture and entertainment.'],
  '/careers': ['Careers & Contributions | Za Ndani', 'Find out how to contact Za Ndani about editorial contributions, opportunities and collaboration with the newsroom.'],
  '/ethics': ['Editorial Ethics & Standards | Za Ndani', 'Read Za Ndani’s standards on accuracy, attribution, fairness, editorial independence, source protection and conflicts of interest.'],
  '/corrections': ['Corrections & Accountability Policy | Za Ndani', 'Learn how to report an error, how Za Ndani reviews corrections and how substantive changes to published stories are explained.'],
  '/fact-check': ['Fact-Check & Verification | Za Ndani', 'Explore Za Ndani’s approach to checking claims, evaluating sources and adding context to information circulating in public debate.'],
  '/sports/live': ['Live Sports Scores & Updates | Za Ndani', 'Follow live sports scores, fixtures and match updates through Za Ndani’s sports coverage.'],
  '/sitemap': ['HTML Sitemap | Za Ndani', 'Browse Za Ndani sections, editorial resources and recent articles through this human-readable site directory.'],
  '/authors': ['Za Ndani Authors & Editorial Desks | Meet the Contributors', 'Browse Za Ndani contributor profiles, editorial coverage areas and the latest stories published under each byline.'],
  '/podcast': ['Za Ndani Podcasts | Audio Stories & Conversations', 'Discover audio projects and podcast updates from Za Ndani covering Kenyan news, culture and current affairs.'],
  '/tv': ['Za Ndani TV | Video News & Entertainment', 'Watch video updates and visual stories from Za Ndani, covering Kenyan news, entertainment and culture.'],
  '/energy': ['Energy News & Policy in Kenya | Za Ndani', 'Follow energy, electricity, fuel, renewables and policy developments affecting households and businesses in Kenya.'],
  '/education': ['Education News & Policy in Kenya | Za Ndani', 'Follow education policy, schools, universities, examinations and developments affecting learners, families and educators in Kenya.'],
  '/finance': ['Personal Finance & Financial News | Za Ndani', 'Understand finance, money, banking, markets and economic decisions affecting individuals and businesses in Kenya.'],
  '/live': ['Live News Updates | Za Ndani', 'Follow developing news and live updates from Kenya and across the region as important stories unfold.'],
  '/faq': ['Frequently Asked Questions | Za Ndani', 'Answers about Za Ndani coverage, editorial standards, corrections, story tips, contributor bylines and how to contact the newsroom.'],
  '/newsletter': ['Za Ndani Briefing | Get the Latest Kenya News by Email', 'Sign up for the Za Ndani briefing for selected Kenyan news, public affairs, business, sports and entertainment stories delivered by email.']
};
function siteNavHtml() {
  const links = baseRoutes.filter((route) => route !== '/privacy-policy')
    .map((route) => {
      const label = route === '/' ? 'Home' : route.replace(/^\//, '').replace(/-/g, ' ').replace(/\//g, ' · ');
      return '<li><a href="' + route + '">' + escapeHtml(label) + '</a></li>';
    }).join('');
  return '<nav aria-label="Site sections"><ul>' + links + '</ul></nav>';
}

function genericPage(route) {
  const [title, description] = staticMeta[route] || [route.replace(/^\//, '').replace(/-/g, ' ') + ' | Za Ndani', 'Explore ' + route.replace(/^\//, '').replace(/-/g, ' ') + ' coverage from Za Ndani, including related news and useful context.'];
  const url = SITE_URL + (route === '/' ? '' : route);
  const meta = '\n<title>' + escapeHtml(title) + '</title>\n<meta name="description" content="' + escapeHtml(description) + '">\n<link rel="canonical" href="' + escapeHtml(url) + '">\n<meta property="og:title" content="' + escapeHtml(title) + '">\n<meta property="og:description" content="' + escapeHtml(description) + '">\n<meta property="og:url" content="' + escapeHtml(url) + '">\n<meta property="og:type" content="website">\n';
  const links = posts.slice(0, 12).map((p) => '<li><a href="/article/' + encodeURIComponent(p.slug) + '">' + escapeHtml(p.title) + '</a></li>').join('');
  let extra = '';
  if (route === '/authors') {
    extra = '<section><h2>Contributor profiles</h2><ul>' + [...new Set(posts.map((post) => post.author).filter(Boolean))].map((name) => { const profile = authorProfiles[name] || { name, role: 'Editorial Contributor' }; return '<li><a href="/author/' + slugify(name) + '">' + escapeHtml(name) + '</a> — ' + escapeHtml(profile.role || 'Contributor') + '</li>'; }).join('') + '</ul></section>';
  }
  if (route === '/newsletter') {
    extra = '<section><h2>Get the Za Ndani briefing</h2><p>Receive selected stories on Kenyan news, public affairs, business, sport and entertainment. Visit the newsletter page to manage your subscription.</p><p><a href="/newsletter">Open the newsletter sign-up</a></p></section>';
  }
  if (route === '/sitemap') {
    extra = '<section><h2>All published stories</h2><ul>' + posts.map((post) => '<li><a href="/article/' + encodeURIComponent(post.slug) + '">' + escapeHtml(post.title) + '</a></li>').join('') + '</ul></section>';
  }
  const pageLabel = route === '/' ? 'Home' : route.slice(1).replace(/-/g, ' ').replace(/\//g, ' · ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const breadcrumb = route === '/'
    ? ''
    : '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <span>' + escapeHtml(pageLabel) + '</span></nav>';
  const breadcrumbSchema = route === '/' ? '' : '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: pageLabel, item: url },
    ],
  }).replace(/</g, '\\u003c') + '</script>';
  const body = '<main>' + breadcrumb + '<section><h1>' + escapeHtml(title.split(' | ')[0]) + '</h1><p>' + escapeHtml(description) + '</p>' + siteNavHtml() + '<nav aria-label="Latest stories"><h2>Latest stories</h2><ul>' + links + '</ul></nav>' + extra + '</section></main>' + breadcrumbSchema;
  return injectRoot(injectHead(baseHtml, meta), body);
}
for (const route of baseRoutes) writeRoute(route, genericPage(route));

const categoryNames = [...new Set(posts.map((p) => p.category))].sort();
const sectionRoutes = {
  news: '/news', politics: '/news', national: '/news', opinions: '/news',
  entertainment: '/entertainment', gossip: '/entertainment', showbiz: '/entertainment', celebrity: '/entertainment', music: '/entertainment',
  sports: '/sports', sport: '/sports',
  business: '/business', finance: '/business', economy: '/business',
  lifestyle: '/lifestyle', fashion: '/lifestyle', health: '/lifestyle', travel: '/lifestyle',
};
const categoryGroups = new Map();
for (const post of posts) {
  const slug = slugify(post.category) || 'news';
  const route = sectionRoutes[slug] || '/category/' + slug;
  const group = categoryGroups.get(route) || [];
  group.push(post);
  categoryGroups.set(route, group);
}
for (const [route, groupPosts] of categoryGroups) {
  const label = route.startsWith('/category/')
    ? route.slice('/category/'.length).replace(/-/g, ' ')
    : route.slice(1).replace(/-/g, ' ');
  const title = (label.charAt(0).toUpperCase() + label.slice(1)) + ' News & Updates | Za Ndani';
  const description = 'Read the latest ' + label + ' reporting from Za Ndani, with news, developments and context from Kenya and the region.';
  const url = SITE_URL + route;
  const items = groupPosts.sort((a, b) => dateValue(b.publishDate) - dateValue(a.publishDate)).slice(0, 50);
  const list = items.map((p) => '<li><a href="/article/' + encodeURIComponent(p.slug) + '">' + escapeHtml(p.title) + '</a><time datetime="' + escapeHtml(new Date(p.publishDate).toISOString()) + '">' + escapeHtml(new Date(p.publishDate).toLocaleDateString('en-KE')) + '</time></li>').join('');
  const meta = '<title>' + escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '"><link rel="canonical" href="' + escapeHtml(url) + '"><meta property="og:title" content="' + escapeHtml(title) + '"><meta property="og:description" content="' + escapeHtml(description) + '"><meta property="og:url" content="' + escapeHtml(url) + '"><meta property="og:type" content="website">';
  const nav = siteNavHtml();
  const breadcrumb = '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <span>' + escapeHtml(label) + '</span></nav>';
  const schema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: label, item: url },
  ] };
  const body = '<main><section>' + breadcrumb + '<h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(description) + '</p>' + nav + '<ul>' + list + '</ul></section></main><script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script><script type="application/ld+json">' + JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') + '</script>';
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

const authors = [...new Set(posts.map((p) => p.author).filter(Boolean))];
for (const author of authors) {
  const slug = slugify(author);
  const route = '/author/' + slug;
  const items = posts.filter((p) => p.author === author).slice(0, 40);
  const profile = authorProfiles[author] || {
    name: author,
    role: 'Editorial Contributor',
    bio: author + ' contributes to Za Ndani coverage, with reporting focused on the subjects and context readers need to follow.',
    location: 'Kenya',
  };
  const role = profile.role || 'Contributing Writer';
  const bio = profile.bio || (author + ' contributes reporting and features for Za Ndani.');
  const title = author + ' | ' + role + ' | Za Ndani';
  const description = (bio + ' Read the latest stories by ' + author + ' on Za Ndani.').replace(/\s+/g, ' ').slice(0, 157).replace(/\s+\S*$/, '');
  const url = SITE_URL + route;
  const list = items.map((p) => '<li><a href="/article/' + encodeURIComponent(p.slug) + '">' + escapeHtml(p.title) + '</a></li>').join('');
  const isDesk = /desk/i.test(role);
  const entity = {
    '@type': 'Organization',
    name: author,
    description: bio,
    url,
    knowsAbout: role,
  };
  const schema = { '@context': 'https://schema.org', '@type': 'ProfilePage', name: title, url, description, mainEntity: entity };
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Authors', item: SITE_URL + '/authors' },
    { '@type': 'ListItem', position: 3, name: author, item: url },
  ] };
  const breadcrumb = '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/authors">Authors</a> / <span>' + escapeHtml(author) + '</span></nav>';
  const meta = '<title>' + escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '"><link rel="canonical" href="' + escapeHtml(url) + '"><meta property="og:title" content="' + escapeHtml(title) + '"><meta property="og:description" content="' + escapeHtml(description) + '"><meta property="og:url" content="' + escapeHtml(url) + '"><meta property="og:type" content="profile">';
  const body = '<main><article>' + breadcrumb + '<h1>' + escapeHtml(author) + '</h1><p><strong>' + escapeHtml(role) + '</strong></p><p>' + escapeHtml(bio) + '</p><nav aria-label="Site sections">' + siteNavHtml() + '</nav><section><h2>Latest stories by ' + escapeHtml(author) + '</h2><ul>' + list + '</ul></section><p><a href="/authors">Browse all Za Ndani contributors</a></p></article></main><script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>';
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

const faqItems = [
  { question: 'What does Za Ndani cover?', answer: 'Za Ndani publishes coverage of Kenyan news and public affairs, business, sports, entertainment, lifestyle and developments across the region.' },
  { question: 'How can I send a story tip or information to the newsroom?', answer: 'Send story tips, documents for editorial review and general newsroom enquiries to contact@zandani.co.ke. Include links or supporting context where available.' },
  { question: 'How do I report an error in a published story?', answer: 'Email contact@zandani.co.ke with the article link, the passage you believe is inaccurate and any supporting information. Za Ndani reviews correction requests under its published Corrections Policy.' },
  { question: 'How does Za Ndani handle corrections?', answer: 'When a substantive error is confirmed, the article is corrected and an explanatory correction note is added. Minor typographical fixes that do not change meaning may be corrected without a separate note.' },
  { question: 'How can I contact an editor or request a right of reply?', answer: 'Contact the newsroom at contact@zandani.co.ke and identify the article or issue concerned. Include the relevant facts, documents and a reliable way for the newsroom to follow up.' },
  { question: 'How can I find more stories by a contributor?', answer: 'Select the byline on an article or visit the Authors page to open a contributor profile and browse stories published under that byline.' },
  { question: 'Does advertising determine editorial coverage?', answer: 'Za Ndani’s published editorial standards state that editorial decisions are made independently and are not directed by advertisers, political interests or corporate partners.' },
];
const faqUrl = SITE_URL + '/faq';
const faqTitle = 'Frequently Asked Questions | Za Ndani';
const faqDescription = 'Answers about Za Ndani coverage, editorial standards, corrections, story tips, contributor bylines and how to contact the newsroom.';
const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map((item) => ({
  '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer },
})) };
const faqMeta = '<title>' + escapeHtml(faqTitle) + '</title><meta name="description" content="' + escapeHtml(faqDescription) + '"><link rel="canonical" href="' + faqUrl + '"><meta property="og:title" content="' + escapeHtml(faqTitle) + '"><meta property="og:description" content="' + escapeHtml(faqDescription) + '"><meta property="og:url" content="' + faqUrl + '"><meta property="og:type" content="website">';
const faqBody = '<main><nav aria-label="Breadcrumb"><a href="/">Home</a> / <span>Frequently asked questions</span></nav><h1>Frequently asked questions</h1><p>' + escapeHtml(faqDescription) + '</p>' + siteNavHtml() + '<section>' + faqItems.map((item) => '<article><h2>' + escapeHtml(item.question) + '</h2><p>' + escapeHtml(item.answer) + '</p></article>').join('') + '</section><p>For more detail, read our <a href="/ethics">Editorial Ethics</a> and <a href="/corrections">Corrections Policy</a>, or <a href="/contact">contact the newsroom</a>.</p></main><script type="application/ld+json">' + JSON.stringify(faqSchema).replace(/</g, '\\u003c') + '</script>';
writeRoute('/faq', injectRoot(injectHead(baseHtml, faqMeta), faqBody));
const tags = [...new Set(posts.flatMap((p) => p.tags.map(slugify)).filter(Boolean))];
for (const tag of tags) {
  const route = `/tag/${tag}`;
  const items = posts.filter((p) => p.tags.some((t) => slugify(t) === tag)).slice(0, 30);
  const title = `${tag.replace(/-/g, ' ')} | Za Ndani`;
  const description = `Latest Za Ndani stories tagged ${tag.replace(/-/g, ' ')}.`;
  const meta = `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE_URL}${route}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${SITE_URL}${route}"><meta property="og:type" content="website">`;
  const list = items.map((p) => `<li><a href="/article/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></li>`).join('');
  const body = `<main><section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><ul>${list}</ul></section></main>`;
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body));
}

// Search/admin/newsletter are application utilities, not search landing pages.
for (const route of ['/search', '/admin']) {
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
  const sectionRoutes = {
    news: '/news', politics: '/news', national: '/news', opinions: '/news',
    entertainment: '/entertainment', gossip: '/entertainment', showbiz: '/entertainment', celebrity: '/entertainment', music: '/entertainment',
    sports: '/sports', sport: '/sports', business: '/business', finance: '/business', economy: '/business',
    lifestyle: '/lifestyle', fashion: '/lifestyle', health: '/lifestyle', travel: '/lifestyle',
  };
  const categoryPath = sectionRoutes[categorySlug] || '/category/' + categorySlug;
  const authorSlug = slugify(post.author) || 'za-ndani';
  const authorProfile = authorProfiles[post.author] || { role: 'Editorial Contributor', bio: 'The ' + post.author + ' byline covers news and current affairs for Za Ndani.' };
  const description = post.description || post.title;
  const metaDescription = (description.toLowerCase().includes(post.title.toLowerCase()) ? description : post.title + '. ' + description).replace(/\s+/g, ' ').slice(0, 157).replace(/\s+\S*$/, '');
  const normalizedBody = (post.body || '').replace(/^#\s+/gm, '## ');
  const articleHtml = marked.parse(normalizedBody).replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
    let nextAttrs = attrs;
    if (!/\balt\s*=/.test(nextAttrs)) nextAttrs += ' alt="' + escapeHtml(post.title) + '"';
    else nextAttrs = nextAttrs.replace(/\balt\s*=\s*(["'])\s*\1/i, 'alt="' + escapeHtml(post.title) + '"');
    if (!/\bloading\s*=/.test(nextAttrs)) nextAttrs += ' loading="lazy"';
    if (!/\bdecoding\s*=/.test(nextAttrs)) nextAttrs += ' decoding="async"';
    if (!/\bwidth\s*=/.test(nextAttrs)) nextAttrs += ' width="800"';
    if (!/\bheight\s*=/.test(nextAttrs)) nextAttrs += ' height="450"';
    return '<img' + nextAttrs + '>';
  });
  const related = posts.filter((p) => p.slug !== post.slug && (slugify(p.category) === categorySlug || p.tags.some((tag) => post.tags.includes(tag)))).slice(0, 6);
  const relatedHtml = related.map((p) => '<li><a href="/article/' + encodeURIComponent(p.slug) + '">' + escapeHtml(p.title) + '</a></li>').join('');
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: post.category, item: SITE_URL + categoryPath },
    { '@type': 'ListItem', position: 3, name: post.title, item: url },
  ] };
  const authorSchema = {
    '@type': 'Organization',
    name: post.author,
    description: authorProfile.bio,
    url: SITE_URL + '/author/' + authorSlug,
  };
  const schema = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: post.title,
    description: metaDescription, image: [post.image], datePublished: published.toISOString(), dateModified: modified.toISOString(),
    author: authorSchema,
    publisher: { '@type': 'Organization', name: 'Za Ndani', url: SITE_URL, logo: { '@type': 'ImageObject', url: SITE_URL + '/logo.png' } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  };
  const breadcrumb = '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="' + categoryPath + '">' + escapeHtml(post.category) + '</a> / <span>' + escapeHtml(post.title) + '</span></nav>';
  const body = '<main><article>' + breadcrumb + '<header><h1>' + escapeHtml(post.title) + '</h1><p>' + escapeHtml(description) + '</p><p>By <a href="/author/' + authorSlug + '">' + escapeHtml(post.author) + '</a> · <time datetime="' + published.toISOString() + '">' + published.toLocaleString('en-KE') + '</time></p><img src="' + escapeHtml(post.image) + '" alt="' + escapeHtml(post.title) + '" width="1200" height="630" loading="eager" fetchpriority="high" decoding="async"></header><div class="article-body">' + articleHtml + '</div><footer><h2>More from Za Ndani</h2><ul>' + relatedHtml + '</ul></footer></article></main>';
  const meta = '<title>' + escapeHtml(post.title) + ' | Za Ndani</title><meta name="description" content="' + escapeHtml(metaDescription) + '"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><link rel="canonical" href="' + escapeHtml(url) + '"><meta property="og:title" content="' + escapeHtml(post.title) + '"><meta property="og:description" content="' + escapeHtml(metaDescription) + '"><meta property="og:image" content="' + escapeHtml(post.image) + '"><meta property="og:url" content="' + escapeHtml(url) + '"><meta property="og:type" content="article"><meta property="article:published_time" content="' + published.toISOString() + '"><meta property="article:modified_time" content="' + modified.toISOString() + '"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(post.title) + '"><meta name="twitter:description" content="' + escapeHtml(metaDescription) + '"><meta name="twitter:image" content="' + escapeHtml(post.image) + '">';
  const articleJsonLd = '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script><script type="application/ld+json">' + JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') + '</script>';
  writeRoute(route, injectRoot(injectHead(baseHtml, meta), body + articleJsonLd));
}

// A real 404 response prevents Cloudflare's old SPA fallback from turning unknown URLs into soft-404s.
const notFound = `<!doctype html><html lang="en-KE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Za Ndani</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}/"></head><body><main><h1>Page not found</h1><p>The page you requested does not exist.</p><p><a href="/">Return to Za Ndani</a></p></main></body></html>`;
fs.writeFileSync(path.join(distDir, '404.html'), notFound, 'utf8');

console.log(`SEO prerender complete: ${posts.length} published articles, ${categoryNames.length} categories, ${authors.length} authors.`);
