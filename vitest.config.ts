import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Wie in tsconfig.json — "@/lib/db" muss auch im Test auflösen.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Die DB ist ein prozessweites Singleton mit festem DATA_DIR. Mit "forks"
    // bekommt jede Testdatei einen eigenen Prozess und damit eine eigene DB —
    // sonst würden sich parallel laufende Dateien dieselbe SQLite-Datei teilen.
    pool: "forks",
  },
});
