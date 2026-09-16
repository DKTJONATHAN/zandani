import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { Clock } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { getAllPosts } from "@/lib/markdown";
import { proxyImg, timeAgo } from "@/lib/utils";

const HUBS: Record<string, { title: string; intro: string; kicker: string; keywords: string[] }> = {
  energy: {
    title: "Kenya energy news",
    kicker: "EPRA · fuel · power",
    intro: "Fuel reviews, KPLC blackouts, tariffs and the policy that shows up on your bill. What changed, what it costs, what to watch next.",
    keywords: ["epra", "fuel", "electricity", "power", "token", "petrol", "diesel", "kplc"]
  },
  education: {
    title: "Kenya education news",
    kicker: "KUCCPS · TSC · exams",
    intro: "Placement windows, TSC circulars, cluster points and campus decisions — written so a parent in Nyeri can act on it.",
    keywords: ["kuccps", "university", "tsc", "cluster points", "kcse", "placement", "admission"]
  },
  finance: {
    title: "Kenya finance news",
    kicker: "Banks · CBK · NSE",
    intro: "Lending rates, forex, bonds and the bank notices that move household money. One board for the week’s market.",
    keywords: ["kcb", "bank", "forex", "bonds", "economy", "cbk", "loan", "interest"]
  },
};

export default function HubPage() {
  const { pathname } = useLocation();
  const hub = pathname.replace(/^\//, "").split("/")[0];
  const config = hub ? HUBS[hub] : undefined;
  const posts = getAllPosts();
  const filtered = config
    ? posts.filter((p) => {
        const hay = `${p.title} ${p.excerpt} ${p.category} ${(p.tags || []).join(" ")}`.toLowerCase();
        return config.keywords.some((k) => hay.includes(k));
      })
    : [];

  if (!config) {
    return (
      <Layout>
        <Helmet>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <PageHero kicker="404" title="Hub not found" dek="That desk does not exist on Za Ndani." />
      </Layout>
    );
  }

  const lead = filtered[0];
  const rest = filtered.slice(1, 24);
  const canonical = `https://zandani.co.ke/${hub}`;

  return (
    <Layout>
      <Helmet>
        <title>{config.title} | Za Ndani</title>
        <meta name="description" content={config.intro.slice(0, 155)} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content={filtered.length ? "index, follow" : "noindex, follow"} />
      </Helmet>
      <PageHero
        kicker={config.kicker}
        title={config.title}
        dek={config.intro}
        meta={<p className="text-sm text-muted-foreground"><span className="font-black text-foreground">{filtered.length}</span> stories on this desk</p>}
      />
      <div className="container max-w-7xl mx-auto px-4 py-10 md:py-14">
        {lead ? (
          <Link to={`/article/${lead.slug}`} className="group grid lg:grid-cols-2 gap-6 mb-12 border border-divider hover:border-primary/50 transition-colors">
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img src={proxyImg(lead.image, 1000)} alt={lead.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
            <div className="flex flex-col justify-center p-5 lg:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">{lead.category}</p>
              <h2 className="font-serif font-black text-3xl md:text-4xl leading-tight group-hover:text-primary">{lead.title}</h2>
              <p className="text-muted-foreground mt-3 line-clamp-3">{lead.excerpt}</p>
              <p className="text-xs text-muted-foreground mt-4 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {timeAgo(lead.date)} · {lead.author}
              </p>
            </div>
          </Link>
        ) : (
          <p className="text-muted-foreground">No stories on this desk yet.</p>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((p) => (
            <Link key={p.slug} to={`/article/${p.slug}`} className="group border border-divider hover:border-primary/50 transition-colors overflow-hidden">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img src={proxyImg(p.image, 480)} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary mb-2">{p.category}</p>
                <h3 className="font-serif font-bold leading-snug group-hover:text-primary">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-2">{timeAgo(p.date)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
