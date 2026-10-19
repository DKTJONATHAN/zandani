import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getAllPosts } from "@/lib/markdown";
import { TrendingUp, Eye, Flame, Clock, ChevronDown, Zap } from "lucide-react";
import { Helmet } from "react-helmet-async";
import AdUnit from "@/components/AdUnit";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

function proxyImg(url: string, w = 600): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

const INITIAL_SHOW = 12;
const LOAD_MORE = 12;
const allPostsFromMarkdown = getAllPosts();
const adTypes: Array<'inarticle' | 'effectivegate' | 'horizontal'> = ['effectivegate', 'inarticle', 'horizontal'];

// ═════════════════════════════════════════════════════════════════════════════
// TRENDING PAGE
// ═════════════════════════════════════════════════════════════════════════════
const Trending = () => {
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  useEffect(() => {
    fetch('/api/get-views')
      .then(r => r.ok ? r.json() : {})
      .then(setViewCounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const trendingPosts = useMemo(() =>
    allPostsFromMarkdown
      .map(post => {
        const clean = post.slug.replace(/^\//, '').replace(/\.md$/, '');
        const v = viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
        return { ...post, views: v };
      })
      .sort((a, b) => b.views - a.views),
    [viewCounts]
  );

  // Top 3 = podium, rest = ranked grid
  const podium = trendingPosts.slice(0, 3);
  const rankFeed = trendingPosts.slice(3);
  const displayedFeed = rankFeed.slice(0, visibleCount);
  const hasMore = visibleCount < rankFeed.length;

  return (
    <Layout>
      <Helmet>
        <title>Trending Stories — Za Ndani | What's Hot in Kenya</title>
        <meta name="description" content="Discover the most read stories on Za Ndani right now. Hottest Kenya entertainment news, and breaking Nairobi stories." />
        <meta name="keywords" content="Trending news Kenya, hot entertainment stories Nairobi, most read news Kenya, Za Ndani trending, trending stories" />
        <link rel="canonical" href="https://zandani.co.ke/trending" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://zandani.co.ke/trending" />
        <meta property="og:title" content="Trending Stories — Za Ndani | What's Hot in Kenya" />
        <meta property="og:description" content="Discover the most read stories on Za Ndani right now. Hottest Kenya and breaking Nairobi entertainment news." />
        <meta property="og:image" content="https://zandani.co.ke/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trending Stories — Za Ndani | What's Hot in Kenya" />
        <meta name="twitter:description" content="Discover the most read stories on Za Ndani right now." />
        <meta name="twitter:image" content="https://zandani.co.ke/logo.png" />
        <meta property="og:locale" content="en_KE" />
        <meta property="og:site_name" content="Za Ndani" />
      </Helmet>

      {/* ── Page hero ── */}
      <section className="bg-zinc-950 border-b border-zinc-800">
        <div className="h-[3px] w-full bg-primary" />
        <div className="container max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] uppercase text-white px-3 py-1.5 bg-primary mb-3">
                <Flame className="w-3 h-3" /> Live Rankings
              </span>
              <h1 className="text-4xl md:text-5xl font-serif font-black text-white leading-tight">
                Trending Stories
              </h1>
              <p className="text-zinc-400 text-base mt-2 max-w-xl">
                The most-read scoops, celebrity scandals, and breaking stories that Kenya is talking about right now — ranked by real views.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 flex-shrink-0">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-black text-white">{trendingPosts.length}</span> stories ranked
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14 bg-background">
        <div className="container max-w-7xl mx-auto px-4">

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-56 bg-muted animate-pulse border border-divider" />
              ))}
            </div>
          ) : (
            <div className="grid lg:grid-cols-12 gap-10">

              {/* ── MAIN FEED ── */}
              <main className="lg:col-span-8 space-y-10">

                {/* ── TOP 3 PODIUM ── */}
                {podium.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" /> Top 3 This Week
                      </h2>
                      <div className="h-px flex-1 bg-divider" />
                    </div>

                    <div className="grid md:grid-cols-12 gap-1">
                      {/* #1 — large */}
                      {podium[0] && (
                        <Link to={`/article/${podium[0].slug}`}
                          className="md:col-span-7 group relative overflow-hidden block"
                          style={{ minHeight: 360 }}>
                          <img src={proxyImg(podium[0].image, 900)} alt={podium[0].title}
                            loading="eager"
                            className="absolute inset-0 w-full h-full object-cover object-[center_20%] opacity-60 group-hover:opacity-80 group-hover:scale-[1.02] transition-all duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

                          {/* Rank badge */}
                          <div className="absolute top-4 left-4 z-10 w-10 h-10 bg-primary flex items-center justify-center text-white font-black text-lg shadow-xl">
                            1
                          </div>
                          <div className="absolute top-4 right-4 z-10 flex items-center gap-1 text-[11px] text-white bg-black/60 px-2 py-1">
                            <Eye className="w-3 h-3" />
                            {podium[0].views > 999 ? `${(podium[0].views / 1000).toFixed(1)}k` : podium[0].views}
                          </div>

                          <div className="relative flex flex-col justify-end h-full p-6 z-10" style={{ minHeight: 360 }}>
                            <span className={`text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 mb-2 w-fit ${catColor(podium[0].category)}`}>
                              {podium[0].category}
                            </span>
                            <h2 className="text-white font-serif font-black text-2xl leading-tight mb-2 group-hover:text-primary transition-colors">
                              {podium[0].title}
                            </h2>
                            <p className="text-zinc-300 text-sm line-clamp-2 mb-3 font-light">{podium[0].excerpt}</p>
                            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(podium[0].date)}</span>
                              <span>{podium[0].author}</span>
                            </div>
                          </div>
                        </Link>
                      )}

                      {/* #2 & #3 stacked */}
                      <div className="md:col-span-5 flex flex-col gap-1">
                        {podium.slice(1).map((post, i) => (
                          <Link key={post.slug} to={`/article/${post.slug}`}
                            className="group relative overflow-hidden block flex-1"
                            style={{ minHeight: 175 }}>
                            <img src={proxyImg(post.image, 500)} alt={post.title}
                              loading="eager"
                              className="absolute inset-0 w-full h-full object-cover object-[center_20%] opacity-55 group-hover:opacity-75 group-hover:scale-[1.02] transition-all duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                            <div className="absolute top-3 left-3 z-10 w-8 h-8 bg-zinc-700 flex items-center justify-center text-white font-black text-sm shadow-lg">
                              {i + 2}
                            </div>
                            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] text-white bg-black/50 px-1.5 py-0.5">
                              <Eye className="w-3 h-3" />
                              {post.views > 999 ? `${(post.views / 1000).toFixed(1)}k` : post.views}
                            </div>

                            <div className="relative flex flex-col justify-end h-full p-4 z-10" style={{ minHeight: 175 }}>
                              <span className={`text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 mb-1.5 w-fit ${catColor(post.category)}`}>
                                {post.category}
                              </span>
                              <h3 className="text-white font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {post.title}
                              </h3>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1.5">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.date)}</span>
                                <span>{post.author}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top ad */}
                <div className="flex justify-center border border-divider bg-muted/10 p-3">
                  <AdUnit type="horizontal" />
                </div>

                {/* ── RANKED FEED (#4 onwards) ── */}
                {displayedFeed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <h2 className="text-xl font-black uppercase tracking-tight">#4 and Beyond</h2>
                      <div className="h-px flex-1 bg-divider" />
                    </div>

                    <div className="space-y-0 divide-y divide-divider border border-divider">
                      {displayedFeed.map((post, i) => (
                        <div key={post.slug}>
                          <Link to={`/article/${post.slug}`}
                            className="group flex gap-4 p-4 hover:bg-muted/20 transition-colors items-start">
                            {/* Rank number */}
                            <span className="text-3xl font-serif font-black text-muted-foreground/20 leading-none flex-shrink-0 w-10 text-center mt-1">
                              {i + 4}
                            </span>

                            {/* Thumbnail */}
                            <div className="w-24 h-20 flex-shrink-0 overflow-hidden relative">
                              <img src={proxyImg(post.image, 200)} alt={post.title} loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              <span className={`absolute bottom-1 left-1 text-[8px] font-black uppercase text-white px-1 py-0.5 ${catColor(post.category)}`}>
                                {post.category}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
                                {post.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1 text-primary font-bold">
                                  <Eye className="w-3 h-3" />
                                  {post.views > 999 ? `${(post.views / 1000).toFixed(1)}k` : post.views} views
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{timeAgo(post.date)}
                                </span>
                                <span>{post.author}</span>
                              </div>
                            </div>
                          </Link>

                          {/* Ad every 6 rows */}
                          {(i + 1) % 6 === 0 && i < displayedFeed.length - 1 && (
                            <div className="flex justify-center py-4 bg-muted/10 border-t border-divider">
                              <AdUnit type={adTypes[Math.floor(i / 6) % adTypes.length]} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {hasMore && (
                      <div className="mt-8 text-center">
                        <button
                          onClick={() => setVisibleCount(v => v + LOAD_MORE)}
                          className="group border-2 border-divider hover:border-primary hover:text-primary px-10 py-5 text-xs uppercase tracking-[0.2em] font-black transition-all inline-flex items-center gap-2"
                        >
                          Load More <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                        </button>
                      </div>
                    )}

                    {!hasMore && (
                      <div className="py-16 text-center">
                        <p className="text-muted-foreground font-serif italic text-lg">You've seen every trending story 🫖</p>
                      </div>
                    )}
                  </div>
                )}
              </main>

              {/* ── SIDEBAR ── */}
              <aside className="hidden lg:block lg:col-span-4">
                <div className="sticky top-24 space-y-8">

                  {/* Quick stats */}
                  <div className="border border-divider bg-surface">
                    <div className="h-1 w-full bg-primary" />
                    <div className="p-5 space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                        <Flame className="w-4 h-4 text-primary" /> Live Stats
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-divider p-3 text-center">
                          <p className="text-2xl font-black text-foreground">{trendingPosts.length}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Stories</p>
                        </div>
                        <div className="border border-divider p-3 text-center">
                          <p className="text-2xl font-black text-primary">
                            {trendingPosts[0]?.views > 999
                              ? `${(trendingPosts[0].views / 1000).toFixed(1)}k`
                              : trendingPosts[0]?.views || 0}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">#1 Views</p>
                        </div>
                        <div className="col-span-2 border border-divider p-3">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Most Read Today</p>
                          {trendingPosts[0] && (
                            <Link to={`/article/${trendingPosts[0].slug}`}
                              className="text-xs font-bold line-clamp-2 hover:text-primary transition-colors">
                              {trendingPosts[0].title}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar ad */}
                  <div className="flex justify-center bg-muted/10 p-4 border border-divider">
                    <AdUnit type="effectivegate" />
                  </div>

                  {/* Top 10 compact list */}
                  <div className="border border-divider">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-divider">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-black uppercase tracking-wider">Top 10 All Time</h3>
                    </div>
                    <div className="divide-y divide-divider">
                      {trendingPosts.slice(0, 10).map((post, i) => (
                        <Link key={post.slug} to={`/article/${post.slug}`}
                          className="flex gap-3 items-start p-3 group hover:bg-muted/20 transition-colors">
                          <span className="text-xl font-serif font-black text-muted-foreground/20 leading-none flex-shrink-0 w-5 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
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

                  {/* Second sidebar ad */}
                  <div className="flex justify-center bg-muted/10 p-4 border border-divider">
                    <AdUnit type="inarticle" />
                  </div>

                </div>
              </aside>

            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Trending;
