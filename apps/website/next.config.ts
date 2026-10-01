import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hoi/ui"],
  async headers() {
    return [{ source: "/ativar-acesso", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }];
  },
};

export default nextConfig;
