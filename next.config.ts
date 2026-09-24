import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GITHUB_PAGES === "true" ? "export" : undefined,
  assetPrefix: process.env.GITHUB_PAGES === "true" ? "/worlds-of-spice/" : undefined,
  trailingSlash: true,
};

export default nextConfig;
