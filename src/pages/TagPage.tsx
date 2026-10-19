import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getPostsByTag } from "@/lib/markdown";
import { ChevronLeft, Tag, Eye, Clock, ChevronDown, TrendingUp } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useState, useEffect, useMemo } from "react";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

function proxyImg(url: string, w = 500): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;

  // FIXED: Using new RegExp string constructor to prevent esbuild parse errors
  const protocolRegex = new RegExp('^https?://');
  return url;
}

function timeAgo(dateStr: string): string {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return "Recently";

  const diff = Date.now() - dateObj.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return dateObj.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

const INITIAL_SHOW = 12;
const LOAD_MORE = 12;

// ═════════════════════════════════════════════════════════════════════════════
// TAG PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const decodedTag = tag ? decodeURIComponent(tag) : "";
  const posts = useMemo(() => getPostsByTag(decodedTag), [decodedTag]);

  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  useEffect(() => {
    fetch('/api/get-views').then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
  }, []);

  useEffect(() => { setVisibleCount(INITIAL_SHOW); }, [tag]);

  const postsWithViews = useMemo(() =>
    posts.map(post => {
      const clean = post.slug.replace(/^\//, '').replace(/\.md$/, '');
      const v = viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
      return { ...post, views: v };
    }),
    [posts, viewCounts]
  );

  const leadPost = postsWithViews[0];
  const feedPosts = postsWithViews.slice(1);
  const displayedFeed = feedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < feedPosts.length;

  const mostViewed = useMemo(() =>
    [...postsWithViews].sort((a, b) => b.views - a.views).slice(0, 6),
    [postsWithViews]
  );

  const displayTag = decodedTag
    .split(/[-_ ]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (!tag) return null;

  return (
    <Layout>
      <Helmet>
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />

        <title>#{displayTag} — Za Ndani | Kenya News & Entertainment</title>
        <meta name="description" content={`All stories tagged "${displayTag}" on Za Ndani — Kenya's sharpest news and entertainment site.`} />
        <link rel="canonical" href={`https://zandani.co.ke/tag/${tag}`} />
        <meta property="og:title" content={`#${displayTag} — Za Ndani`} />
        <meta property="og:description" content={`All ${postsWithViews.length} stories tagged "${displayTag}" on Za Ndani.`} />
        <meta property="og:url" content={`https://zandani.co.ke/tag/${tag}`} />
      </Helmet>

      {/* ── Header ── */}
      <section className="bg-zinc-950 border-b border-zinc-800">
        <div className="h-[3px] w-full bg-primary" />
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-xs text-zinc-600 mb-6">
            <Link to="/" className="flex items-center gap-1 hover:text-zinc-400 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Home
            </Link>
            <span>/</span>
            <span className="text-zinc-400">#{displayTag}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Tag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-serif font-black text-white leading-tight">
                  #{displayTag}
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  {postsWithViews.length} {postsWithViews.length === 1 ? "story" : "stories"} tagged
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {postsWithViews.length === 0 ? (
        <div className="container py-32 text-center">
          <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-serif italic mb-6">
            No articles found for "#{displayTag}".
          </p>
          <Link to="/" className="text-primary font-black text-sm uppercase tracking-wider hover:underline">
            ← Browse all stories
          </Link>
        </div>
      ) : (
        <section className="py-10 md:py-14 bg-background">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="grid lg:grid-cols-12 gap-10">

              {/* ── MAIN FEED ── */}
              <main className="lg:col-span-8 space-y-8">

                {leadPost && (
                  <div className="mb-2">
                    <Link to={`/article/${leadPost.slug}`}
                      className="group grid md:grid-cols-2 gap-0 border border-divider hover:border-primary transition-colors overflow-hidden">
                      <div className="relative overflow-hidden h-56 md:h-auto">
                        <img src={proxyImg(leadPost.image, 800)} alt={leadPost.title}
                          loading="eager"
                          className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20 hidden md:block" />
                        <span className={`absolute top-3 left-3 text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 ${catColor(leadPost.category)}`}>
                          {leadPost.category}
                        </span>
                        <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5">
                          <Eye className="w-3 h-3" />
                          {leadPost.views > 999 ? `${(leadPost.views / 1000).toFixed(1)}k` : leadPost.views}
                        </span>
                      </div>
                      <div className="p-6 md:p-8 bg-surface flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
                            Featured in #{displayTag}
                          </p>
                          <h2 className="text-xl md:text-2xl font-serif font-black leading-tight mb-3 group-hover:text-primary transition-colors">
                            {leadPost.title}
                          </h2>
                          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                            {leadPost.excerpt}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 mt-4 border-t border-divider">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(leadPost.date)}</span>
                            <span>{leadPost.author}</span>
                          </div>
                          <span className="text-primary font-black text-xs">Read →</span>
                        </div>
                      </div>
                    </Link>
                  </div>
                )}

                {displayedFeed.length > 0 && (
                  <div className="flex items-center gap-4">
                    <h2 className="text-base font-black uppercase tracking-tight text-muted-foreground">
                      All Stories
                      <span className="ml-2 text-foreground">{postsWithViews.length}</span>
                    </h2>
                    <div className="h-px flex-1 bg-divider" />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedFeed.map(post => (
                    <Link key={post.slug} to={`/article/${post.slug}`}
                      className="group block border border-divider hover:border-primary transition-colors overflow-hidden">
                      <div className="relative h-40 overflow-hidden">
                        <img src={proxyImg(post.image, 400)} alt={post.title} loading="lazy"
                          className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className={`absolute bottom-2 left-2 text-[9px] font-black uppercase tracking-wider text-white px-1.5 py-0.5 ${catColor(post.category)}`}>
                          {post.category}
                        </span>
                        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-zinc-300 bg-black/50 px-1.5 py-0.5">
                          <Eye className="w-3 h-3" />
                          {post.views > 999 ? `${(post.views / 1000).toFixed(1)}k` : post.views}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
                          {post.title}
                        </h3>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.date)}</span>
                          <span>{post.author}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => setVisibleCount(v => v + LOAD_MORE)}
                      className="group border-2 border-divider hover:border-primary hover:text-primary px-10 py-5 text-xs uppercase tracking-[0.2em] font-black transition-all inline-flex items-center gap-2"
                    >
                      Load More <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                    </button>
                  </div>
                )}

                {!hasMore && postsWithViews.length > 1 && (
                  <div className="py-16 text-center">
                    <p className="text-muted-foreground font-serif italic">
                      You've read all {postsWithViews.length} stories tagged #{displayTag} 🫖
                    </p>
                  </div>
                )}
              </main>

              {/* ── SIDEBAR ── */}
              <aside className="hidden lg:block lg:col-span-4">
                <div className="sticky top-24 space-y-8">
                  <div className="border border-divider">
                    <div className="h-1 w-full bg-primary" />
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-divider">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-black uppercase tracking-wider">
                        Most Read in #{displayTag}
                      </h3>
                    </div>
                    <div className="divide-y divide-divider">
                      {mostViewed.map((post, i) => (
                        <Link key={post.slug} to={`/article/${post.slug}`}
                          className="flex gap-3 items-start p-4 group hover:bg-muted/20 transition-colors">
                          <span className="text-2xl font-serif font-black text-muted-foreground/20 leading-none flex-shrink-0 w-6 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <span className={`text-[9px] font-black uppercase tracking-wider text-white px-1.5 py-0.5 mb-1 inline-block ${catColor(post.category)}`}>
                              {post.category}
                            </span>
                            <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1">
                              {post.title}
                            </h4>
                            <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
                              <Eye className="w-3 h-3" />
                              {post.views > 999 ? `${(post.views / 1000).toFixed(1)}k` : post.views} views
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const relatedTags = Array.from(
                      new Set(postsWithViews.flatMap(p => p.tags || []).filter(t => t !== decodedTag))
                    ).slice(0, 12);
                    return relatedTags.length > 0 ? (
                      <div className="border border-divider">
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-divider">
                          <Tag className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-black uppercase tracking-wider">Related Tags</h3>
                        </div>
                        <div className="p-4 flex flex-wrap gap-2">
                          {relatedTags.map(t => (
                            <Link key={t} to={`/tag/${encodeURIComponent(t)}`}
                              className="text-[10px] font-black uppercase tracking-wider border border-divider px-2.5 py-1.5 hover:border-primary hover:text-primary transition-colors">
                              #{t}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </aside>

            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}