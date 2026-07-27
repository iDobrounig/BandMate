import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Build-Kennung für den Update-Banner: ändert sich bei jedem Deploy. Git-Short-SHA,
 * Fallback auf einen Build-Zeitstempel (falls .git mal fehlt). Wird über `env` in
 * Client UND Server-Route eingebacken — ein alter Client erkennt so einen neuen Server.
 */
function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const appVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
).version as string;

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Audio-Uploads bis 50 MB + Formular-Overhead
      bodySizeLimit: "60mb",
    },
  },
  env: {
    NEXT_PUBLIC_APP_BUILD: buildId(),
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
