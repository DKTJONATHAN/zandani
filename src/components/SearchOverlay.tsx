import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { searchPosts, PostMetadata } from "@/lib/markdown";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostMetadata[]>([]);
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length >= 2) setResults(searchPosts(cleanQuery));
    else setResults([]);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.trim();

  return (
    <div
      id="search-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-overlay-title"
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="container max-w-3xl max-h-[100dvh] overflow-y-auto pt-12 pb-10 sm:pt-20"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="search-overlay-title" className="sr-only">Search Za Ndani</h2>
        <div className="flex items-center gap-3 sm:gap-4 mb-8">
          <form className="relative flex-1 min-w-0 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (cleanQuery.length >= 2) { onClose(); navigate(`/search?q=${encodeURIComponent(cleanQuery)}`); } }}>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              placeholder="Search news, names, teams…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full min-h-14 pl-12 pr-4 py-4 text-base sm:text-lg bg-surface border border-divider rounded-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-smooth"
              aria-label="Search Za Ndani stories"
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={cleanQuery.length < 2} className="min-h-14 px-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-40" aria-label="View all search results">
            Search <ArrowRight className="inline w-4 h-4 ml-1" aria-hidden />
          </button>
          </form>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 flex items-center justify-center border border-divider hover:border-primary hover:text-primary transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto" aria-live="polite" aria-relevant="additions text">
          {cleanQuery.length >= 2 && results.length === 0 && (
            <p className="text-center text-muted-foreground py-12" role="status">
              No results found for “{cleanQuery}”. Try a name, topic or shorter phrase.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4" role="status">
                Found {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((post) => (
                <Link
                  key={post.slug}
                  to={`/article/${post.slug}`}
                  onClick={onClose}
                  className="flex gap-4 p-3 sm:p-4 bg-surface rounded-none hover:bg-surface/80 border border-divider hover:border-primary transition-colors group"
                >
                  <img
                    src={post.image || "/images/placeholder.jpg"}
                    alt={post.title}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                      {post.category}
                    </span>
                    <h3 className="font-serif font-bold text-headline group-hover:text-primary transition-colors line-clamp-2 mt-1">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {post.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                to={`/search?q=${encodeURIComponent(cleanQuery)}`}
                onClick={onClose}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary hover:underline underline-offset-4"
              >
                View all search results <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          )}

          {cleanQuery.length < 2 && (
            <p className="text-center text-muted-foreground py-12">
              Type at least 2 characters to search the newsroom.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
