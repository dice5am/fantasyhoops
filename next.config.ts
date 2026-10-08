import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["hyparquet"],
  // Production builds never mount the indicator; keep false so preview/prod
  // never flash Next.js tooling chrome if NODE_ENV is mis-detected.
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/player",
        destination: "/players",
        permanent: false,
      },
      {
        source: "/schedule",
        destination: "/team?view=matchup",
        permanent: false,
      },
      {
        source: "/insight",
        destination: "/insights/archive?segment=briefs",
        permanent: false,
      },
      {
        source: "/insight/:slug",
        destination: "/insights/:slug",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
