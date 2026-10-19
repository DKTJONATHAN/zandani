import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getLatestPosts } from "@/lib/markdown";
import {
  ChevronLeft, Mail, Eye, BookOpen, Loader2,
  Flame, Clock, ChevronRight, Twitter, Linkedin
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Badge } from "@/components/ui/badge";

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
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

const AUTHOR_COLORS: Record<string, string> = {
  "za ndani":         "bg-primary",
  "mutheu ann":       "bg-purple-600",
  "celestine nzioka": "bg-blue-700",
};
function authorColor(_name: string): string {
  return "bg-primary text-primary-foreground";
}
function authorInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface AuthorProfile {
  name: string;
  role: string;
  bio: string;
  avatar: string;
  location: string;
  socials?: { twitter?: string; linkedin?: string; email?: string };
}

const DEFAULT_PROFILE: AuthorProfile = {
  name: "Guest Contributor",
  role: "Contributing Writer",
  bio: "Contributing writer for Za Ndani bringing you the latest stories from Kenya.",
  avatar: "",
  location: "Kenya",
};

const INITIAL_SHOW = 9;
const LOAD_MORE = 9;

// ═════════════════════════════════════════════════════════════════════════════
// AUTHOR PROFILE PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function AuthorProfilePage() {
  const { authorName } = useParams<{ authorName: string }>();
  const navigate = useNavigate();

  const [authorsDb, setAuthorsDb] = useState<Record<string, AuthorProfile>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  const allPosts = useMemo(() => getLatestPosts(1000), []);

  useEffect(() => {
    const fetchAuthors = () =>
      fetch('/content/authors.json').then(r => r.ok ? r.json() : {}).then(setAuthorsDb).catch(() => {});
    const fetchViews = () =>
      fetch('/api/get-views').then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
    Promise.all([fetchAuthors(), fetchViews()]).finally(() => setIsLoading(false));
  }, []);

  // Reset visible count when author changes
  useEffect(() => { setVisibleCount(INITIAL_SHOW); }, [authorName]);

  const { actualAuthorName, authorPosts } = useMemo(() => {
    if (!authorName) return { actualAuthorName: "", authorPosts: [] };
    const posts = allPosts.filter(p =>
      p.author.toLowerCase().replace(/\s+/g, '-') === authorName
    );
    const actualName = posts.length > 0 ? posts[0].author : authorName.replace(/-/g, ' ');
    return { actualAuthorName: actualName, authorPosts: posts };
  }, [authorName, allPosts]);

  const postsWithViews = useMemo(() =>
    authorPosts.map(post => {
      const clean = post.slug.replace(/^\//, '').replace(/\.md$/, '');
      const v = viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
      return { ...post, views: v > 0 ? v : 47 };
    }),
    [authorPosts, viewCounts]
  );

  const totalViews = useMemo(() =>
    postsWithViews.reduce((sum, p) => sum + p.views, 0),
    [postsWithViews]
  );

  const profile = authorsDb[actualAuthorName] || { ...DEFAULT_PROFILE, name: actualAuthorName };
  const color = authorColor(actualAuthorName);
  const initials = authorInitials(actualAuthorName);
  const hasAvatar = profile.avatar && !profile.avatar.includes("placeholder");

  // Featured post = most viewed
  const featuredPost = useMemo(() =>
    [...postsWithViews].sort((a, b) => b.views - a.views)[0],
    [postsWithViews]
  );
  const feedPosts = postsWithViews.filter(p => p.slug !== featuredPost?.slug);
  const displayedFeed = feedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < feedPosts.length;

  // ── Loading ──
  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-sm uppercase tracking-widest font-bold">Loading author...</p>
        </div>
      </Layout>
    );
  }

  // ── 404 ──
  if (authorPosts.length === 0) {
    return (
      <Layout>
        <div className="container py-32 text-center">
          <h1 className="text-3xl font-serif font-bold mb-4">Author Not Found</h1>
          <p className="text-muted-foreground mb-8">No articles found for this author.</p>
          <button onClick={() => navigate(-1)}
            className="px-6 py-3 bg-primary text-white text-sm font-black uppercase tracking-wider hover:opacity-90 transition-opacity">
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{actualAuthorName} — Author | Za Ndani</title>
        <meta name="description" content={`Read all articles by ${actualAuthorName} on Za Ndani — ${profile.role}. ${profile.bio.slice(0, 100)}`} />
        <link rel="canonical" href={`https://zandani.co.ke/author/${authorName}`} />
        <meta property="og:title" content={`${actualAuthorName} | Za Ndani`} />
        <meta property="og:description" content={profile.bio} />
        <meta property="og:url" content={`https://zandani.co.ke/author/${authorName}`} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Za Ndani" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${actualAuthorName} | Za Ndani`} />
        <meta name="twitter:description" content={profile.bio} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          "name": actualAuthorName,
          "description": profile.bio,
          "url": `https://zandani.co.ke/author/${authorName}`,
          "image": profile.avatar || "https://zandani.co.ke/images/default-avatar.jpg",
          "jobTitle": profile.role
        })}</script>
      </Helmet>

      {/* ── Author hero banner ── */}
      <section className="bg-zinc-950 border-b border-zinc-800">
        {/* Coloured top bar */}
        <div className={`h-1.5 w-full ${color}`} />

        <div className="container max-w-5xl mx-auto px-4 py-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-zinc-400 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span>/</span>
            <Link to="/authors" className="hover:text-zinc-400 transition-colors">Authors</Link>
            <span>/</span>
            <span className="text-zinc-400">{actualAuthorName}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Avatar */}
            {hasAvatar ? (
              <img src={profile.avatar} alt={actualAuthorName}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-zinc-800 shadow-xl flex-shrink-0" />
            ) : (
              <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-white font-black text-3xl flex-shrink-0 ${color} border-4 border-zinc-800 shadow-xl`}>
                {initials}
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`text-[10px] font-black tracking-[0.2em] uppercase text-white px-2.5 py-1 ${color}`}>
                  {profile.role}
                </span>
                <span className="text-zinc-600 text-xs">📍 {profile.location}</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-serif font-black text-white leading-tight mb-3">
                {actualAuthorName}
              </h1>

              <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl border-l-2 border-zinc-700 pl-4 mb-6">
                {profile.bio}
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-6 text-sm mb-6">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="font-black text-white">{authorPosts.length}</span> Articles
                </span>
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="font-black text-white">
                    {totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}
                  </span> Total Views
                </span>
              </div>

              {/* Socials */}
              <div className="flex items-center gap-2">
                {profile.socials?.twitter && (
                  <button onClick={() => window.open(profile.socials?.twitter, '_blank')}
                    className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary hover:text-primary transition-colors">
                    <Twitter className="w-3.5 h-3.5" />
                  </button>
                )}
                {profile.socials?.linkedin && (
                  <button onClick={() => window.open(profile.socials?.linkedin, '_blank')}
                    className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary hover:text-primary transition-colors">
                    <Linkedin className="w-3.5 h-3.5" />
                  </button>
                )}
                {profile.socials?.email && (
                  <button onClick={() => window.location.href = `mailto:${profile.socials?.email}`}
                    className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-primary hover:text-primary transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="py-12 bg-background">
        <div className="container max-w-5xl mx-auto px-4">

          {/* Featured article */}
          {featuredPost && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
                  <Flame className="w-4 h-4" /> Most Read
                </span>
                <div className="h-px flex-1 bg-divider" />
              </div>

              <Link to={`/article/${featuredPost.slug}`} className="group grid md:grid-cols-2 gap-0 border border-divider overflow-hidden hover:border-primary transition-colors">
                <div className="relative overflow-hidden h-56 md:h-auto">
                  <img src={proxyImg(featuredPost.image, 800)} alt={featuredPost.title}
                    loading="eager"
                    className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30 md:block hidden" />
                  <span className={`absolute top-3 left-3 text-[9px] font-black uppercase tracking-widest text-white px-2 py-1 ${catColor(featuredPost.category)}`}>
                    {featuredPost.category}
                  </span>
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-between bg-surface">
                  <div>
                    <Badge className={`text-white border-0 text-[9px] font-black mb-3 ${catColor(featuredPost.category)}`}>
                      {featuredPost.category}
                    </Badge>
                    <h2 className="text-xl md:text-2xl font-serif font-black leading-tight mb-3 group-hover:text-primary transition-colors">
                      {featuredPost.title}
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">
                      {featuredPost.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-divider">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(featuredPost.date)}</span>
                      <span className="flex items-center gap-1 text-primary font-bold">
                        <Eye className="w-3 h-3" />
                        {featuredPost.views > 999 ? `${(featuredPost.views / 1000).toFixed(1)}k` : featuredPost.views}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-black text-primary">
                      Read <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* All articles grid */}
          {displayedFeed.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  All Stories
                  <span className="text-xs font-black text-muted-foreground bg-muted px-2 py-0.5">
                    {authorPosts.length}
                  </span>
                </h2>
                <div className="h-px flex-1 bg-divider" />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedFeed.map(post => (
                  <Link key={post.slug} to={`/article/${post.slug}`} className="group block border border-divider hover:border-primary transition-colors overflow-hidden">
                    <div className="relative h-44 overflow-hidden">
                      <img src={proxyImg(post.image, 400)} alt={post.title} loading="lazy"
                        className="w-full h-full object-cover object-[center_20%] group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className={`absolute bottom-2 left-2 text-[9px] font-black uppercase tracking-widest text-white px-1.5 py-0.5 ${catColor(post.category)}`}>
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
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo(post.date)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 text-center">
                  <button
                    onClick={() => setVisibleCount(v => v + LOAD_MORE)}
                    className="border-2 border-divider hover:border-primary hover:text-primary px-10 py-4 text-xs uppercase tracking-[0.2em] font-black transition-all"
                  >
                    Load More Stories
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </section>
    </Layout>
  );
}
