import { Link, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, Globe, Sparkles } from "lucide-react";
import { NewsletterForm } from "@/components/NewsletterForm";
import { categories } from "@/lib/markdown";
import { staticSitePages } from "@/lib/site-links";
import { XIcon } from "@/components/XIcon";
import logoImg from "@/assets/logo.png";

export function Footer() {
  const navigate = useNavigate();

  const handleLinkClick = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-card text-card-foreground border-t border-border mt-auto" data-nosnippet>
      {/* Newsletter — global, clean */}
      <div className="border-b border-border">
        <div className="container py-10 md:py-12">
          <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary/90 px-6 py-10 text-primary-foreground shadow-lg sm:px-10">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-background/10 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-background/10 blur-2xl"
              aria-hidden
            />

            <div className="relative text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/90">
                <Sparkles className="h-3 w-3" aria-hidden />
                Free newsletter
              </div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                Stories worth your inbox
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-primary-foreground/80">
                Kenya news, culture, and showbiz — written for readers everywhere.
                One clear email when it matters.
              </p>
              <div className="mx-auto mt-6 max-w-md">
                <NewsletterForm tone="onAccent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 md:py-8">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <button onClick={() => handleLinkClick("/")} className="mb-2.5 block">
              <img src={logoImg} alt="Za Ndani" className="h-9 w-auto" />
            </button>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Bold news and entertainment from Kenya — for a global audience.
              Gossip, showbiz, sports, and politics without the fluff.
            </p>
            <div className="flex items-center gap-2">
              {[
                { icon: <Facebook className="w-4 h-4" />, href: "https://facebook.com/zandanike", label: "Facebook" },
                { icon: <XIcon className="w-4 h-4" />, href: "https://x.com/zandani_ke", label: "X" },
                { icon: <Instagram className="w-4 h-4" />, href: "https://instagram.com/zandani_ke", label: "Instagram" },
                { icon: <Youtube className="w-4 h-4" />, href: "https://youtube.com/@zandanike", label: "Youtube" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-all hover:bg-primary hover:text-primary-foreground"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2.5 border-l-4 border-primary pl-2.5 font-serif text-sm font-bold text-foreground">
              Categories
            </h4>
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.slug}>
                  <button
                    onClick={() =>
                      handleLinkClick(
                        category.slug === "sports"
                          ? "/sports"
                          : category.slug === "entertainment"
                            ? "/entertainment"
                            : category.slug === "news"
                              ? "/news"
                              : category.slug === "business"
                                ? "/business"
                                : category.slug === "lifestyle"
                                  ? "/lifestyle"
                                  : `/category/${category.slug}`
                      )
                    }
                    className="py-0.5 text-left text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2.5 border-l-4 border-primary pl-2.5 font-serif text-sm font-bold text-foreground">
              Quick Links
            </h4>
            <ul className="space-y-1 text-sm">
              {[
                { name: "About", path: "/about" },
                { name: "Contact", path: "/contact" },
                { name: "Ethics", path: "/ethics" },
                { name: "Corrections", path: "/corrections" },
                { name: "Fact-Check", path: "/fact-check" },
                { name: "FAQs", path: "/faq" },
                { name: "Advertise", path: "/advertise" },
                { name: "Privacy", path: "/privacy-policy" },
                { name: "Terms", path: "/terms" },
              ].map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => handleLinkClick(link.path)}
                    className="py-0.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <h4 className="mb-2.5 border-l-4 border-primary pl-2.5 font-serif text-sm font-bold text-foreground">
              Contact
            </h4>
            <div className="space-y-2.5 text-sm">
              <a
                href="tel:+254706396305"
                className="flex items-center gap-2.5 text-muted-foreground hover:text-primary"
              >
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                0706 396 305
              </a>
              <a
                href="mailto:contact@zandani.co.ke"
                className="flex items-center gap-2.5 break-all text-muted-foreground hover:text-primary"
              >
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                contact@zandani.co.ke
              </a>
              <a
                href="https://www.jonathanmwaniki.co.ke"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-xs font-medium text-primary hover:underline"
              >
                <Globe className="h-4 w-4 shrink-0" />
                Engineered by Jonathan Mwaniki
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-2 py-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Za Ndani. All rights reserved.</p>
          <button onClick={() => handleLinkClick("/podcast")} className="text-primary hover:underline">
            Podcast
          </button>
        </div>
      </div>
    </footer>
  );
}
