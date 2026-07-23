/**
 * Leert den Papierkorb endgültig von allem, was älter als
 * TRASH_RETENTION_DAYS ist — Datenbankzeilen UND Dateien auf der Platte.
 *
 * Aufruf:  npm run trash:purge      (siehe README, „Papierkorb aufräumen")
 *
 * Anders als scripts/backup-db.js läuft das hier über tsx und teilt sich die
 * Logik mit der App (lib/trash.ts). Das ist bewusst: Beim Backup wäre eine
 * Abhängigkeit von der Toolchain fatal, hier nicht — bleibt der Cron-Job aus,
 * wächst nur der Plattenverbrauch, und /papierkorb räumt beim Öffnen ohnehin
 * mit auf. Dafür gibt es die Löschlogik nur einmal.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { TRASH_RETENTION_DAYS } from "../lib/constants";

async function main() {
  // Erst NACH loadEnvConfig laden: lib/db liest DATA_DIR beim Import und legt
  // das Verbindungs-Singleton an. Ein statischer Import würde hochgezogen und
  // träfe auf einem Server, wo DATA_DIR nur in der .env steht, die falsche
  // Datenbank. Gleiche Mechanik wie in scripts/seed.ts.
  const { purgeExpired } = await import("../lib/trash");

  const bericht = await purgeExpired();
  const gesamt = Object.values(bericht).reduce((a, b) => a + b, 0);

  if (gesamt === 0) {
    console.log(
      `Papierkorb: nichts älter als ${TRASH_RETENTION_DAYS} Tage — nichts zu tun.`
    );
    return;
  }

  console.log(
    `Papierkorb geleert (älter als ${TRASH_RETENTION_DAYS} Tage): ` +
      `${bericht.song} Songs, ${bericht.setlist} Setlisten, ` +
      `${bericht.event} Termine, ${bericht.attachment} Dateien.`
  );
}

main().catch((err) => {
  console.error("Aufräumen fehlgeschlagen:", err);
  process.exit(1);
});
