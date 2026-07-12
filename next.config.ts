import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Audio-Uploads bis 50 MB + Formular-Overhead
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
