import { useEffect, useRef, useState } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { KENYA_WIRE_OUTLETS, type KenyaWireOutlet } from "@/lib/kenya-wire";

declare global {
  interface Window {
    twttr?: {
      ready: (cb: () => void) => void;
      widgets: { load: (el?: HTMLElement) => Promise<unknown> };
    };
  }
}

function avatarUrl(handle: string) {
  return `https://unavatar.io/twitter/${encodeURIComponent(handle)}?fallback=https://zandani.co.ke/logo.png`;
}

function loadXWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-kenya-wire-widgets]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      if (window.twttr?.widgets) resolve();
      setTimeout(() => resolve(), 2500);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.dataset.kenyaWireWidgets = "1";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
}

export function XTimeline({ outlet, height = 720 }: { outlet: KenyaWireOutlet; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [embedFailed, setEmbedFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEmbedFailed(false);

    const timer = window.setTimeout(() => {
      const hasIframe = !!ref.current?.querySelector("iframe");
      if (!cancelled && !hasIframe) setEmbedFailed(true);
    }, 5000);

    loadXWidgets().then(() => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = "";
      const anchor = document.createElement("a");
      anchor.className = "twitter-timeline";
      anchor.href = `https://x.com/${outlet.handle}?ref_src=twsrc%5Etfw`;
      anchor.setAttribute("data-height", String(height));
      anchor.setAttribute("data-theme", "dark");
      anchor.setAttribute("data-chrome", "nofooter noborders transparent");
      anchor.setAttribute("data-dnt", "true");
      anchor.textContent = `Posts from @${outlet.handle}`;
      ref.current.appendChild(anchor);

      const load = () => window.twttr?.widgets?.load(ref.current || undefined);
      if (window.twttr?.ready) window.twttr.ready(load);
      else load();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [outlet.handle, height]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-3 min-w-0">
          <img src={avatarUrl(outlet.handle)} alt={outlet.name} className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{outlet.name}</p>
            <p className="text-xs text-zinc-400 truncate">@{outlet.handle} · {outlet.note}</p>
          </div>
        </div>
        <a
          href={`https://x.com/${outlet.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300"
        >
          Open X <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {embedFailed && (
        <div className="px-5 py-8 text-center border-b border-zinc-800">
          <p className="text-white font-bold mb-2">X is blocking the in-page timeline right now.</p>
          <p className="text-sm text-zinc-400 mb-4">
            Their embed servers rate-limit or refuse the iframe. The official profile still works.
          </p>
          <a
            href={`https://x.com/${outlet.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 text-black font-black text-sm px-5 py-2.5"
          >
            View @{outlet.handle} on X <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      <div ref={ref} className="min-h-[240px] bg-black" />
    </div>
  );
}

export function KenyaWireBoard({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState(KENYA_WIRE_OUTLETS[0].handle);
  const outlet = KENYA_WIRE_OUTLETS.find((item) => item.handle === active) || KENYA_WIRE_OUTLETS[0];

  return (
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:gap-6">
      <aside className="lg:sticky lg:top-28 h-fit">
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {KENYA_WIRE_OUTLETS.map((item) => {
            const selected = item.handle === active;
            return (
              <button
                key={item.handle}
                type="button"
                onClick={() => setActive(item.handle)}
                className={`flex-shrink-0 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-sky-400 bg-sky-400/10 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${item.accent}`} />
                <img src={avatarUrl(item.handle)} alt={item.name} className="w-8 h-8 rounded-full object-cover hidden sm:block" />
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-wide truncate">{item.name}</span>
                  <span className="block text-[11px] text-zinc-500 truncate">@{item.handle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <XTimeline outlet={outlet} height={compact ? 560 : 740} />
    </div>
  );
}

export function KenyaWireStrip() {
  return (
    <section className="py-6 bg-zinc-950 border-y border-zinc-800">
      <div className="container max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-white">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-wide">Kenya Wire</h2>
          </div>
          <Link to="/live" className="text-xs font-bold text-sky-400 uppercase tracking-wider hover:underline">
            Full board
          </Link>
        </div>
        <KenyaWireBoard compact />
      </div>
    </section>
  );
}
