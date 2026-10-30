import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const CATEGORY_PATH: Record<string, string> = {
  news: "/news",
  politics: "/news",
  national: "/news",
  opinions: "/news",
  entertainment: "/entertainment",
  gossip: "/entertainment",
  showbiz: "/entertainment",
  celebrity: "/entertainment",
  music: "/entertainment",
  sports: "/sports",
  sport: "/sports",
  business: "/business",
  finance: "/business",
  economy: "/business",
  lifestyle: "/lifestyle",
  fashion: "/lifestyle",
  health: "/lifestyle",
  travel: "/lifestyle",
};

export function ArticleBreadcrumbs({
  category,
  title,
}: {
  category?: string;
  title?: string;
}) {
  const cat = (category || "news").toLowerCase();
  const path = CATEGORY_PATH[cat] || `/category/${cat}`;
  const label = category || "News";

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mb-4">
      <Link to="/" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
        <Home className="w-3 h-3" />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>
      <ChevronRight className="w-3 h-3 opacity-40" />
      <Link to={path} className="hover:text-primary transition-colors capitalize">
        {label}
      </Link>
      {title && (
        <>
          <ChevronRight className="w-3 h-3 opacity-40" />
          <span className="text-foreground/80 line-clamp-1 max-w-[12rem] sm:max-w-xs">{title}</span>
        </>
      )}
    </nav>
  );
}
