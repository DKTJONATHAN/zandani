import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Clock, ExternalLink, Radio } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { getAllPosts } from "@/lib/markdown";
import { KENYA_WIRE_OUTLETS } from "@/lib/kenya-wire";

const SITE_URL = "https://zandani.co.ke";
const FILTERS = ["All", "News", "Politics", "Sports", "Entertainment", "Business"] as const;

function proxyImg(url: string, w = 640): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return url;
}

function timeLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function LiveWirePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const posts = useMemo(() => getAllPosts().slice(0, 40), []);
  const visible = useMemo(() => {
    if (filter === "All") return posts;
    return posts.filter((post) => (post.category || "").toLowerCase().includes(filter.toLowerCase()));
  }, [filter, posts]);
  const lead = visible[0];
  const rest = visible.slice(1, 16);

  return (
    <Layout>
      <Helmet>
        <title>Live Desk | Breaking Za Ndani stories as they land</title>
        <meta
          name="description"
          content="The Za Ndani live desk: latest Kenyan news, politics, sport and entertainment as soon as our newsroom publishes."
        />
        <link rel="canonical" href={`${SITE_URL}/live`} />
      </Helmet>

      <div className="bg-background text-foreground min-h-screen">
        <section className="border-b border-divider">
          <div className="h-[3px] w-full bg-primary" />
          <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-10 md:py-12">
            <div className="flex items-center gap-2 text-primary text-[11px] font-black uppercase tracking-[0.25em] mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              Live desk
            </div>
            <h1 className="font-serif font-black text-4xl md:text-6xl leading-[0.95] max-w-3xl">
              What Za Ndani is publishing now.
            </h1>
            <p className="text-zinc-400 max-w-2xl mt-4 text-base md:text-lg">
              A running board of our latest stories. No third-party embeds. If it is on this page, it is already on the site.
            </p>
          </div>
        </section>

        <section className="container max-w-7xl mx-auto px-3 sm:px-4 py-6 md:py-10">
          <div className="flex gap-2 overflow-x-auto pb-4">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-black uppercase tracking-wide border ${
                  filter === item
                    ? "bg-primary border-primary text-black"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {lead && (
            <Link to={`/article/${lead.slug}`} className="grid lg:grid-cols-2 gap-6 group mb-10">
              <img
                src={proxyImg(lead.image, 900)}
                alt={lead.title}
                className="w-full h-64 md:h-80 object-cover  bg-zinc-900"
              />
              <div className="flex flex-col justify-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-2">
                  {lead.category} · {timeLabel(lead.date)}
                </p>
                <h2 className="font-serif font-black text-3xl md:text-4xl leading-tight group-hover:text-primary">
                  {lead.title}
                </h2>
                <p className="text-zinc-400 mt-3 line-clamp-3">{lead.excerpt}</p>
              </div>
            </Link>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
            <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
              {rest.map((post, index) => (
                <li key={post.slug}>
                  <Link to={`/article/${post.slug}`} className="flex gap-4 py-4 group">
                    <span className="w-8 shrink-0 text-zinc-600 font-mono text-sm pt-1">{index + 2}</span>
                    <img src={proxyImg(post.image, 240)} alt="" className="w-24 h-16 object-cover rounded-lg bg-zinc-900 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {post.category} · {timeLabel(post.date)}
                      </p>
                      <h3 className="font-bold leading-snug group-hover:text-primary line-clamp-2">{post.title}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>

            <aside className="space-y-6">
              <div className=" border border-zinc-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-black uppercase tracking-wide">Kenya newsrooms</h2>
                </div>
                <p className="text-xs text-zinc-500 mb-3">Official sites. We do not scrape or embed their feeds.</p>
                <div className="space-y-2">
                  {KENYA_WIRE_OUTLETS.map((outlet) => (
                    <div key={outlet.handle} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold">{outlet.name}</p>
                        <p className="text-[11px] text-zinc-500">{outlet.note}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a href={outlet.site} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-sky-400">
                          Site
                        </a>
                        <a href={`https://x.com/${outlet.handle}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-zinc-400">
                          X
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className=" border border-zinc-800 p-4 text-zinc-400 text-sm">
                <Clock className="w-4 h-4 mb-2 text-zinc-500" />
                This desk updates when we publish. Open any story for the full report.
                <Link to="/news" className="mt-3 flex items-center gap-1 text-sky-400 font-bold">
                  All news <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </Layout>
  );
}
