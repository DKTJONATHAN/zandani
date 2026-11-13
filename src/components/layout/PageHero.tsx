import type { ReactNode } from "react";

type PageHeroProps = {
  kicker?: string;
  title: ReactNode;
  dek?: string;
  meta?: ReactNode;
  align?: "left" | "center";
};

export function PageHero({ kicker, title, dek, meta, align = "left" }: PageHeroProps) {
  const centered = align === "center";
  return (
    <section className="zn-page-hero border-b border-divider bg-background">
      <div className="h-[3px] w-full bg-primary" />
      <div className={`zn-page-hero__inner container max-w-7xl mx-auto px-4 py-10 md:py-14 ${centered ? "text-center" : ""}`}>
        {kicker ? (
          <p className="zn-page-hero__kicker text-[10px] font-black tracking-[0.28em] uppercase text-primary mb-4">{kicker}</p>
        ) : null}
        <h1
          className={`zn-page-hero__title font-serif font-black text-4xl md:text-6xl leading-[0.95] tracking-tight max-w-3xl ${
            centered ? "mx-auto" : ""
          }`}
        >
          {title}
        </h1>
        {dek ? (
          <p
            className={`zn-page-hero__dek mt-5 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed ${
              centered ? "mx-auto" : ""
            }`}
          >
            {dek}
          </p>
        ) : null}
        {meta ? <div className={`mt-6 ${centered ? "flex justify-center" : ""}`}>{meta}</div> : null}
      </div>
    </section>
  );
}
