import type { NextConfig } from "next";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_DEV_MODE:
      process.env.NEXT_PUBLIC_DEV_MODE ?? process.env.DEV_MODE ?? "",
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    return [
      { source: "/", headers: noStoreHeaders },
      { source: "/screener", headers: noStoreHeaders },
      { source: "/companies/:path*", headers: noStoreHeaders },
      { source: "/investing/:path*", headers: noStoreHeaders },
      { source: "/indicators", headers: noStoreHeaders },
      { source: "/news/:path*", headers: noStoreHeaders },
      { source: "/documents/:path*", headers: noStoreHeaders },
      { source: "/watchlists", headers: noStoreHeaders },
    ];
  },
  async redirects() {
    return [
      {
        source: "/stock-profile/:path*",
        destination: "/companies/profile/:path*",
        permanent: true,
      },
      { source: "/trading", destination: "/investing", permanent: true },
      { source: "/trading/history", destination: "/investing/history", permanent: true },
      { source: "/instrument", destination: "/screener", permanent: true },
      { source: "/analysis", destination: "/indicators", permanent: true },
      { source: "/strategy", destination: "/indicators?tab=strategy", permanent: true },
    ];
  },
};

export default nextConfig;
