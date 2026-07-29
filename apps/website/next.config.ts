import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hoi/design-system", "@hoi/ui"]
};

export default nextConfig;
