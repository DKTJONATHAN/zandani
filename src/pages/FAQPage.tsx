import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

const FAQ_ITEMS = [
  {
    question: "What does Za Ndani cover?",
    answer: "Za Ndani publishes coverage of Kenyan news and public affairs, business, sports, entertainment, lifestyle and developments across the region.",
  },
  {
    question: "How can I send a story tip or information to the newsroom?",
    answer: "Send story tips, documents for editorial review and general newsroom enquiries to contact@zandani.co.ke. Include links or supporting context where available.",
  },
  {
    question: "How do I report an error in a published story?",
    answer: "Email contact@zandani.co.ke with the article link, the passage you believe is inaccurate and any supporting information. Za Ndani reviews correction requests under its published Corrections Policy.",
  },
  {
    question: "How does Za Ndani handle corrections?",
    answer: "When a substantive error is confirmed, the article is corrected and an explanatory correction note is added. Minor typographical fixes that do not change meaning may be corrected without a separate note.",
  },
  {
    question: "How can I contact an editor or request a right of reply?",
    answer: "Contact the newsroom at contact@zandani.co.ke and identify the article or issue concerned. Include the relevant facts, documents and a reliable way for the newsroom to follow up.",
  },
  {
    question: "How can I find more stories by a contributor?",
    answer: "Select the byline on an article or visit the Authors page to open a contributor profile and browse stories published under that byline.",
  },
  {
    question: "Does advertising determine editorial coverage?",
    answer: "Za Ndani’s published editorial standards state that editorial decisions are made independently and are not directed by advertisers, political interests or corporate partners.",
  },
];

export default function FAQPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <Layout>
      <Helmet>
        <title>Frequently Asked Questions | Za Ndani</title>
        <meta name="description" content="Answers about Za Ndani coverage, editorial standards, corrections, story tips, contributor bylines and how to contact the newsroom." />
        <link rel="canonical" href="https://zandani.co.ke/faq" />
        <meta property="og:title" content="Frequently Asked Questions | Za Ndani" />
        <meta property="og:description" content="Answers about Za Ndani coverage, editorial standards, corrections, story tips, contributor bylines and how to contact the newsroom." />
        <meta property="og:url" content="https://zandani.co.ke/faq" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <section className="border-b border-divider bg-background">
        <div className="h-[3px] w-full bg-primary" />
        <div className="container max-w-4xl mx-auto px-4 py-12 md:py-14">
          <p className="text-[10px] font-black tracking-[0.28em] uppercase text-primary mb-4">Reader information</p>
          <h1 className="text-4xl md:text-6xl font-serif font-black leading-[0.95] mb-4">Frequently asked questions</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Information about our coverage, editorial standards and how to reach the newsroom.
          </p>
        </div>
      </section>

      <section className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="space-y-8">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="border-b border-divider pb-6">
              <h2 className="font-serif text-xl md:text-2xl font-bold mb-3">{item.question}</h2>
              <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          For more detail, read our <a className="text-primary underline" href="/ethics">Editorial Ethics</a> and{" "}
          <a className="text-primary underline" href="/corrections">Corrections Policy</a>, or{" "}
          <a className="text-primary underline" href="/contact">contact the newsroom</a>.
        </p>
      </section>
    </Layout>
  );
}
