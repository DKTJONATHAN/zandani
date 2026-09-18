import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getPostBySlug, getRelatedPosts, type Post } from "@/lib/markdown";
import { Clock, Calendar, Share2, Facebook, ArrowUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { XIcon } from "@/components/XIcon";
import { Helmet } from "react-helmet-async";
import AdUnit from "@/components/AdUnit";
import { LiveUpdatesTimeline } from "@/components/news/LiveUpdatesTimeline";
import { ArticleBreadcrumbs } from "@/components/articles/ArticleBreadcrumbs";
import { StickyMobileShare } from "@/components/articles/StickyMobileShare";
import { WhatWeKnow } from "@/components/articles/WhatWeKnow";
import { ArticleReactions } from "@/components/articles/ArticleReactions";
import { ArticlePoll } from "@/components/articles/ArticlePoll";
import { ArticleComments } from "@/components/articles/ArticleComments";
import { shouldShowWhatWeKnow, splitLedeHtml } from "@/lib/what-we-know";
import { authorColor, catColor, proxyImg, PLACEHOLDER_IMG } from "@/lib/utils";
import { trackCategoryView } from "@/hooks/usePreferences";

const SITE_URL = "https://zandani.co.ke";
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/default-og.jpg`;
const BLOCKED_OG_HOSTS = [
  "kenyans.co.ke",
  "mpasho.co.ke",
  "ghafla.com",
  "standardmedia.co.ke",
  "nation.africa",
  "tuko.co.ke",
];

function ogImg(url: string): string {
  if (!url) return DEFAULT_OG_IMAGE;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (BLOCKED_OG_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
      return DEFAULT_OG_IMAGE;
    }
  } catch {
    return DEFAULT_OG_IMAGE;
  }
  return url;
}

function cleanMetaDescription(raw: string, fallbackTitle: string): string {
  let d = (raw || "").replace(/\s+/g, " ").trim();
  d = d.replace(/^([a-z0-9][a-z0-9\s\-]{8,80}?):\s+/i, "");
  if (d && d[0] === d[0].toLowerCase()) {
    d = d[0].toUpperCase() + d.slice(1);
  }
  if (!d || d.length < 40) {
    d = `${fallbackTitle}. Latest reporting from Kenya on Za Ndani.`;
  }
  if (d.length > 157) {
    d = d.slice(0, 158).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "") + ".";
  }
  return d;
}

const AUTHOR_BIOS: Record<string, string> = {
  "za ndani": "Sharp, cynical, and always first with the scoop. Za Ndani exposes what the mainstream won't touch.",
  "mutheu ann": "Plugged into Kenya's entertainment circuit.",
  "celestine nzioka": "Authoritative and unflinching. Celestine cuts through political spin.",
  "wanjiku kuria": "Nairobi gossip desk. Receipts first, noise second.",
  "martin kihara": "Showbiz beat for Kenyan stars.",
  jaj: "Opinion desk. Arguments first, then the evidence from the street.",
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getPostBySlug(slug || "").then((p) => {
      setPost(p || null);
      setLoading(false);
      if (p) trackCategoryView(p.category || "News", p.slug);
    });
  }, [slug]);

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    return getRelatedPosts(post, 6);
  }, [post]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowScrollTop(window.scrollY > 500);
        const pct = Math.min(
          (window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100,
          100
        );
        if (progressRef.current) progressRef.current.style.width = `${pct}%`;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : `${SITE_URL}/article/${post?.slug}`),
    [post?.slug]
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" aria-hidden />
          <span className="sr-only">Loading article</span>
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-[10px] font-black tracking-[0.28em] uppercase text-primary mb-4">404</p>
          <h1 className="font-serif text-4xl font-black mb-4">Story not found</h1>
          <p className="text-muted-foreground mb-6">This piece may have been moved, updated, or pulled.</p>
          <Button asChild>
            <Link to="/">Back home</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const authorKey = (post.author || "Za Ndani").toLowerCase();
  const authorBio = AUTHOR_BIOS[authorKey] || "Za Ndani journalist covering the stories that matter in Kenya.";
  const authorTint = authorColor(post.author);
  const authorInitials = (post.author || "ZN")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const postOgImage = ogImg(post.image);
  const canonicalUrl = `${SITE_URL}/article/${post.slug}`;
  const metaDescription = cleanMetaDescription(post.excerpt || "", post.title);
  const dateObj = new Date(post.date);
  const formattedDate = isNaN(dateObj.getTime())
    ? post.date
    : `${dateObj.toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })} at ${dateObj.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true })} EAT`;

  const showKnow = shouldShowWhatWeKnow({
    category: post.category,
    title: post.title,
    facts: post.knowFacts || [],
  });
  const { lede, rest } = splitLedeHtml(post.htmlContent || "");

  return (
    <Layout>
      <Helmet>
        <title>{post.title} | Za Ndani</title>
        <meta name="description" content={metaDescription} />
        <meta name="author" content={post.author} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={postOgImage} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={postOgImage} />
      </Helmet>

      <div
        ref={progressRef}
        className="fixed top-0 left-0 h-0.5 bg-primary z-50 transition-[width] duration-100"
        style={{ width: 0 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      />

      <div className="container max-w-6xl mx-auto px-4 pt-6 pb-24 lg:pb-12">
        <ArticleBreadcrumbs category={post.category} title={post.title} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <article className="lg:col-span-9 min-w-0">
            <span className={`inline-block text-[10px] font-black tracking-[0.2em] uppercase px-2 py-1 mb-4 ${catColor(post.category)}`}>
              {post.category}
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.12] font-black text-foreground mb-5">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6 pb-6 border-b border-divider">
              <Link
                to={`/author/${(post.author || "za-ndani").toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-flex items-center gap-2 hover:text-primary"
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${authorTint}`} aria-hidden>
                  {authorInitials}
                </span>
                <span className="font-semibold text-foreground">{post.author}</span>
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden />
                <time dateTime={post.date}>{formattedDate}</time>
              </span>
              {post.readTime ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" aria-hidden />
                  {post.readTime} min read
                </span>
              ) : null}
            </div>

            {post.image ? (
              <figure className="mb-8 -mx-4 sm:mx-0 overflow-hidden">
                <img
                  src={proxyImg(post.image, 1200)}
                  alt={post.imageAlt || post.title}
                  className="w-full max-h-[28rem] object-cover"
                  width={1200}
                  height={675}
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                  }}
                />
              </figure>
            ) : null}

            <div className="flex items-center gap-2 mb-8 flex-wrap" role="group" aria-label="Share this story">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mr-1">Share</span>
              <a href={`https://wa.me/?text=${encodeURIComponent(post.title + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-9 h-9 border border-divider hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Share on WhatsApp">
                <MessageCircle className="w-4 h-4" aria-hidden />
              </a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-9 h-9 border border-divider hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Share on X">
                <XIcon className="w-4 h-4" aria-hidden />
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-9 h-9 border border-divider hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Share on Facebook">
                <Facebook className="w-4 h-4" aria-hidden />
              </a>
              <button type="button" onClick={handleCopy} className="inline-flex items-center justify-center w-9 h-9 border border-divider hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Copy link">
                <Share2 className="w-4 h-4" aria-hidden />
              </button>
              {copied ? <span className="text-xs text-primary" role="status">Copied</span> : null}
            </div>

            <div className="prose prose-lg dark:prose-invert measure max-w-[65ch] mx-auto prose-headings:font-serif prose-a:text-primary">
              {lede ? <div dangerouslySetInnerHTML={{ __html: lede }} /> : null}
              {showKnow ? <WhatWeKnow facts={post.knowFacts} /> : null}
              {rest ? <div dangerouslySetInnerHTML={{ __html: rest }} /> : null}
            </div>

            <div className="my-10 flex justify-center border-y border-divider py-4">
              <AdUnit type="horizontal" />
            </div>

            <ArticleReactions slug={post.slug} />
            <ArticlePoll slug={post.slug} title={post.title} category={post.category} />

            <div className="border border-divider p-5 mt-10">
              <div className="flex gap-4 items-start">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${authorTint}`} aria-hidden>
                  {authorInitials}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">The writer</p>
                  <h3 className="font-serif font-bold text-lg">
                    <Link to={`/author/${(post.author || "za-ndani").toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-primary">
                      {post.author}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{authorBio}</p>
                </div>
              </div>
            </div>

            <ArticleComments slug={post.slug} />

            {relatedPosts.length > 0 ? (
              <section className="mt-12" aria-labelledby="related-heading">
                <div className="flex items-center gap-4 mb-5">
                  <h2 id="related-heading" className="text-lg font-black uppercase tracking-tight">
                    Related stories
                  </h2>
                  <div className="h-px flex-1 bg-divider" aria-hidden />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedPosts.map((rp) => (
                    <Link
                      key={rp.slug}
                      to={`/article/${rp.slug}`}
                      className="group block border border-divider overflow-hidden hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="aspect-[16/10] overflow-hidden bg-muted">
                        <img
                          src={proxyImg(rp.image, 400)}
                          alt=""
                          width={400}
                          height={250}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-3">
                        <span className="text-[9px] font-black uppercase tracking-wider text-primary">{rp.category}</span>
                        <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-primary">{rp.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className="hidden lg:block lg:col-span-3" aria-label="Sidebar">
            <div className="sticky top-28 space-y-8">
              <div className="border border-divider bg-muted/10 p-3 flex justify-center">
                <AdUnit type="rectangle" />
              </div>
              <LiveUpdatesTimeline variant="compact" maxItems={8} title="Live Updates" />
            </div>
          </aside>
        </div>
      </div>

      {showScrollTop ? (
        <button type="button" onClick={scrollToTop} className="fixed bottom-24 right-5 lg:bottom-6 lg:right-6 w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center shadow-xl z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Scroll to top">
          <ArrowUp className="w-4 h-4" aria-hidden />
        </button>
      ) : null}

      <StickyMobileShare title={post.title} url={shareUrl} />
    </Layout>
  );
}
