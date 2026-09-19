import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { getAllPosts } from "@/lib/markdown";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Flame, Clock, Eye, Radio, Mail, Tv, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Helmet } from "react-helmet-async";
import AdUnit from "@/components/AdUnit";
import { LiveUpdatesTimeline } from "@/components/news/LiveUpdatesTimeline";
import { ForYouRail } from "@/components/articles/ForYouRail";
import { NewsletterForm } from "@/components/NewsletterForm";
import { timeAgo } from "@/lib/utils";

const SITE_URL = "https://zandani.co.ke";
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/default-og.svg`;
const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

function img(url: string, w = 800): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=${w}&output=webp&q=75&we`;
}

function ogImg(url: string): string {
  if (!url) return DEFAULT_OG_IMAGE;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=1200&h=630&fit=cover&output=webp&q=85`;
}

function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

function catBorder(_cat: string): string {
  return "border-primary";
}

type Post = ReturnType<typeof getAllPosts>[0];

function kenyaScore(post: Post): number {
  const blob = `${post.title || ""} ${post.excerpt || ""} ${post.category || ""} ${post.author || ""} ${(post.tags || []).join(" ")}`.toLowerCase();
  let score = 0;
  if (/\b(kenya|kenyan|nairobi|mombasa|kisumu|nakuru|eldoret|thika|kiambu|kakamega)\b/.test(blob)) score += 3;
  if (/\b(ruto|gachagua|raila|safaricom|m-?pesa|kplc|epra|harambee|gor mahia|afc leopards)\b/.test(blob)) score += 2;
  if (/\b(east africa|uganda|tanzania|rwanda|ethiopia)\b/.test(blob)) score += 1;
  return score;
}

function postTime(post: Post): number {
  const t = new Date(post.date).getTime();
  return isNaN(t) ? 0 : t;
}

function matchesCat(post: Post, names: string[]): boolean {
  const cat = (post.category || "").toLowerCase();
  return names.some((n) => cat.includes(n));
}

const RAW_POSTS = getAllPosts().slice(0, 200);

function InFeedAd({ slot }: { slot: number }) {
  return (
    <div className="border-b border-border py-4">
      <div className="lg:hidden">
        <AdUnit type={slot % 2 === 0 ? "horizontal" : "inarticle"} />
      </div>
      <div className="hidden lg:block">
        <AdUnit type="inarticle" />
      </div>
    </div>
  );
}

const MostReadMobile = React.memo(({ posts }: { posts: Post[] }) => (
  <div className="border border-border bg-card px-4 py-4">
    <div className="flex items-center gap-2 mb-3">
      <TrendingUp className="w-4 h-4 text-primary" />
      <h3 className="text-xs font-black uppercase tracking-widest">Most Read</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
    <div className="space-y-3">
      {posts.map((post, i) => (
        <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-3 items-start">
          <span className="text-xl font-black text-muted-foreground/30 group-hover:text-primary transition-colors leading-none mt-0.5 tabular-nums">0{i + 1}</span>
          <div>
            <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:underline">{post.title}</h4>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{post.category}</span>
          </div>
        </Link>
      ))}
    </div>
  </div>
));

const SidebarStoryList = React.memo(({ title, icon, posts, href }: { title: string; icon: React.ReactNode; posts: Post[]; href: string }) => {
  if (!posts.length) return null;
  return (
    <div className="border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
        <div className="h-px flex-1 bg-border" />
        <Link to={href} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">All</Link>
      </div>
      <div className="space-y-3">
        {posts.map((post) => (
          <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-3">
            <img src={img(post.image, 160)} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-sm object-cover" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary">{post.title}</h4>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-2.5 h-2.5" />{timeAgo(post.date)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

const FeedCard = React.memo(({ post, views }: { post: Post; views: number }) => (
  <article className="group flex gap-3 sm:gap-4 border-b border-border py-4">
    <Link to={`/article/${post.slug}`} className="flex-shrink-0 w-24 sm:w-32 md:w-40">
      <div className={`relative aspect-[4/3] overflow-hidden bg-muted border-t-[3px] ${catBorder(post.category)}`}>
        <img src={img(post.image, 320)} alt={post.title} loading="lazy" decoding="async" width={320} height={240} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
    </Link>
    <div className="flex flex-col justify-center min-w-0">
      <span className={`inline-block text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 mb-1.5 w-fit ${catColor(post.category)}`}>{post.category}</span>
      <Link to={`/article/${post.slug}`}>
        <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm md:text-base mb-1 leading-snug">{post.title}</h3>
      </Link>
      <p className="text-muted-foreground text-xs line-clamp-1 mb-1.5 hidden md:block">{post.excerpt}</p>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{timeAgo(post.date)}</span>
        <span className="flex items-center gap-1 text-primary font-semibold"><Eye className="w-2.5 h-2.5" />{views > 999 ? `${(views / 1000).toFixed(1)}k` : views}</span>
        <span>{post.readTime} min</span>
      </div>
    </div>
  </article>
));

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [showOlder, setShowOlder] = useState(false);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [adsReady, setAdsReady] = useState(false);

  useEffect(() => {
    fetch("/api/get-views").then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
  }, []);

  const getViews = useCallback((slug: string) => {
    const clean = slug.replace(/^\//, "").replace(/\.md$/, "");
    return viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
  }, [viewCounts]);

  useEffect(() => {
    const t = setTimeout(() => setAdsReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const rankedPosts = useMemo(() => {
    return [...RAW_POSTS].sort((a, b) => {
      const timeDiff = postTime(b) - postTime(a);
      if (timeDiff !== 0) return timeDiff;
      return kenyaScore(b) - kenyaScore(a);
    });
  }, []);
  const heroLead = rankedPosts[0];
  const heroSecondary = rankedPosts.slice(1, 5);
  const cutoff = Date.now() - FORTY_EIGHT_HOURS;

  const categories = useMemo(() => {
    const cats = Array.from(new Set(RAW_POSTS.map(p => p.category?.toLowerCase()).filter(Boolean)));
    return ["all", ...cats];
  }, []);

  const { recentFeed, olderFeed } = useMemo(() => {
    const used = new Set([heroLead?.slug, ...heroSecondary.map((p) => p.slug)].filter(Boolean));
    let base = rankedPosts.filter((p) => !used.has(p.slug));
    if (activeCategory !== "all") {
      base = base.filter((p) => p.category?.toLowerCase() === activeCategory);
    }
    return {
      recentFeed: base.filter((p) => postTime(p) >= cutoff),
      olderFeed: base.filter((p) => postTime(p) < cutoff),
    };
  }, [activeCategory, rankedPosts, heroLead, heroSecondary, cutoff]);

  const displayedPosts = showOlder ? [...recentFeed, ...olderFeed] : recentFeed;

  const mostRead = useMemo(() => {
    const withViews = RAW_POSTS.filter(p => getViews(p.slug) > 0);
    if (withViews.length === 0) return rankedPosts.slice(0, 5);
    return [...withViews].sort((a, b) => getViews(b.slug) - getViews(a.slug)).slice(0, 5);
  }, [viewCounts, getViews, rankedPosts]);

  const showbiz = useMemo(
    () => rankedPosts.filter((p) => matchesCat(p, ["entertainment", "showbiz", "lifestyle"])).slice(0, 4),
    [rankedPosts]
  );
  const sports = useMemo(
    () => rankedPosts.filter((p) => matchesCat(p, ["sport"])).slice(0, 4),
    [rankedPosts]
  );
  const opinion = useMemo(
    () => rankedPosts.filter((p) => matchesCat(p, ["opinion", "column"])).slice(0, 3),
    [rankedPosts]
  );

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    setShowOlder(false);
  }, []);

  const heroImageSrcSet = heroLead
    ? `${img(heroLead.image, 600)} 600w, ${img(heroLead.image, 900)} 900w, ${img(heroLead.image, 1200)} 1200w`
    : "";
  const heroImageSizes = "(max-width: 600px) 100vw, (max-width: 900px) 100vw, 1200px";
  const optimizedHeroImage = heroLead ? img(heroLead.image, 1200) : "/images/placeholder.jpg";
  const homeOgImage = heroLead ? ogImg(heroLead.image) : DEFAULT_OG_IMAGE;

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Za Ndani",
    "url": SITE_URL,
    "description": "Kenya news, gossip, showbiz, sports and politics — bold, local, first.",
    "inLanguage": "en-KE",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Zandani",
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "sameAs": ["https://x.com/zandani_ke", "https://facebook.com/zandanike", "https://instagram.com/zandani_ke"]
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Latest Stories",
    "url": SITE_URL,
    "itemListElement": rankedPosts.slice(0, 10).map((post, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${SITE_URL}/article/${post.slug}`,
      "name": post.title,
    })),
  };

  return (
    <Layout>
      <Helmet>
        <title>Zandani | Kenya Breaking News, Politics, Sports & Entertainment</title>
        <meta name="description" content="Kenya-first news, gossip and showbiz from Nairobi. Breaking local stories, sports, politics and entertainment — bold and unbiased." />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="Za Ndani" />
        <meta property="og:locale" content="en_KE" />
        <meta property="og:title" content="Za Ndani | Kenya News, Gossip & Entertainment" />
        <meta property="og:description" content="Kenya-first news, gossip and showbiz from Nairobi. Breaking local stories, sports, politics and entertainment." />
        <meta property="og:image" content={homeOgImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@zandanikenya" />
        <meta name="twitter:title" content="Za Ndani | Kenya News, Gossip & Entertainment" />
        <meta name="twitter:description" content="Kenya-first news, gossip and showbiz from Nairobi." />
        <meta name="twitter:image" content={homeOgImage} />
        {heroLead && <link rel="preload" as="image" href={optimizedHeroImage} imageSrcSet={heroImageSrcSet} imageSizes={heroImageSizes} fetchPriority="high" />}
        <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListSchema)}</script>
      </Helmet>

      {heroLead && (
        <section className="bg-background border-b border-border">
          <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-6 lg:py-10">
            <div className="lg:hidden space-y-4">
              <Link to={`/article/${heroLead.slug}`} className="group block">
                <div className="overflow-hidden rounded-md">
                  <img src={optimizedHeroImage} alt={heroLead.title} fetchPriority="high" loading="eager" decoding="async" className="w-full aspect-video object-cover" width={600} height={338} />
                </div>
                <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">{heroLead.category}</span>
                <h1 className="mt-2 font-serif text-2xl font-bold leading-tight text-headline">{heroLead.title}</h1>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(heroLead.date)}</span>
                  <span className="font-semibold truncate">{heroLead.author}</span>
                </div>
              </Link>
              <div className="border-t border-border">
                {heroSecondary.slice(0, 2).map(post => (
                  <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-3 border-b border-border py-4">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-primary">{post.category}</span>
                      <h2 className="mt-1 font-serif text-base font-bold leading-snug group-hover:text-primary">{post.title}</h2>
                    </div>
                    <img src={img(post.image, 400)} alt={post.title} loading="lazy" className="h-20 w-28 shrink-0 rounded-sm object-cover" />
                  </Link>
                ))}
              </div>
              {adsReady && (
                <div className="lg:hidden">
                  <AdUnit type="horizontal" />
                </div>
              )}
            </div>

            <div className="hidden lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
              <Link to={`/article/${heroLead.slug}`} className="group overflow-hidden rounded-md">
                <img src={optimizedHeroImage} srcSet={heroImageSrcSet} sizes={heroImageSizes} alt={heroLead.title} fetchPriority="high" loading="eager" decoding="async" width={840} height={525} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </Link>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">{heroLead.category}</span>
                <Link to={`/article/${heroLead.slug}`}>
                  <h1 className="mt-3 font-serif text-5xl font-bold leading-tight tracking-tight text-headline hover:text-primary">{heroLead.title}</h1>
                </Link>
                <p className="mt-4 max-w-md text-muted-foreground">{heroLead.excerpt}</p>
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(heroLead.date)}</span>
                  <span className="font-semibold text-foreground">{heroLead.author}</span>
                </div>
              </div>
            </div>
            <div className="mt-8 hidden border-t border-border lg:grid lg:grid-cols-2 lg:gap-10">
              {heroSecondary.slice(0, 2).map(post => (
                <Link key={post.slug} to={`/article/${post.slug}`} className="group flex gap-4 border-b border-border py-5">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">{post.category}</span>
                    <h2 className="mt-1 font-serif text-xl font-bold leading-snug group-hover:text-primary">{post.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  </div>
                  <img src={img(post.image, 400)} alt={post.title} loading="lazy" width={200} height={140} className="h-28 w-36 shrink-0 rounded-sm object-cover" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-4">
        <Link to="/tv" className="flex items-center justify-between gap-3 border border-primary/30 bg-primary/5 px-4 py-3 rounded-lg hover:bg-primary/10 transition-colors">
          <span className="flex items-center gap-2 text-sm font-bold text-primary"><Radio className="w-4 h-4" /> WATCH LIVE KENYAN TV</span>
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Open TV</span>
        </Link>
      </div>

      {adsReady && (
        <div className="container max-w-7xl mx-auto px-3 sm:px-4 pb-4">
          <AdUnit type="horizontal" />
        </div>
      )}

      <section className="container max-w-7xl mx-auto px-3 sm:px-4 pb-6">
        <LiveUpdatesTimeline maxItems={8} />
      </section>

      <section className="container max-w-7xl mx-auto px-3 sm:px-4 pb-2">
        <ForYouRail limit={6} />
      </section>

      {adsReady && (
        <div className="container max-w-7xl mx-auto px-3 sm:px-4 pb-6 lg:hidden">
          <AdUnit type="inarticle" />
        </div>
      )}

      <section className="container max-w-7xl mx-auto px-3 sm:px-4 pb-12">
        <div className="flex flex-wrap items-center gap-2 mb-4 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest">Latest from Kenya</h2>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 48 hours</span>
            </div>

            {displayedPosts.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">No stories in this window. Open Show more for earlier posts.</p>
            )}

            {displayedPosts.map((post, i) => (
              <React.Fragment key={post.slug}>
                <FeedCard post={post} views={getViews(post.slug)} />
                {adsReady && (i + 1) % 3 === 0 && i !== displayedPosts.length - 1 && <InFeedAd slot={i} />}
              </React.Fragment>
            ))}

            {olderFeed.length > 0 && (
              <div className="py-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowOlder((v) => !v)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary text-sm font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {showOlder ? (
                    <>
                      Show less <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Show more <span className="font-semibold normal-case tracking-normal">({olderFeed.length} older)</span> <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <MostReadMobile posts={mostRead} />

            {adsReady && <AdUnit type="inarticle" />}

            <SidebarStoryList
              title="Showbiz"
              href="/entertainment"
              icon={<Sparkles className="w-4 h-4 text-primary" />}
              posts={showbiz}
            />

            <SidebarStoryList
              title="Sports desk"
              href="/sports"
              icon={<Flame className="w-4 h-4 text-primary" />}
              posts={sports}
            />

            <SidebarStoryList
              title="Opinion"
              href="/opinions"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
              posts={opinion}
            />

            <div className="lg:sticky lg:top-24 space-y-4 bg-background pt-1">
              {adsReady && <AdUnit type="inarticle" />}
              <div className="border border-primary/30 bg-primary text-primary-foreground px-4 py-5 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Evening brief</h3>
                </div>
                <p className="text-sm mb-3 text-primary-foreground/90">Three Kenya-first stories, 19:00 EAT. Free.</p>
                <NewsletterForm tone="onAccent" compact />
              </div>
              <Link to="/tv" className="flex items-center justify-between gap-3 border border-border bg-card px-4 py-3 hover:border-primary/50 transition-colors">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Tv className="w-4 h-4 text-primary" /> Live Kenyan TV
                </span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
