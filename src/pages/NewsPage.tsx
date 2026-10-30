import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getAllPosts } from "@/lib/markdown";
import { Clock, Eye, Flame, TrendingUp, Zap, Radio, ChevronDown, AlertTriangle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import AdUnit from "@/components/AdUnit";

const SITE_URL = "https://zandani.co.ke";
const INITIAL_SHOW = 12;
const LOAD_MORE = 12;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function proxyImg(url: string, w = 600): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (mins < 5) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function isWithinHours(dateStr: string, hours: number): boolean {
  return (Date.now() - new Date(dateStr).getTime()) < hours * 3600000;
}

function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

type Post = ReturnType<typeof getAllPosts>[0];

// ═════════════════════════════════════════════════════════════════════════════
// NEWS PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function NewsPage() {
  const allPosts = useMemo(() => getAllPosts(), []);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/get-views").then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
  }, []);

  // Live clock tick every 60s for "live updates" feel
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(prev => prev + LOAD_MORE); },
      { rootMargin: "400px" }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, []);

  const getViews = useCallback((slug: string) => {
    const clean = slug.replace(/^\//, "").replace(/\.md$/, "");
    return viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
  }, [viewCounts]);

  // Breaking = posts within last 6 hours
  const breakingPosts = useMemo(() =>
    allPosts.filter(p => isWithinHours(p.date, 6)).slice(0, 5),
    [allPosts, now]
  );

  // Live updates = posts within last 24 hours
  const liveUpdates = useMemo(() =>
    allPosts.filter(p => isWithinHours(p.date, 24)).slice(0, 15),
    [allPosts, now]
  );

  // Hero = latest post
  const heroPost = allPosts[0];
  const secondaryHero = allPosts.slice(1, 4);

  // Main feed = everything after hero section
  const feedPosts = allPosts.slice(4);
  const displayedFeed = feedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < feedPosts.length;

  // Trending = top by views
  const trendingPosts = useMemo(() =>
    [...allPosts].sort((a, b) => getViews(b.slug) - getViews(a.slug)).slice(0, 6),
    [allPosts, getViews]
  );

  // ── JSON-LD schemas ──
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Breaking Kenya News Today",
    "description": "Latest breaking news from Kenya — politics, entertainment, sports and more. Real-time updates from Za Ndani.",
    "url": `${SITE_URL}/news`,
    "isPartOf": { "@type": "WebSite", "name": "Za Ndani", "url": SITE_URL },
    "inLanguage": "en-KE",
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Latest News",
    "url": `${SITE_URL}/news`,
    "numberOfItems": Math.min(allPosts.length, 20),
    "itemListElement": allPosts.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${SITE_URL}/article/${p.slug}`,
      "name": p.title,
    })),
  };

  return (
    <Layout>
      <Helmet>
        <title>Breaking Kenya News Today — Latest Updates & Live Coverage | Za Ndani</title>
        <meta name="description" content="Breaking news Kenya today — politics, entertainment, sports, business. Real-time verified updates and live coverage from Za Ndani newsroom." />
        <meta name="keywords" content="breaking news kenya, kenya news today, latest news kenya, nairobi news, kenya politics news, current affairs kenya, live news kenya" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="googlebot-news" content="index, follow" />
        <meta name="news_keywords" content="breaking news Kenya, Kenya news today, Nairobi news, politics Kenya" />
        <link rel="canonical" href={`${SITE_URL}/news`} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/news`} />
        <meta property="og:site_name" content="Za Ndani" />
        <meta property="og:locale" content="en_KE" />
        <meta property="og:title" content="Breaking Kenya News Today | Za Ndani" />
        <meta property="og:description" content="Real-time breaking news from Kenya — politics, entertainment, sports, business. Live coverage from Za Ndani." />
        <meta property="og:image" content={`${SITE_URL}/logo.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@zandanikenya" />
        <meta name="twitter:title" content="Breaking Kenya News Today | Za Ndani" />
        <meta name="twitter:description" content="Real-time breaking news from Kenya — politics, entertainment, sports, business." />

        <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "News", "item": `${SITE_URL}/news` },
          ],
        })}</script>
      </Helmet>

      {/* ══ BREAKING NEWS TICKER ══ */}
      {breakingPosts.length > 0 && (
        <div className="bg-primary text-white overflow-hidden">
          <div className="container max-w-7xl mx-auto px-4 flex items-center gap-3 py-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-white/20 px-2 py-1">
              <AlertTriangle className="w-3 h-3" /> Breaking
            </span>
            <div className="overflow-hidden flex-1 relative">
              <div className="animate-marquee whitespace-nowrap flex gap-8">
                {breakingPosts.map(p => (
                  <Link key={p.slug} to={`/article/${p.slug}`} className="inline-flex items-center gap-2 text-xs font-semibold hover:underline">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                    {p.title}
                    <span className="text-white/60 text-[10px]">{timeAgo(p.date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO SECTION ══ */}
      {heroPost && (
        <section className="bg-zinc-950 border-b border-zinc-800">
          <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-4">
            <div className="grid lg:grid-cols-5 gap-1">
              {/* Main hero */}
              <Link to={`/article/${heroPost.slug}`} className="group relative overflow-hidden lg:col-span-3 block" style={{ minHeight: 380 }}>
                <img src={proxyImg(heroPost.image, 1200)} alt={heroPost.title} loading="eager" fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 group-hover:scale-[1.02] transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="relative flex flex-col justify-end h-full p-5 sm:p-8 z-10" style={{ minHeight: 380 }}>
                  {isWithinHours(heroPost.date, 6) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white bg-primary px-2 py-1 mb-2 w-fit animate-pulse">
                      <Radio className="w-3 h-3" /> Breaking
                    </span>
                  )}
                  <span className={`text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 mb-2 w-fit ${catColor(heroPost.category)}`}>
                    {heroPost.category}
                  </span>
                  <h1 className="text-white font-serif font-black text-2xl sm:text-3xl lg:text-4xl leading-tight mb-2 group-hover:text-primary transition-colors">
                    {heroPost.title}
                  </h1>
                  <p className="text-zinc-300 text-sm line-clamp-2 mb-3 max-w-2xl">{heroPost.excerpt}</p>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <time dateTime={new Date(heroPost.date).toISOString()} className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{timeAgo(heroPost.date)}
                    </time>
                    <span className="font-semibold text-zinc-400">{heroPost.author}</span>
                  </div>
                </div>
              </Link>

              {/* Secondary heroes */}
              <div className="lg:col-span-2 flex flex-col gap-1">
                {secondaryHero.map(post => (
                  <Link key={post.slug} to={`/article/${post.slug}`}
                    className="group relative overflow-hidden block flex-1" style={{ minHeight: 120 }}>
                    <img src={proxyImg(post.image, 500)} alt={post.title} loading="eager"
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="relative flex flex-col justify-end h-full p-4 z-10" style={{ minHeight: 120 }}>
                      {isWithinHours(post.date, 3) && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary mb-1">● LIVE</span>
                      )}
                      <h2 className="text-white font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h2>
                      <time dateTime={new Date(post.date).toISOString()} className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo(post.date)}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══ LIVE UPDATES TIMELINE ══ */}
      {liveUpdates.length > 0 && (
        <section className="bg-zinc-950/50 border-b border-zinc-800 py-6">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary">
                <Radio className="w-4 h-4 animate-pulse" /> Live Updates
              </span>
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-[10px] text-zinc-600 tabular-nums">{new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })} EAT</span>
            </div>

            <div className="relative pl-6 border-l-2 border-zinc-800 space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
              {liveUpdates.map(post => (
                <Link key={post.slug} to={`/article/${post.slug}`} className="group block relative">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-zinc-800 ${isWithinHours(post.date, 1) ? "bg-primary animate-pulse" : "bg-zinc-700"}`} />
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <time dateTime={new Date(post.date).toISOString()} className="text-[10px] text-zinc-500 tabular-nums font-mono">
                          {new Date(post.date).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        <span className={`text-[8px] font-black uppercase tracking-widest text-white px-1 py-0.5 ${catColor(post.category)}`}>
                          {post.category}
                        </span>
                        {isWithinHours(post.date, 1) && (
                          <span className="text-[8px] font-black text-primary uppercase">New</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{post.excerpt}</p>
                    </div>
                    <img src={proxyImg(post.image, 120)} alt={post.title} loading="lazy"
                      className="w-16 h-12 object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ MAIN CONTENT GRID ══ */}
      <section className="py-10 bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-12 gap-10">

            {/* Main feed */}
            <main className="lg:col-span-8 space-y-8">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  All News <Flame className="w-5 h-5 text-primary" />
                </h2>
                <div className="h-px flex-1 bg-divider" />
                <span className="text-xs text-muted-foreground">{allPosts.length} stories</span>
              </div>

              {/* Ad */}
              <div className="flex justify-center border border-divider bg-muted/10 p-3">
                <AdUnit type="horizontal" />
              </div>

              {/* Feed cards */}
              <div className="space-y-0 divide-y divide-divider">
                {displayedFeed.map((post, i) => (
                  <React.Fragment key={post.slug}>
                    <article className="group flex gap-3 sm:gap-4 py-4">
                      <Link to={`/article/${post.slug}`} className="flex-shrink-0 w-24 sm:w-32 md:w-40">
                        <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                          <img src={proxyImg(post.image, 320)} alt={post.title} loading="lazy" width={320} height={240}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          {isWithinHours(post.date, 3) && (
                            <span className="absolute top-1 left-1 text-[7px] font-black uppercase bg-primary text-white px-1 py-0.5">Live</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className={`inline-block text-[9px] font-black tracking-widest uppercase text-white px-1.5 py-0.5 mb-1.5 w-fit ${catColor(post.category)}`}>
                          {post.category}
                        </span>
                        <Link to={`/article/${post.slug}`}>
                          <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm md:text-base mb-1 leading-snug">
                            {post.title}
                          </h3>
                        </Link>
                        <p className="text-muted-foreground text-xs line-clamp-1 mb-1.5 hidden md:block">{post.excerpt}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <time dateTime={new Date(post.date).toISOString()} className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{timeAgo(post.date)}
                          </time>
                          <span>·</span>
                          <span>{post.readTime} min</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Eye className="w-2.5 h-2.5" />{getViews(post.slug)}
                          </span>
                        </div>
                      </div>
                    </article>

                    {(i + 1) % 5 === 0 && i < displayedFeed.length - 1 && (
                      <div className="flex justify-center py-4 bg-muted/10">
                        <AdUnit type={i % 2 === 0 ? "inarticle" : "effectivegate"} />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Load more / sentinel */}
              {hasMore && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  <button onClick={() => setVisibleCount(prev => prev + LOAD_MORE)}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition-colors">
                    <ChevronDown className="w-4 h-4" /> Load More News
                  </button>
                </div>
              )}
            </main>

            {/* Sidebar */}
            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-28 space-y-8">
                {/* Trending */}
                <div className="border border-divider">
                  <div className="bg-primary h-1" />
                  <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Trending Now</h3>
                  </div>
                  <div className="divide-y divide-divider">
                    {trendingPosts.map((post, i) => (
                      <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-3 p-3 hover:bg-muted/20 transition-colors">
                        <span className="text-2xl font-black text-muted-foreground/20 group-hover:text-primary transition-colors leading-none mt-0.5 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {post.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{getViews(post.slug)}</span>
                            <span>·</span>
                            <span>{timeAgo(post.date)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Ad */}
                <div className="border border-divider bg-muted/10 p-3 flex justify-center">
                  <AdUnit type="effectivegate" />
                </div>

                {/* Category quick links */}
                <div className="border border-divider p-4">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-3">Explore</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "Entertainment", slug: "entertainment", icon: "🎬" },
                      { name: "Sports", slug: "sports", icon: "⚽" },
                      { name: "Business", slug: "business", icon: "📈" },
                      { name: "Lifestyle", slug: "lifestyle", icon: "🌟" },
                    ].map(cat => (
                      <Link key={cat.slug} to={`/${cat.slug}`}
                        className="flex items-center gap-2 px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-xs font-bold">
                        <span>{cat.icon}</span> {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="border border-divider bg-muted/10 p-3 flex justify-center">
                  <AdUnit type="inarticle" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}
