import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { getLatestPosts, PostMetadata } from "@/lib/markdown";
import { Eye, BookOpen, TrendingUp, ChevronRight, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";

// ─── CATEGORY COLOR MAP ──────────────────────────────────────────────────────
function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

// ─── IMAGE PROXY ─────────────────────────────────────────────────────────────
function proxyImg(url: string, w = 400): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

// ─── RELATIVE TIME ────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

// ─── AUTHOR COLORS & INITIALS ─────────────────────────────────────────────────
const AUTHOR_COLORS: Record<string, string> = {
  "za ndani":        "bg-primary",
  "mutheu ann":      "bg-purple-600",
  "celestine nzioka":"bg-blue-700",
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

interface AuthorStats {
  name: string;
  totalViews: number;
  articleCount: number;
  latestArticles: PostMetadata[];
  profile: AuthorProfile;
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTHORS PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function AuthorsPage() {
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [authorsDb, setAuthorsDb] = useState<Record<string, AuthorProfile>>({});
  const [isLoading, setIsLoading] = useState(true);

  const allPosts = useMemo(() => getLatestPosts(1000), []);

  useEffect(() => {
    const fetchViews = () =>
      fetch('/api/get-views').then(r => r.ok ? r.json() : {}).then(setViewCounts).catch(() => {});
    const fetchAuthors = () =>
      fetch('/content/authors.json').then(r => r.ok ? r.json() : {}).then(setAuthorsDb).catch(() => {});
    Promise.all([fetchViews(), fetchAuthors()]).finally(() => setIsLoading(false));
  }, []);

  const authorsData = useMemo<AuthorStats[]>(() => {
    const map = new Map<string, AuthorStats>();
    allPosts.forEach(post => {
      const clean = post.slug.replace(/^\//, '').replace(/\.md$/, '');
      const v = viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
      const postViews = v > 0 ? v : 0;

      if (!map.has(post.author)) {
        map.set(post.author, {
          name: post.author,
          totalViews: 0,
          articleCount: 0,
          latestArticles: [],
          profile: authorsDb[post.author] || { ...DEFAULT_PROFILE, name: post.author },
        });
      }
      const s = map.get(post.author)!;
      s.totalViews += postViews;
      s.articleCount += 1;
      if (s.latestArticles.length < 3) s.latestArticles.push(post);
    });
    return Array.from(map.values()).sort((a, b) => b.totalViews - a.totalViews);
  }, [allPosts, viewCounts, authorsDb]);

  const topAuthors = authorsData.slice(0, 3);
  const restAuthors = authorsData.slice(3);

  return (
    <Layout>
      <Helmet>
        <title>Our Authors | Za Ndani — Kenya News & Entertainment</title>
        <meta name="description" content="Meet the journalists and writers behind Za Ndani — Kenya's sharpest entertainment and news site." />
        <link rel="canonical" href="https://zandani.co.ke/authors" />
        <meta property="og:title" content="Our Authors | Za Ndani" />
        <meta property="og:description" content="Meet the journalists and writers behind Za Ndani — Kenya's sharpest entertainment and news site." />
        <meta property="og:url" content="https://zandani.co.ke/authors" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Za Ndani" />
      </Helmet>

      <section className="border-b border-divider bg-background">
        <div className="h-[3px] w-full bg-primary" />
        <div className="container max-w-6xl mx-auto px-4 py-12 md:py-14">
          <p className="text-[10px] font-black tracking-[0.28em] uppercase text-primary mb-4">The desk</p>
          <h1 className="text-4xl md:text-6xl font-serif font-black leading-[0.95] mb-4">
            Meet the writers
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            The journalists and pop-culture desks bringing Kenya the stories that will not wait for a press conference.
          </p>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="container max-w-6xl mx-auto px-4">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-sm uppercase tracking-widest font-bold">Loading authors...</p>
            </div>
          ) : (
            <>
              {/* ── TOP VOICES ── */}
              {topAuthors.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" /> Top Voices
                    </h2>
                    <div className="h-px flex-1 bg-divider" />
                  </div>

                  <div className="grid md:grid-cols-12 gap-4">

                    {/* Lead author — large card */}
                    {topAuthors[0] && (() => {
                      const author = topAuthors[0];
                      const color = authorColor(author.name);
                      const initials = authorInitials(author.name);
                      return (
                        <div className="md:col-span-7 border border-divider bg-surface flex flex-col overflow-hidden">
                          {/* Colour bar */}
                          <div className={`h-1.5 w-full ${color}`} />
                          <div className="p-8 flex flex-col flex-1">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                              <div className="flex items-center gap-4">
                                {author.profile.avatar && !author.profile.avatar.includes("placeholder") ? (
                                  <img src={author.profile.avatar} alt={author.name}
                                    className="w-20 h-20 rounded-full object-cover border-4 border-background shadow" />
                                ) : (
                                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-2xl flex-shrink-0 ${color}`}>
                                    {initials}
                                  </div>
                                )}
                                <div>
                                  <Link to={`/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                    <h3 className="text-2xl font-serif font-black text-foreground hover:text-primary transition-colors">
                                      {author.name}
                                    </h3>
                                  </Link>
                                  <p className="text-primary text-sm font-bold mt-0.5">{author.profile.role}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{author.profile.location}</p>
                                </div>
                              </div>
                              <Badge className={`text-white border-0 text-[10px] font-black tracking-wider ${color}`}>
                                #1 Voice
                              </Badge>
                            </div>

                            {/* Bio */}
                            <p className="text-muted-foreground text-sm leading-relaxed border-l-2 border-primary/40 pl-4 mb-6">
                              {author.profile.bio}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-6 text-sm mb-6">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <BookOpen className="w-4 h-4 text-primary" />
                                <span className="font-black text-foreground">{author.articleCount}</span> Articles
                              </span>
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Eye className="w-4 h-4 text-primary" />
                                <span className="font-black text-foreground">
                                  {author.totalViews > 999 ? `${(author.totalViews / 1000).toFixed(1)}k` : author.totalViews}
                                </span> Views
                              </span>
                            </div>

                            {/* Latest articles */}
                            {author.latestArticles.length > 0 && (
                              <div className="border-t border-divider pt-5 mt-auto space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Latest Stories</p>
                                {author.latestArticles.slice(0, 2).map(post => (
                                  <Link key={post.slug} to={`/article/${post.slug}`}
                                    className="flex gap-3 group items-start">
                                    <div className="w-14 h-14 flex-shrink-0 overflow-hidden">
                                      <img src={proxyImg(post.image, 120)} alt={post.title} loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className={`text-[9px] font-black uppercase tracking-wider text-white px-1.5 py-0.5 mb-1 inline-block ${catColor(post.category)}`}>
                                        {post.category}
                                      </span>
                                      <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                        {post.title}
                                      </h4>
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />{timeAgo(post.date)}
                                      </span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}

                            <Link
                              to={`/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}
                              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary hover:underline mt-5"
                            >
                              All stories <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Secondary top authors */}
                    <div className="md:col-span-5 flex flex-col gap-4">
                      {topAuthors.slice(1).map((author, i) => {
                        const color = authorColor(author.name);
                        const initials = authorInitials(author.name);
                        return (
                          <div key={author.name} className="border border-divider bg-surface flex flex-col overflow-hidden flex-1">
                            <div className={`h-1 w-full ${color}`} />
                            <div className="p-6 flex flex-col flex-1">
                              <div className="flex items-center gap-3 mb-4">
                                {author.profile.avatar && !author.profile.avatar.includes("placeholder") ? (
                                  <img src={author.profile.avatar} alt={author.name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-background shadow flex-shrink-0" />
                                ) : (
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 ${color}`}>
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <Link to={`/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                    <h3 className="font-black text-base text-foreground hover:text-primary transition-colors truncate">
                                      {author.name}
                                    </h3>
                                  </Link>
                                  <p className="text-xs text-primary font-bold">{author.profile.role}</p>
                                </div>
                                <Badge className={`text-white border-0 text-[9px] font-black flex-shrink-0 ${color}`}>
                                  #{i + 2}
                                </Badge>
                              </div>

                              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-4">
                                {author.profile.bio}
                              </p>

                              <div className="flex items-center gap-5 text-xs text-muted-foreground mt-auto pt-4 border-t border-divider">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-primary" />
                                  <span className="font-black text-foreground">{author.articleCount}</span> Articles
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-primary" />
                                  <span className="font-black text-foreground">
                                    {author.totalViews > 999 ? `${(author.totalViews / 1000).toFixed(1)}k` : author.totalViews}
                                  </span> Views
                                </span>
                                <Link
                                  to={`/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  className="ml-auto flex items-center gap-1 text-primary font-black hover:underline"
                                >
                                  View <ChevronRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ALL CONTRIBUTORS ── */}
              {restAuthors.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-xl font-black uppercase tracking-tight">All Contributors</h2>
                    <div className="h-px flex-1 bg-divider" />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {restAuthors.map(author => {
                      const color = authorColor(author.name);
                      const initials = authorInitials(author.name);
                      return (
                        <Link
                          key={author.name}
                          to={`/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}
                          className="group border border-divider bg-surface hover:border-primary transition-colors overflow-hidden block"
                        >
                          <div className={`h-1 w-full ${color}`} />
                          <div className="p-5 flex flex-col items-center text-center">
                            {author.profile.avatar && !author.profile.avatar.includes("placeholder") ? (
                              <img src={author.profile.avatar} alt={author.name}
                                className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-background shadow" />
                            ) : (
                              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg mb-3 ${color}`}>
                                {initials}
                              </div>
                            )}
                            <h3 className="font-black text-sm text-foreground group-hover:text-primary transition-colors mb-0.5">
                              {author.name}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mb-4">{author.profile.role}</p>

                            {/* Latest article thumbnail */}
                            {author.latestArticles[0] && (
                              <div className="w-full mb-4">
                                <div className="relative overflow-hidden h-24 w-full">
                                  <img
                                    src={proxyImg(author.latestArticles[0].image, 300)}
                                    alt={author.latestArticles[0].title}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                  <span className={`absolute bottom-1.5 left-1.5 text-[9px] font-black uppercase text-white px-1.5 py-0.5 ${catColor(author.latestArticles[0].category)}`}>
                                    {author.latestArticles[0].category}
                                  </span>
                                </div>
                                <p className="text-[11px] font-bold leading-snug line-clamp-2 mt-2 text-left group-hover:text-primary transition-colors">
                                  {author.latestArticles[0].title}
                                </p>
                              </div>
                            )}

                            <div className="w-full pt-3 border-t border-divider flex justify-between text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />{author.articleCount} posts
                              </span>
                              <span className="flex items-center gap-1 text-primary font-black">
                                Profile <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {authorsData.length === 0 && (
                <div className="py-32 text-center text-muted-foreground">
                  <p className="font-serif italic text-xl">No authors found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
