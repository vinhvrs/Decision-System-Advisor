import Image from "next/image";
import bannerSrc from "@/src/assets/images/bg-landingpage.jpg";
import { BRAND_ACRONYM, BRAND_FULL_NAME } from "@/src/constants/brand";

/** Hero above the beginner dashboard on `/` — image + motto. */
export default function HomeHeroBanner() {
  return (
    <section
      className="relative mb-8 min-h-[200px] overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-black/20 tablet:mb-10 tablet:min-h-[260px] laptop:min-h-[280px]"
      aria-labelledby="home-hero-heading"
    >
      <Image
        src={bannerSrc}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="(max-width: 768px) 100vw, min(896px, 100vw)"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0b1220]/95 via-[#0b1220]/78 to-[#0b1220]/40"
        aria-hidden
      />
      <div className="relative z-10 px-5 py-8 tablet:px-8 tablet:py-10">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/90">
          <span className="text-violet-200">{BRAND_ACRONYM}</span>
          <span className="mx-2 text-white/35">·</span>
          <span className="text-violet-200/85">{BRAND_FULL_NAME}</span>
        </p>
        <h1
          id="home-hero-heading"
          className="mt-2 text-2xl font-semibold tracking-tight text-[#f3f4f6] drop-shadow-sm tablet:text-3xl laptop:text-[2rem]"
        >
          Decision support for your next move
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[#e5e7eb]/90 tablet:text-sm">
          Rankings, fundamentals, indicators, and news — surfaced clearly so you spend less time digging and more time
          deciding.
        </p>
      </div>
    </section>
  );
}
