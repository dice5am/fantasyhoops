import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["hyparquet"],
  // Production builds never mount the indicator; keep false so preview/prod
  // never flash Next.js tooling chrome if NODE_ENV is mis-detected.
  devIndicators: false,
};

export default nextConfig;
