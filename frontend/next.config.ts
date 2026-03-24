import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
