import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Send, Facebook, Instagram, Youtube } from "lucide-react";
import { XIcon } from "@/components/XIcon";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { PageHero } from "@/components/layout/PageHero";
import { TurnstileWidget } from "@/components/TurnstileWidget";

export default function ContactPage() {
  const [turnstileToken, setTurnstileToken] = useState("");
  const [widgetResetKey, setWidgetResetKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setFormMessage("Please complete the security check.");
      return;
    }
    setIsSending(true);
    setFormMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, turnstileToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not send your message. Please try again.");
      setFormData({ name: "", email: "", subject: "", message: "" });
      setFormMessage("Your message has been sent to the newsroom. Thank you.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Could not send your message. Please try again.");
    } finally {
      setIsSending(false);
      setTurnstileToken("");
      setWidgetResetKey((value) => value + 1);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Contact Us | Za Ndani</title>
        <meta name="description" content="Get in touch with Za Ndani. Have a story tip, insider info, or want to collaborate? Reach our newsroom in Nairobi, Kenya." />
        <link rel="canonical" href="https://zandani.co.ke/contact" />
        <meta property="og:title" content="Contact Us | Za Ndani" />
        <meta property="og:description" content="Get in touch with Za Ndani. Have a story tip, insider info, or want to collaborate? Reach our newsroom in Nairobi, Kenya." />
        <meta property="og:url" content="https://zandani.co.ke/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Za Ndani" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Contact Us | Za Ndani" />
        <meta name="twitter:description" content="Get in touch with Za Ndani. Have a story tip or want to collaborate?" />
      </Helmet>

      <PageHero
        kicker="Newsroom"
        title={<>Get in <span className="text-primary italic">touch</span></>}
        dek="Story tip, correction, partnership, or a row we got wrong. Nairobi first. EAT hours."
      />

      <div className="container max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            {[
              { icon: Phone, label: "Phone", body: <a href="tel:+254706396305" className="hover:text-primary">0706 396 305</a> },
              { icon: Mail, label: "Email", body: (
                <>
                  <a href="mailto:info@zandani.co.ke" className="hover:text-primary block">info@zandani.co.ke</a>
                  <a href="mailto:contact@zandani.co.ke" className="hover:text-primary block">contact@zandani.co.ke</a>
                </>
              ) },
              { icon: MapPin, label: "Location", body: <p>Nairobi, Kenya</p> },
            ].map((item) => (
              <div key={item.label} className="bg-surface p-5 border border-divider">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold mb-1">{item.label}</h3>
                    <div className="text-muted-foreground text-sm">{item.body}</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-surface p-5 border border-divider">
              <h3 className="font-serif font-bold mb-4">Follow</h3>
              <div className="flex gap-2">
                {[
                  { href: "https://facebook.com/zandanike", icon: Facebook, label: "Facebook" },
                  { href: "https://x.com/zandani_ke", icon: XIcon, label: "X" },
                  { href: "https://instagram.com/zandani_ke", icon: Instagram, label: "Instagram" },
                  { href: "https://youtube.com/@zandanike", icon: Youtube, label: "YouTube" },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 border border-divider flex items-center justify-center hover:border-primary hover:text-primary transition-colors" aria-label={s.label}>
                    <s.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-surface p-8 border border-divider">
            <h2 className="text-2xl font-serif font-bold mb-6">Send the newsroom a note</h2>
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Your name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-divider bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Wanjiku"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-divider bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Subject</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 border border-divider bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Story tip / correction / partnership"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 border border-divider bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="What happened, where, who saw it."
              />
            </div>
            <div className="mb-4 flex justify-center"><TurnstileWidget action="contact_submit" onToken={setTurnstileToken} resetKey={widgetResetKey} /></div>
            {formMessage && <p role="status" className="mb-4 text-sm text-center text-muted-foreground">{formMessage}</p>}
            <Button type="submit" disabled={isSending} className="w-full bg-primary text-primary-foreground py-6 text-lg font-bold">
              <Send className="w-5 h-5 mr-2" />
              {isSending ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
