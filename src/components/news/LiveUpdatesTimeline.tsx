import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { getAllPosts, getPostsByCategory } from "@/lib/markdown";

function proxyImg(url: string, w = 120): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

/** Parse a post date safely — returns null if invalid. */
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  // Fallback for formats like "2026-09-07 10:00" without T
  d = new Date(String(dateStr).replace(/-/g, "/").replace("T", " "));
  return isNaN(d.getTime()) ? null : d;
}

function isWithinHours(dateStr: string, hours: number): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return Date.now() - d.getTime() < hours * 3600000;
}

function safeIso(dateStr: string): string {
  const d = parseDate(dateStr);
  return d ? d.toISOString() : "";
}

function safeTimeLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

interface LiveUpdatesTimelineProps {
  /** Filter to a specific category slug, or show all if omitted */
  category?: string;
  /** Max number of items to show */
  maxItems?: number;
  /** Variant: 'full' for standalone section, 'compact' for sidebar widget */
  variant?: "full" | "compact";
  /** Title override */
  title?: string;
}

export function LiveUpdatesTimeline({
  category,
  maxItems = 15,
  variant = "full",
  title = "Live Updates",
}: LiveUpdatesTimelineProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const liveUpdates = useMemo(() => {
    const posts = category ? getPostsByCategory(category) : getAllPosts();
    return posts.filter((p) => isWithinHours(p.date, 24)).slice(0, maxItems);
  }, [category, maxItems, now]);

  if (liveUpdates.length === 0) return null;

  if (variant === "compact") {
    return (
      <div className="border border-divider">
        <div className="bg-primary h-1" />
        <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
        </div>
        <div className="divide-y divide-divider max-h-[350px] overflow-y-auto scrollbar-thin">
          {liveUpdates.slice(0, 8).map((post) => (
            <Link
              key={post.slug}
              to={`/article/${post.slug}`}
              className="group flex gap-3 p-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <time
                    dateTime={safeIso(post.date)}
                    className="text-[10px] text-muted-foreground tabular-nums font-mono"
                  >
                    {safeTimeLabel(post.date)}
                  </time>
                  {isWithinHours(post.date, 1) && (
                    <span className="text-[8px] font-black text-primary uppercase">New</span>
                  )}
                </div>
                <h4 className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h4>
              </div>
              <img
                src={proxyImg(post.image, 80)}
                alt={post.title}
                loading="lazy"
                className="w-14 h-10 object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-muted/30 border-b border-border py-6">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-5">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary">
            <Radio className="w-4 h-4 animate-pulse" /> {title}
          </span>
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })} EAT
          </span>
        </div>

        <div className="relative pl-6 border-l-2 border-border space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
          {liveUpdates.map((post) => (
            <Link key={post.slug} to={`/article/${post.slug}`} className="group block relative">
              <div
                className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-border ${
                  isWithinHours(post.date, 1) ? "bg-primary animate-pulse" : "bg-muted-foreground/50"
                }`}
              />
              <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <time
                      dateTime={safeIso(post.date)}
                      className="text-[10px] text-muted-foreground tabular-nums font-mono"
                    >
                      {safeTimeLabel(post.date)}
                    </time>
                    <span
                      className={`text-[8px] font-black uppercase tracking-widest text-white px-1 py-0.5 ${
                        catColor(post.category)
                      }`}
                    >
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
                <img
                  src={proxyImg(post.image, 120)}
                  alt=""
                  loading="lazy"
                  className="w-16 h-12 object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
