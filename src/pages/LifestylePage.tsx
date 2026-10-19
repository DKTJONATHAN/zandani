import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getPostsByCategory } from "@/lib/markdown";
import { Clock, Eye, Flame, TrendingUp, ChevronDown, Heart } from "lucide-react";
import { Helmet } from "react-helmet-async";
import AdUnit from "@/components/AdUnit";
import { LiveUpdatesTimeline } from "@/components/news/LiveUpdatesTimeline";

const SITE_URL = "https://zandani.co.ke";
const INITIAL_SHOW = 12;
const LOAD_MORE = 12;

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

type Post = ReturnType<typeof getPostsByCategory>[0];

export default function LifestylePage() {
  const allPosts = useMemo(() => getPostsByCategory("lifestyle"), []);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/get-views").then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

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

  const hotPosts = useMemo(() =>
    allPosts.filter(p => isWithinHours(p.date, 12)).slice(0, 5),
    [allPosts, now]
  );

  const heroPost = allPosts[0];
  const secondaryHero = allPosts.slice(1, 4);

  const feedPosts = allPosts.slice(4);
  const displayedFeed = feedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < feedPosts.length;

  const trendingPosts = useMemo(() =>
    [...allPosts].sort((a, b) => getViews(b.slug) - getViews(a.slug)).slice(0, 6),
    [allPosts, getViews]
  );

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Kenya Lifestyle — Fashion, Health & Travel | Za Ndani",
    "description": "Latest Kenya lifestyle content — fashion trends, health tips, travel guides, food & living well. Real-time updates from Za Ndani.",
    "url": `${SITE_URL}/lifestyle`,
    "isPartOf": { "@type": "WebSite", "name": "Za Ndani", "url": SITE_URL },
    "inLanguage": "en-KE",
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Latest Lifestyle Stories",
    "url": `${SITE_URL}/lifestyle`,
    "numberOfItems": Math.min(allPosts.length, 20),
    "itemListElement": allPosts.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${SITE_URL}/article/${p.slug}`,
      "name": p.title,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Lifestyle", "item": `${SITE_URL}/lifestyle` },
    ],
  };

  return (
    <Layout>
      <Helmet>
        <title>Kenya Lifestyle — Fashion, Health & Travel | Za Ndani</title>
        <meta name="description" content="Latest Kenya lifestyle content — fashion trends, health tips, travel guides, food & living well. Real-time updates from Za Ndani." />
        <meta name="keywords" content="kenya lifestyle, kenya fashion, health tips kenya, travel kenya, nairobi lifestyle, kenya food, living well kenya, za ndani lifestyle" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="googlebot-news" content="index, follow" />
        <meta name="news_keywords" content="Kenya lifestyle, Kenya fashion, Nairobi lifestyle" />
        <link rel="canonical" href={`${SITE_URL}/lifestyle`} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/lifestyle`} />
        <meta property="og:site_name" content="Za Ndani" />
        <meta property="og:locale" content="en_KE" />
        <meta property="og:title" content="Kenya Lifestyle — Fashion, Health & Travel | Za Ndani" />
        <meta property="og:description" content="Latest Kenya lifestyle — fashion, health, travel. Real-time updates from Za Ndani." />
        <meta property="og:image" content={`${SITE_URL}/logo.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@zandanikenya" />
        <meta name="twitter:title" content="Kenya Lifestyle | Za Ndani" />
        <meta name="twitter:description" content="Latest Kenya lifestyle — fashion, health, travel." />

        <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      {/* ══ LIFESTYLE TICKER ══ */}
      {hotPosts.length > 0 && (
        <div className="bg-primary text-white overflow-hidden">
          <div className="container max-w-7xl mx-auto px-4 flex items-center gap-3 py-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-white/20 px-2 py-1">
              <Heart className="w-3 h-3" /> Trending Now
            </span>
            <div className="overflow-hidden flex-1 relative">
              <div className="animate-marquee whitespace-nowrap flex gap-8">
                {hotPosts.map(p => (
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
              <Link to={`/article/${heroPost.slug}`} className="group relative overflow-hidden lg:col-span-3 block" style={{ minHeight: 380 }}>
                <img src={proxyImg(heroPost.image, 1200)} alt={heroPost.title} loading="eager" fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 group-hover:scale-[1.02] transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="relative flex flex-col justify-end h-full p-5 sm:p-8 z-10" style={{ minHeight: 380 }}>
                  {isWithinHours(heroPost.date, 6) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white bg-primary px-2 py-1 mb-2 w-fit animate-pulse">
                      <Heart className="w-3 h-3" /> New
                    </span>
                  )}
                  <span className="text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 mb-2 w-fit bg-primary">
                    Lifestyle
                  </span>
                  <h1 className="text-white font-serif font-black text-2xl sm:text-3xl lg:text-4xl leading-tight mb-2 group-hover:text-purple-400 transition-colors">
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

              <div className="lg:col-span-2 flex flex-col gap-1">
                {secondaryHero.map(post => (
                  <Link key={post.slug} to={`/article/${post.slug}`}
                    className="group relative overflow-hidden block flex-1" style={{ minHeight: 120 }}>
                    <img src={proxyImg(post.image, 500)} alt={post.title} loading="eager"
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="relative flex flex-col justify-end h-full p-4 z-10" style={{ minHeight: 120 }}>
                      {isWithinHours(post.date, 3) && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-1">● NEW</span>
                      )}
                      <h2 className="text-white font-bold text-sm leading-snug line-clamp-2 group-hover:text-purple-400 transition-colors">
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

      {/* ══ LIVE UPDATES ══ */}
      <LiveUpdatesTimeline category="lifestyle" title="Lifestyle Live Updates" maxItems={12} />

      {/* ══ MAIN CONTENT GRID ══ */}
      <section className="py-10 bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-12 gap-10">

            <main className="lg:col-span-8 space-y-8">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  All Lifestyle <Flame className="w-5 h-5 text-purple-500" />
                </h2>
                <div className="h-px flex-1 bg-divider" />
                <span className="text-xs text-muted-foreground">{allPosts.length} stories</span>
              </div>

              <div className="flex justify-center border border-divider bg-muted/10 p-3">
                <AdUnit type="horizontal" />
              </div>

              <div className="space-y-0 divide-y divide-divider">
                {displayedFeed.map((post, i) => (
                  <React.Fragment key={post.slug}>
                    <article className="group flex gap-3 sm:gap-4 py-4">
                      <Link to={`/article/${post.slug}`} className="flex-shrink-0 w-24 sm:w-32 md:w-40">
                        <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                          <img src={proxyImg(post.image, 320)} alt={post.title} loading="lazy" width={320} height={240}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          {isWithinHours(post.date, 3) && (
                            <span className="absolute top-1 left-1 text-[7px] font-black uppercase bg-primary text-white px-1 py-0.5">New</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="inline-block text-[9px] font-black tracking-widest uppercase text-white px-1.5 py-0.5 mb-1.5 w-fit bg-primary">
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
                          <span className="flex items-center gap-1 text-purple-500 font-semibold">
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

              {hasMore && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  <button onClick={() => setVisibleCount(prev => prev + LOAD_MORE)}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors">
                    <ChevronDown className="w-4 h-4" /> Load More Lifestyle
                  </button>
                </div>
              )}
            </main>

            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-28 space-y-8">
                <div className="border border-divider">
                  <div className="bg-primary h-1" />
                  <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Trending Lifestyle</h3>
                  </div>
                  <div className="divide-y divide-divider">
                    {trendingPosts.map((post, i) => (
                      <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-3 p-3 hover:bg-muted/20 transition-colors">
                        <span className="text-2xl font-black text-muted-foreground/20 group-hover:text-purple-500 transition-colors leading-none mt-0.5 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-purple-500 transition-colors">
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

                <div className="border border-divider bg-muted/10 p-3 flex justify-center">
                  <AdUnit type="effectivegate" />
                </div>

                <div className="border border-divider p-4">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-3">Explore More</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "News", icon: "📰", href: "/news" },
                      { name: "Entertainment", icon: "🎬", href: "/entertainment" },
                      { name: "Sports", icon: "⚽", href: "/sports" },
                      { name: "Business", icon: "📈", href: "/business" },
                    ].map(cat => (
                      <Link key={cat.name} to={cat.href}
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
