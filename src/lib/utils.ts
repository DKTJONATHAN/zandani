import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Blackout system uses one orange. Rainbow category chips are retired. */
export function catColor(_cat?: string): string {
  return "bg-primary text-primary-foreground";
}

export function catAccent(_cat?: string): string {
  return "border-primary";
}

export function authorColor(_name?: string): string {
  return "bg-primary text-primary-foreground";
}

export const PLACEHOLDER_IMG = "/images/default-og.svg";

export function proxyImg(url: string, w = 800): string {
  if (!url) return PLACEHOLDER_IMG;
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=${w}&output=webp&q=80&we`;
}

/** Strip keyword-stuff prefixes from excerpts / meta for display. */
export function cleanExcerpt(raw: string, fallbackTitle = ""): string {
  let d = (raw || "").replace(/\s+/g, " ").trim();
  d = d.replace(/^([a-z0-9][a-z0-9\s\-]{6,90}?):\s+/i, "");
  d = d.replace(/^[a-z0-9][a-z0-9\s\-]{6,60}?\s+from:\s+/i, "");
  if (d && d[0] === d[0].toLowerCase()) {
    d = d[0].toUpperCase() + d.slice(1);
  }
  if (!d || d.length < 20) {
    d = fallbackTitle
      ? `${fallbackTitle}. Latest reporting from Kenya on Za Ndani.`
      : "Latest reporting from Kenya on Za Ndani.";
  }
  return d;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Absolute calendar date for cards older than 24h, e.g. Tue, 13th Jan 2026 */
export function formatPublishDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const day = ordinal(d.getDate());
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Relative time under 24h (Just now / 5m ago / 3h ago).
 * From 24h onward: absolute date — Tue, 13th Jan 2026.
 */
export function timeAgo(dateStr: string): string {
  const dateObj = new Date(dateStr);
  if (Number.isNaN(dateObj.getTime())) return "Recently";
  const diff = Date.now() - dateObj.getTime();
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (mins < 5) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (h < 24) return `${h}h ago`;
  return formatPublishDate(dateStr);
}
