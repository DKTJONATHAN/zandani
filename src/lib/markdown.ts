import { marked } from 'marked';
import { extractWhatWeKnow } from './what-we-know';
import { cleanExcerpt } from './utils';
import manifestPosts from '../../public/posts-manifest.json';

export interface PostMetadata {
  title: string;
  slug: string;
  sourceFile?: string;
  excerpt: string;
  description?: string;
  image: string;
  category: string;
  author: string;
  authorImage?: string;
  date: string;
  publishDate?: string;
  tags: string[];
  readTime: number;
  featured?: boolean;
  dateModified?: string;
  focusKeyword?: string;
  wordCount?: number;
}

export interface Post extends PostMetadata {
  content: string;
  htmlContent: string;
  imageAlt: string;
  knowFacts: string[];
}

function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { data: {}, content };
  const data: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value: unknown = line.slice(colon + 1).trim();
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (typeof value === 'string' && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, content: match[2] };
}

function getSafeTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeCategory(rawCategory: string): string {
  const lower = (rawCategory || '').toLowerCase().trim();
  const map: Record<string, string> = {
    news: 'News', politics: 'News', national: 'News',
    entertainment: 'Entertainment', gossip: 'Entertainment', celebrity: 'Entertainment', 'celebrity gossip': 'Entertainment', showbiz: 'Entertainment', music: 'Entertainment',
    sports: 'Sports', sport: 'Sports',
    business: 'Business', finance: 'Business', economy: 'Business',
    lifestyle: 'Lifestyle', fashion: 'Lifestyle', health: 'Lifestyle', travel: 'Lifestyle',
    technology: 'Technology', tech: 'Technology', gadgets: 'Technology', innovation: 'Technology',
    agriculture: 'Agriculture', farming: 'Agriculture', agribusiness: 'Agriculture',
    africa: 'Africa', african: 'Africa',
    opinions: 'Opinions', opinion: 'Opinions',
    diano: 'Diano', jaj: 'JAJ',
  };
  return map[lower] || rawCategory || 'News';
}

function isPublished(post: PostMetadata): boolean {
  const publishTime = getSafeTime(post.publishDate || post.date);
  return publishTime > 0 && publishTime <= Date.now();
}

const ALL_POSTS: PostMetadata[] = (manifestPosts as unknown as PostMetadata[])
  .map(p => ({ ...p, category: normalizeCategory(p.category), excerpt: cleanExcerpt(p.excerpt || p.description || '', p.title), tags: Array.isArray(p.tags) ? p.tags : [] }))
  .filter(isPublished)
  .sort((a, b) => getSafeTime(b.publishDate || b.date) - getSafeTime(a.publishDate || a.date));

export function getAllPosts(): PostMetadata[] { return ALL_POSTS; }

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const metadata = ALL_POSTS.find(post => post.slug === slug);
  if (!metadata) return undefined;
  const fileName = metadata.sourceFile || `${slug}.md`;
  try {
    const res = await fetch(`/raw-posts/${encodeURIComponent(fileName)}`);
    if (!res.ok) return undefined;
    const rawContent = await res.text();
    const { content } = parseFrontmatter(rawContent);
    const { facts, body } = extractWhatWeKnow(content);
    return { ...metadata, content, htmlContent: marked(body) as string, knowFacts: facts, imageAlt: metadata.title };
  } catch (error) {
    console.error(`Error loading post content for ${slug}:`, error);
    return undefined;
  }
}

export function getFeaturedPosts(): PostMetadata[] { return getAllPosts().filter(post => post.featured); }
export function getLatestPosts(limit?: number): PostMetadata[] { const posts = getAllPosts(); return limit ? posts.slice(0, limit) : posts; }

export function getTodaysTopStory(): PostMetadata | undefined {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todays = getAllPosts().filter(post => {
    const value = post.publishDate || post.date;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) === today;
  });
  return todays[0];
}

export function getSecondaryPosts(excludeSlug: string | undefined, limit = 4): PostMetadata[] { return getAllPosts().filter(p => p.slug !== excludeSlug).slice(0, limit); }
export function getPostsByCategory(category: string): PostMetadata[] { return getAllPosts().filter(p => p.category.toLowerCase() === normalizeCategory(category).toLowerCase()); }

export function searchPosts(query: string, limit = 40): PostMetadata[] {
  const raw = query.toLowerCase().trim(); if (!raw || raw.length < 2) return [];
  const terms = raw.split(/\s+/).filter(Boolean);
  return getAllPosts().map(post => {
    const title = post.title.toLowerCase(); const excerpt = (post.excerpt || '').toLowerCase(); const tags = (post.tags || []).join(' ').toLowerCase(); const author = post.author.toLowerCase(); const cat = post.category.toLowerCase();
    let score = 0;
    for (const term of terms) { if (title.includes(term)) score += title.startsWith(term) ? 12 : 8; if (tags.includes(term)) score += 5; if (cat.includes(term)) score += 3; if (author.includes(term)) score += 2; if (excerpt.includes(term)) score += 2; }
    if (title.includes(raw)) score += 15; if (excerpt.includes(raw)) score += 4;
    return { post, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || getSafeTime(b.post.publishDate || b.post.date) - getSafeTime(a.post.publishDate || a.post.date)).slice(0, limit).map(x => x.post);
}

export function getRelatedPosts(post: Pick<PostMetadata, 'slug' | 'category' | 'tags' | 'title'>, limit = 6): PostMetadata[] {
  const tagSet = new Set((post.tags || []).map(t => t.toLowerCase()));
  const titleWords = new Set((post.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
  return getAllPosts().filter(p => p.slug !== post.slug).map(p => {
    let score = p.category.toLowerCase() === post.category.toLowerCase() ? 4 : 0;
    for (const tag of p.tags || []) if (tagSet.has(tag.toLowerCase())) score += 5;
    for (const word of p.title.toLowerCase().split(/[^a-z0-9]+/)) if (titleWords.has(word)) score += 1;
    const ageDays = (Date.now() - getSafeTime(p.publishDate || p.date)) / 86400000;
    if (ageDays < 2) score += 2; else if (ageDays < 7) score += 1;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || getSafeTime(b.p.publishDate || b.p.date) - getSafeTime(a.p.publishDate || a.p.date)).slice(0, limit).map(x => x.p);
}

export function getPostsByTag(tag: string): PostMetadata[] { const normalized = tag.toLowerCase().trim(); return getAllPosts().filter(p => p.tags.some(t => t.toLowerCase() === normalized)); }
export function getAllTags(): string[] { return [...new Set(getAllPosts().flatMap(p => p.tags))].sort(); }

export function generateSitemap(): string {
  const baseUrl = 'https://zandani.co.ke';
  const urls = getAllPosts().map(post => `<url><loc>${baseUrl}/article/${post.slug}</loc>${post.dateModified || post.publishDate || post.date ? `<lastmod>${post.dateModified || post.publishDate || post.date}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>${post.featured ? '0.9' : '0.8'}</priority></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export interface PodcastEpisode { slug: string; title: string; date: string; excerpt: string; audio_url: string; }
const podcastFiles = import.meta.glob('/content/briefings/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export function getAllPodcastEpisodes(): PodcastEpisode[] { return Object.entries(podcastFiles).map(([file, raw]) => { const { data } = parseFrontmatter(raw); const slug = file.split('/').pop()?.replace('.md', '') || ''; return { slug: data.slug as string || slug, title: data.title as string || '', date: data.date as string || '', excerpt: data.excerpt as string || '', audio_url: data.audio_url as string || '' }; }).sort((a, b) => getSafeTime(b.date) - getSafeTime(a.date)); }
export const getAllBriefings = getAllPodcastEpisodes;
export function getAllPostSlugs(): string[] { return getAllPosts().map(post => post.slug); }

export const categories = [
  { name: 'News', slug: 'news', description: 'Breaking news, politics and current affairs from Kenya and beyond' },
  { name: 'Entertainment', slug: 'entertainment', description: 'Celebrity news, music, movies and pop culture' },
  { name: 'Sports', slug: 'sports', description: 'Football, athletics and all things sports' },
  { name: 'Business', slug: 'business', description: 'Economy, startups, finance and business news' },
  { name: 'Technology', slug: 'technology', description: 'Technology, innovation, gadgets and digital life' },
  { name: 'Agriculture', slug: 'agriculture', description: 'Farming, agribusiness and food production' },
  { name: 'Africa', slug: 'africa', description: 'African news and developments' },
  { name: 'Lifestyle', slug: 'lifestyle', description: 'Fashion, health, travel and living well' },
  { name: 'Opinions', slug: 'opinions', description: 'Opinion, analysis and commentary' },
  { name: 'Diano', slug: 'diano', description: 'Diano desk stories' },
  { name: 'JAJ', slug: 'jaj', description: 'JAJ desk stories' },
];
