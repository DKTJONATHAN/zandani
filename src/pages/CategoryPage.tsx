import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { getAllPosts } from "@/lib/markdown";
import { TrendingUp, ArrowRight } from "lucide-react";
import AdUnit from "@/components/AdUnit";
import { timeAgo } from "@/lib/utils";

const SITE_URL="https://zandani.co.ke";
const CONFIG: Record<string,{title:string;label:string;description:string;match:RegExp;canonical:string}> = {
 news:{title:"Kenya News",label:"News",description:"Breaking and developing stories from Kenya, counties and beyond.",match:/news|politic|kenya|current/i,canonical:"/news"},
 politics:{title:"Kenya Politics",label:"Politics",description:"Politics, government, Parliament, elections and public affairs.",match:/politic/i,canonical:"/news"},
 opinions:{title:"Opinion",label:"Opinion",description:"Commentary, analysis and perspectives from Za Ndani.",match:/opinion|column/i,canonical:"/category/opinions"},
 showbiz:{title:"Showbiz",label:"Showbiz",description:"Kenyan entertainment, celebrities, music, television and culture.",match:/entertainment|showbiz|gossip/i,canonical:"/entertainment"},
 entertainment:{title:"Entertainment",label:"Entertainment",description:"The latest entertainment stories from Kenya and beyond.",match:/entertainment|showbiz|gossip/i,canonical:"/entertainment"},
 gossip:{title:"Gossip",label:"Gossip",description:"Celebrity news, viral moments and the stories people are talking about.",match:/gossip|entertainment|showbiz/i,canonical:"/entertainment"},
 sports:{title:"Sports",label:"Sports",description:"Football, athletics and the sporting stories shaping Kenya.",match:/sport/i,canonical:"/sports"},
 business:{title:"Business",label:"Business",description:"Business, money, markets, jobs and the Kenyan economy.",match:/business|econom/i,canonical:"/business"},
 lifestyle:{title:"Lifestyle",label:"Lifestyle",description:"Lifestyle, people, health, culture and everyday Kenyan life.",match:/lifestyle|culture|health/i,canonical:"/lifestyle"},
};
type Post=ReturnType<typeof getAllPosts>[0];
function image(url:string,width=700){if(!url)return "/images/placeholder.jpg";if(url.startsWith("/")||url.endsWith(".svg"))return url;return "https://wsrv.nl/?url="+encodeURIComponent(url.replace(/^https?:\/\//,""))+"&w="+width+"&output=webp&q=80&we";}
function Story({post}:{post:Post}){return <Link to={"/article/"+post.slug} className="category-story group"><img src={image(post.image,520)} alt="" loading="lazy"/><div className="category-story__body"><div className="section-kicker">{post.category}</div><h2>{post.title}</h2><p>{post.excerpt}</p><div className="category-story__meta">{post.author} · {timeAgo(post.date)}</div></div></Link>;}
function Ranked({posts}:{posts:Post[]}){return <div className="category-ranked">{posts.map((p,i)=><Link key={p.slug} to={"/article/"+p.slug} className="category-ranked__item group"><b>{String(i+1).padStart(2,"0")}</b><div><div className="section-kicker">{p.category}</div><h3>{p.title}</h3><span>{timeAgo(p.date)}</span></div></Link>)}</div>;}

export default function CategoryPage(){
 const {slug="news"}=useParams<{slug:string}>();
 const cfg=CONFIG[slug.toLowerCase()]||CONFIG.news;
 const all=getAllPosts();
 const posts=all.filter(p=>cfg.match.test((p.category||"")+" "+p.title+" "+(p.tags||[]).join(" "))).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,80);
 const lead=posts[0],secondary=posts.slice(1,4),feed=posts.slice(4);
 const trending=[...all].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,7);
 return <Layout>
  <Helmet><title>{cfg.title} | Za Ndani</title><meta name="description" content={cfg.description}/><meta name="robots" content="index, follow, max-image-preview:large"/><link rel="canonical" href={SITE_URL+cfg.canonical}/><meta property="og:title" content={cfg.title+" | Za Ndani"}/><meta property="og:description" content={cfg.description}/><meta property="og:url" content={SITE_URL+cfg.canonical}/><meta property="og:type" content="website"/></Helmet>
  <div className="news-category">
   <div className="news-category__crumb"><div className="container max-w-7xl mx-auto px-4"><Link to="/">Home</Link><span>/</span><strong>{cfg.label}</strong></div></div>
   <main className="container max-w-7xl mx-auto px-4 py-7 lg:py-10">
    <header className="news-category__header"><div className="section-kicker">{cfg.label}</div><h1>{cfg.title}</h1><p>{cfg.description}</p></header>
    {lead && <section className="news-category__lead">
      <Link to={"/article/"+lead.slug} className="news-category__hero group"><img src={image(lead.image,1300)} alt={lead.title}/><div className="news-category__hero-copy"><div className="section-kicker">{lead.category}</div><h2>{lead.title}</h2><p>{lead.excerpt}</p><span>{lead.author} · {timeAgo(lead.date)}</span></div></Link>
      <div className="news-category__secondary">{secondary.map(p=><Story key={p.slug} post={p}/>)}</div>
    </section>}
    <div className="news-category__grid">
      <section><div className="news-category__section-title"><h2>Latest {cfg.label}</h2><span>{feed.length} stories</span></div>{feed.map(p=><Story key={p.slug} post={p}/>)}{feed.length>8&&<div className="news-category__load"><Link to={"/search?q="+encodeURIComponent(cfg.label)}>Find more {cfg.label}<ArrowRight className="w-4 h-4"/></Link></div>}</section>
      <aside className="news-category__aside"><div><div className="news-category__section-title"><h2><TrendingUp className="w-4 h-4 text-primary"/> Trending Now</h2></div><Ranked posts={trending}/></div><div className="border border-divider p-3"><AdUnit type="rectangle"/></div><div><div className="news-category__section-title"><h2>Explore</h2></div><div className="news-category__links">{Object.entries(CONFIG).slice(0,8).map(([key,c])=><Link key={key} to={key==="news"?"/news":"/category/"+key}>{c.label}</Link>)}</div></div></aside>
    </div>
   </main>
  </div>
 </Layout>;
}
