import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Mail, CheckCircle2, Sparkles, Newspaper, Shield } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { NewsletterForm } from "@/components/NewsletterForm";

const SITE_URL = "https://zandani.co.ke";

const PERKS = [
  {
    icon: Newspaper,
    title: "Standout stories",
    body: "A short brief of the pieces that matter — news, culture, and showbiz.",
  },
  {
    icon: Sparkles,
    title: "Written for everywhere",
    body: "Kenya-rooted reporting, clear enough for readers across the world.",
  },
  {
    icon: Shield,
    title: "Respect your inbox",
    body: "No spam, no spammy subject lines. Unsubscribe in one click anytime.",
  },
];

export default function NewsletterPage() {
  return (
    <Layout>
      <Helmet>
        <title>Newsletter | Za Ndani</title>
        <meta
          name="description"
          content="Subscribe to Za Ndani — Kenya news, culture and showbiz for readers everywhere. Free brief, no spam."
        />
        <link rel="canonical" href={`${SITE_URL}/newsletter`} />
        <meta property="og:title" content="Newsletter | Za Ndani" />
        <meta
          property="og:description"
          content="Stories worth your inbox. Free brief from Za Ndani."
        />
        <meta property="og:url" content={`${SITE_URL}/newsletter`} />
      </Helmet>

      <div className="zn-newsletter-page border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="newsletter-hero container max-w-3xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Mail className="h-3 w-3" aria-hidden />
            Free newsletter
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Stories worth your inbox
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground leading-relaxed">
            Join readers worldwide for a clear brief of Za Ndani reporting — Kenya news,
            culture, and showbiz without the noise.
          </p>

          <div className="newsletter-card mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <NewsletterForm />
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Already subscribed? Browse the latest on{" "}
            <Link to="/" className="text-primary underline-offset-2 hover:underline">
              the homepage
            </Link>
            .
          </p>
        </div>
      </div>

      <section className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card/50 p-5 text-left"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="font-serif text-base font-bold text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          <span>Free · No spam · Unsubscribe anytime</span>
        </div>
      </section>
    </Layout>
  );
}
