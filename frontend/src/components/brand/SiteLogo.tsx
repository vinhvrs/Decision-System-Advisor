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
        "inline-flex h-10 shrink-0 items-center gap-2 text-white",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox="0 0 32 32"
        role="img"
        aria-hidden="true"
        className="h-7 w-7 shrink-0"
      >
        <rect x="2.5" y="2.5" width="27" height="27" rx="4" fill="#101820" stroke="#334252" />
        <path
          d="M7 21.5 12.4 15l4.4 3.8 7.6-9"
          fill="none"
          stroke="#4c8dff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
        <circle cx="7" cy="21.5" r="1.6" fill="#8ab4ff" />
        <circle cx="16.8" cy="18.8" r="1.6" fill="#8ab4ff" />
        <circle cx="24.4" cy="9.8" r="1.8" fill="#8ab4ff" />
      </svg>
      <span className="flex min-w-0 items-baseline gap-2 leading-none">
        <span className="text-[15px] font-semibold tracking-[0.04em] text-white">
          DSA
        </span>
        <span className="hidden whitespace-nowrap text-[10px] font-medium tracking-[0.02em] text-[#7f8b99] pc:inline">
          Decision Support Advisor
        </span>
      </span>
    </Link>
  );
}
