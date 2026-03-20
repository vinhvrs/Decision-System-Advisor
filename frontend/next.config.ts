import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller client bundles: tree-shake icon/chart packages
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
