import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { PageHero } from "@/components/layout/PageHero";

export default function PrivacyPage() {
  return (
    <Layout>
      <Helmet>
        <title>Privacy Policy | Za Ndani</title>
        <meta name="description" content="Read Za Ndani's privacy policy. Learn how we collect, use, and protect your personal information when you visit our website." />
        <link rel="canonical" href="https://zandani.co.ke/privacy" />
        <meta property="og:title" content="Privacy Policy | Za Ndani" />
        <meta property="og:description" content="Read Za Ndani's privacy policy. Learn how we collect, use, and protect your personal information." />
        <meta property="og:url" content="https://zandani.co.ke/privacy" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Za Ndani" />
      </Helmet>
      <PageHero
        kicker="Legal"
        title="Privacy policy"
        dek={`Last updated ${new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}. How Za Ndani collects, uses, and protects reader data.`}
      />
      <div className="container max-w-4xl mx-auto px-4 py-12 md:py-16">

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">1. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">
              We collect information you provide directly to us, such as when you subscribe to our newsletter, contact us, or interact with our content. This may include:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Email address for newsletter subscriptions</li>
              <li>Name and contact information when you reach out to us</li>
              <li>Usage data and analytics to improve our service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Send you newsletters and updates you've subscribed to</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Analyze usage patterns to improve our content and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">3. Information Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell, trade, or rent your personal information to third parties. We may share information with service providers who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">4. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use cookies and similar tracking technologies to track activity on our website and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">5. Security and abuse prevention</h2>
            <p className="text-muted-foreground">
              We use Cloudflare Turnstile on newsletter subscriptions, the administrator sign-in form, and the newsroom contact form to help distinguish people from automated traffic and prevent spam and abuse. When you use these forms, Cloudflare may process technical information such as your IP address, browser and device characteristics, and interaction signals to assess the security check. Turnstile verification tokens are sent to our server and checked with Cloudflare; we do not use them for advertising. For more information, see the <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cloudflare Privacy Policy</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">6. Data Security</h2>
            <p className="text-muted-foreground">
              The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Unsubscribe from our communications at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-serif font-bold text-headline mb-4">8. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:contact@zandani.co.ke" className="text-primary hover:underline">
                contact@zandani.co.ke
              </a>
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
