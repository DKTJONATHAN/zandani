import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content/posts');
const OUTPUT_FILE = path.join(process.cwd(), 'public/posts-manifest.json');
const RAW_POSTS_DIR = path.join(process.cwd(), 'public/raw-posts');

function calculateReadTime(content) {
  return Math.max(1, Math.ceil((content || '').split(/\s+/).filter(Boolean).length / 200));
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[#>\-*\d\.\s]+/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWhatWeKnow(body) {
  if (!body || !/what we know/i.test(body)) return body || '';
  const out = [];
  let skipping = false;
  for (const line of body.split('\n')) {
    const stripped = line.trim();
    if (/^#{2,3}\s*What we know:?\s*$/i.test(stripped)) { skipping = true; continue; }
    if (skipping) {
      if (!stripped || /^[-*+]\s+/.test(stripped)) continue;
      if (/^#{2,3}\s+/.test(stripped)) { skipping = false; out.push(line); continue; }
      skipping = false;
    }
    out.push(line);
  }
  return out.join('\n');
}

function truncateSnippet(text, maxLength = 155) {
  const cleaned = stripMarkdown(text);
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength + 1);
  const lastSentence = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
  if (lastSentence >= 90) return sliced.slice(0, lastSentence + 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
}

function buildSnippet(data, bodyContent) {
  const explicit = [data.description, data.excerpt].find((value) => typeof value === 'string' && value.trim() && !/what we know/i.test(value));
  if (explicit) return truncateSnippet(explicit);
  const paragraphs = stripWhatWeKnow(bodyContent || '')
    .split(/\n\s*\n/)
    .map((paragraph) => stripMarkdown(paragraph))
    .filter((paragraph) => paragraph && !paragraph.startsWith('##') && !/^what we know/i.test(paragraph) && paragraph.length > 40);
  return truncateSnippet(paragraphs[0] || bodyContent || '');
}

function safeTime(value) {
  const time = new Date(value || '').getTime();
  return Number.isNaN(time) ? 0 : time;
}

const now = Date.now();
if (!fs.existsSync(POSTS_DIR)) {
  console.error(`Posts directory not found: ${POSTS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith('.md'));
fs.rmSync(RAW_POSTS_DIR, { recursive: true, force: true });
fs.mkdirSync(RAW_POSTS_DIR, { recursive: true });

const manifest = [];
for (const file of files) {
  const source = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(source, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data || {};
  const bodyContent = parsed.content || '';
  const publishDate = data.publishDate || data.publish_date || data.date;
  const publishTime = safeTime(publishDate);

  if (!publishTime || publishTime > now) continue;

  const slug = String(data.slug || file.replace(/\.md$/, '')).trim();
  const category = String(data.category || 'News').trim();
  const author = String(data.author || 'Za Ndani').trim();
  const image = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : '/images/placeholder.jpg';
  const description = buildSnippet(data, bodyContent);

  fs.copyFileSync(source, path.join(RAW_POSTS_DIR, file));
  manifest.push({
    title: String(data.title || 'Untitled').trim(),
    slug,
    sourceFile: file,
    date: data.date || publishDate,
    publishDate,
    category,
    author,
    authorImage: data.authorImage || data.author_image || '',
    excerpt: description,
    description,
    image,
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
    readTime: calculateReadTime(bodyContent),
    featured: data.featured === true || data.featured === 'true',
    dateModified: data.dateModified || data.updated || data.modified || data.lastmod || data.date || publishDate,
    focusKeyword: data.focusKeyword || data.focus_keyword || '',
    wordCount: stripMarkdown(bodyContent).split(/\s+/).filter(Boolean).length,
  });
}

manifest.sort((a, b) => safeTime(b.publishDate) - safeTime(a.publishDate));
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Published ${manifest.length} due posts into manifest; future posts remain hidden.`);
