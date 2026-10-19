import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Post } from "@/lib/markdown";
import { timeAgo } from "@/lib/utils";

interface ArticleCardProps {
  post: Post;
  variant?: "default" | "featured" | "horizontal" | "compact";
  priority?: boolean;
}

function getOptimizedImageUrl(url: string, width: number = 800): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.startsWith("/") || url.endsWith(".svg") || url.includes("data:image")) return url;
  return url;
}

function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

export function ArticleCard({ post, variant = "default", priority = false }: ArticleCardProps) {
  const isLCP = variant === "featured" || priority;
  const optimizedMainImage = getOptimizedImageUrl(post.image, isLCP ? 1200 : 800);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    if (target.src !== post.image && post.image) {
      target.src = post.image;
    }
  };

  if (variant === "featured") {
    return (
      <article className="group relative overflow-hidden bg-zinc-950 aspect-[16/10] md:aspect-[16/9]">
        <img
          src={optimizedMainImage}
          alt={post.imageAlt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-70"
          loading={isLCP ? "eager" : "lazy"}
          fetchPriority={isLCP ? "high" : "auto"}
          decoding="async"
          width={1200}
          height={675}
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
          <span className={`w-fit text-[9px] font-black tracking-widest uppercase text-white px-1.5 py-0.5 mb-3 ${catColor(post.category)}`}>
            {post.category}
          </span>
          <Link to={`/article/${post.slug}`}>
            <h2 className="text-xl md:text-3xl lg:text-4xl font-serif font-bold mb-3 text-white group-hover:text-primary transition-colors line-clamp-3">
              {post.title}
            </h2>
          </Link>
          <p className="text-zinc-300 mb-4 line-clamp-2 max-w-2xl text-sm">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>{post.author}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.date)}</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="group flex gap-4 md:gap-6">
        <Link to={`/article/${post.slug}`} className="flex-shrink-0 w-32 md:w-48">
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            <img
              src={optimizedMainImage}
              alt={post.imageAlt}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              width={384}
              height={288}
              onError={handleImageError}
            />
          </div>
        </Link>
        <div className="flex flex-col justify-center min-w-0">
          <span className={`w-fit text-[9px] font-black tracking-widest uppercase text-white px-1.5 py-0.5 mb-2 ${catColor(post.category)}`}>
            {post.category}
          </span>
          <Link to={`/article/${post.slug}`}>
            <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
              {post.title}
            </h3>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.date)}</span>
            <span>·</span>
            <span>{post.readTime} min</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="group flex items-start gap-4 py-4 border-b border-divider last:border-0">
        <div>
          <Link to={`/article/${post.slug}`}>
            <h4 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
              {post.title}
            </h4>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{post.category}</span>
            <span>·</span>
            <span>{timeAgo(post.date)}</span>
            <span>·</span>
            <span>{post.readTime} min read</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group">
      <Link to={`/article/${post.slug}`} className="block mb-4">
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={optimizedMainImage}
            alt={post.imageAlt}
            width={800}
            height={500}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={handleImageError}
          />
        </div>
      </Link>
      <span className={`inline-block text-[9px] font-black tracking-widest uppercase text-white px-1.5 py-0.5 mb-3 ${catColor(post.category)}`}>
        {post.category}
      </span>
      <Link to={`/article/${post.slug}`}>
        <h3 className="font-serif font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
      </Link>
      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
        {post.excerpt}
      </p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{post.author}</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(post.date)}
        </span>
      </div>
    </article>
  );
}
