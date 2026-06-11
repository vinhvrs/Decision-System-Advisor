import Link from "next/link";

type SiteLogoProps = {
  className?: string;
  priority?: boolean;
};

export default function SiteLogo({ className }: SiteLogoProps) {
  return (
    <Link
      href="/"
      aria-label="DSA — Decision Support Advisor"
      className={[
        "inline-flex h-12 shrink-0 items-center gap-2 text-white phone:h-14 laptop:h-16",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox="0 0 46 46"
        role="img"
        aria-hidden="true"
        className="h-8 w-8 shrink-0 drop-shadow-[0_0_14px_rgba(99,102,241,0.32)] phone:h-9 phone:w-9 laptop:h-10 laptop:w-10"
      >
        <path
          d="M23 4.5 41.5 23 23 41.5 4.5 23 23 4.5Z"
          fill="rgba(99,102,241,0.12)"
          stroke="#818cf8"
          strokeWidth="2.4"
        />
        <path
          d="M23 12.5 33.5 23 23 33.5 12.5 23 23 12.5Z"
          fill="rgba(56,189,248,0.12)"
          stroke="#38bdf8"
          strokeWidth="1.7"
        />
        <path d="M23 4.5v37M4.5 23h37" stroke="#818cf8" strokeOpacity="0.34" strokeWidth="1.2" />
        <path
          d="m13.5 27.5 7-9 7 7 8-11"
          fill="none"
          stroke="#a78bfa"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <circle cx="13.5" cy="27.5" r="2.3" fill="#c4b5fd" />
        <circle cx="27.5" cy="25.5" r="2.3" fill="#c4b5fd" />
        <circle cx="35.5" cy="14.5" r="2.6" fill="#c4b5fd" />
      </svg>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-serif text-[1.42rem] font-bold tracking-normal text-white phone:text-[1.55rem] laptop:text-[1.75rem]">
          DSA
        </span>
        <span className="mt-1 hidden whitespace-nowrap text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-indigo-200/80 phone:block laptop:text-[0.58rem]">
          Decision Support Advisor
        </span>
      </span>
    </Link>
  );
}
