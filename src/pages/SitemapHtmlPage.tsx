import { getAllPosts, categories } from "@/lib/markdown";
import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { FileText, Tag, Folder } from "lucide-react";
import { staticSitePages } from "@/lib/site-links";

const SITE_URL = "https://zandani.co.ke";

const SitemapHtmlPage = () => {
  const posts = getAllPosts();
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
          Sitemap
        </h1>
        <p className="text-muted-foreground mb-8">
          All pages on Za Ndani —{" "}
          <a
            href={`${SITE_URL}/sitemap.xml`}
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            XML version
          </a>
        </p>

        {/* Static pages */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Pages
          </h2>
          <ul className="space-y-1 pl-7 list-disc text-muted-foreground">
            {staticSitePages.map((p) => (
              <li key={p.path}>
                <Link to={p.path} className="text-primary hover:underline">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" /> Categories
          </h2>
          <ul className="space-y-1 pl-7 list-disc text-muted-foreground">
            {categories.map((cat) => {
              const sectionRoutes: Record<string, string> = {
                news: "/news", politics: "/news", national: "/news", opinions: "/news",
                entertainment: "/entertainment", gossip: "/entertainment", showbiz: "/entertainment", celebrity: "/entertainment", music: "/entertainment",
                sports: "/sports", sport: "/sports",
                business: "/business", finance: "/business", economy: "/business",
                lifestyle: "/lifestyle", fashion: "/lifestyle", health: "/lifestyle", travel: "/lifestyle",
              };
              return (
                <li key={cat.slug}>
                  <Link to={sectionRoutes[cat.slug] || \`/category/\${cat.slug}\`} className="text-primary hover:underline">
                    {cat.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Articles ({posts.length})
          </h2>
          <ul className="space-y-1 pl-7 list-disc text-muted-foreground">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link to={`/article/${post.slug}`} className="text-primary hover:underline">
                  {post.title}
                </Link>
                <span className="text-xs ml-2 text-muted-foreground">{post.date}</span>
              </li>
            ))}
          </ul>
        </section>

        {allTags.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> Tags ({allTags.length})
            </h2>
            <div className="flex flex-wrap gap-2 pl-7">
              {allTags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tag/${encodeURIComponent(tag)}`}
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default SitemapHtmlPage;
