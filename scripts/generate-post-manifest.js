import fs from 'fs';
import path from 'path';

const POSTS_DIR = path.join(process.cwd(), 'content/posts');
const OUTPUT_FILE = path.join(process.cwd(), 'public/posts-manifest.json');
const RAW_POSTS_DIR = path.join(process.cwd(), 'public/raw-posts');

function extractFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { data: {}, bodyContent: content };
  const data = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, bodyContent: match[2] };
}

function calculateReadTime(content) { return Math.max(1, Math.ceil((content || '').split(/\s+/).filter(Boolean).length / 200)); }

function stripMarkdown(text) {
  return String(text || '').replace(/!\[[^\]]*\]\([^)]+\)/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/^[#>\-*\d\.\s]+/gm, '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
}

function stripWhatWeKnow(body) {
  if (!body || !/what we know/i.test(body)) return body || '';
  const out = []; let skipping = false;
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
  const cleaned = stripMarkdown(text); if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength + 1);
  const lastSentence = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
  if (lastSentence >= 90) return sliced.slice(0, lastSentence + 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
}

function buildSnippet(data, bodyContent) {
  const explicit = [data.description, data.excerpt].find(v => typeof v === 'string' && v.trim() && !/what we know/i.test(v));
  if (explicit) return truncateSnippet(explicit);
  const paragraphs = stripWhatWeKnow(bodyContent || '').split(/\n\s*\n/).map(p => stripMarkdown(p)).filter(p => p && !p.startsWith('##') && !/^what we know/i.test(p) && p.length > 40);
  return truncateSnippet(paragraphs[0] || bodyContent || '');
}

function getSafeTime(dateStr) {
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? 0 : time;
}

const now = Date.now();
if (!fs.existsSync(POSTS_DIR)) { console.error(`Posts directory not found: ${POSTS_DIR}`); process.exit(1); }
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
fs.rmSync(RAW_POSTS_DIR, { recursive: true, force: true });
fs.mkdirSync(RAW_POSTS_DIR, { recursive: true });

const manifest = [];
for (const file of files) {
  const src = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(src, 'utf-8');
  const { data, bodyContent } = extractFrontmatter(raw);
  const publishDate = data.publishDate || data.publish_date || data.date;
  const publishTime = getSafeTime(publishDate);
  if (!publishTime || publishTime > now) continue;

  fs.copyFileSync(src, path.join(RAW_POSTS_DIR, file));
  const image = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : '/images/placeholder.jpg';
  const description = buildSnippet(data, bodyContent);
  manifest.push({
    title: data.title || 'Untitled', slug: data.slug || file.replace(/\.md$/, ''), sourceFile: file,
    date: data.date || publishDate, publishDate, category: data.category || 'News', author: data.author || 'Za Ndani',
    authorImage: data.authorImage || data.author_image || '', excerpt: description, description, image,
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []), readTime: calculateReadTime(bodyContent),
    featured: data.featured === true || data.featured === 'true',
    dateModified: data.dateModified || data.updated || data.modified || data.lastmod || data.date || publishDate,
    focusKeyword: data.focusKeyword || data.focus_keyword || '', wordCount: stripMarkdown(bodyContent).split(/\s+/).filter(Boolean).length,
  });
}

manifest.sort((a, b) => getSafeTime(b.publishDate) - getSafeTime(a.publishDate));
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Published ${manifest.length} due posts into manifest; future posts remain hidden.`);
