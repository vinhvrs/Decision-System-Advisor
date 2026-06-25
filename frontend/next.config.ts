import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Mirrors .env.local `DEV_MODE` so client code can use demo / IndexedDB symbol subset.
    NEXT_PUBLIC_DEV_MODE:
      process.env.NEXT_PUBLIC_DEV_MODE ?? process.env.DEV_MODE ?? "",
  },
  // Smaller client bundles: tree-shake icon/chart packages
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
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
