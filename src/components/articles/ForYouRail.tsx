import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Clock } from "lucide-react";
import { getAllPosts, type PostMetadata } from "@/lib/markdown";
import { topCategories } from "@/hooks/usePreferences";
import { timeAgo } from "@/lib/utils";

function img(url: string, w = 400): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

function postTime(p: PostMetadata): number {
  const t = new Date(p.date).getTime();
  return isNaN(t) ? 0 : t;
}

/** Personalized rail from local category affinity (trackCategoryView on article pages). */
export function ForYouRail({ limit = 6 }: { limit?: number }) {
  const posts = useMemo(() => {
    const all = getAllPosts().slice(0, 80);
    const tops = topCategories(3).map((c) => c.toLowerCase());
    if (!tops.length) return all.slice(0, limit);
    return all
      .map((p) => {
        const cat = (p.category || "").toLowerCase();
        let score = 0;
        const idx = tops.indexOf(cat);
        if (idx === 0) score += 15;
        else if (idx === 1) score += 10;
        else if (idx === 2) score += 6;
        const ageDays = (Date.now() - postTime(p)) / 86400000;
        if (ageDays < 2) score += 5;
        else if (ageDays < 7) score += 2;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || postTime(b.p) - postTime(a.p))
      .slice(0, limit)
      .map((x) => x.p);
  }, [limit]);

  if (!posts.length) return null;

  return (
    <section className="mb-10" aria-label="For you">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest">For You</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {posts.map((post) => (
          <Link key={post.slug} to={`/article/${post.slug}`} className="group block">
            <article>
              <div className="relative aspect-[4/3] overflow-hidden bg-muted border-t-[3px] border-primary">
                <img
                  src={img(post.image, 360)}
                  alt={post.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="pt-2">
                <span className="inline-block text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 mb-1 bg-primary text-primary-foreground">
                  {post.category}
                </span>
                <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-[13px] leading-snug">
                  {post.title}
                </h3>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeAgo(post.date)}
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
