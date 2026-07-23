/**
 * Verschickt die zeitgesteuerten Benachrichtigungen.
 *
 *   npm run notify:reminders     # täglich früh (Cron)
 *
 * Idempotent: Ein doppelter Lauf verschickt beim zweiten Mal nichts, weil jeder
 * Versand im Log steht. Ein ausgefallener Tag wird NICHT nachgeholt — eine
 * Erinnerung für einen Termin, der schon war, ist Lärm.
 *
 * Wie scripts/purge-trash.ts: loadEnvConfig zuerst, lib/* erst danach dynamisch
 * importieren, sonst liest lib/db das DATA_DIR, bevor die .env geladen ist.
 * Siehe AGENTS.md.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const befehl = process.argv[2];
  if (befehl !== "reminders") {
    console.error("Aufruf: npm run notify:reminders");
    process.exit(2);
  }

  const { runReminders } = await import("../lib/reminders");
  const appUrl = process.env.APP_URL ?? "";
  if (!appUrl) {
    console.warn("Warnung: APP_URL nicht gesetzt — Links in den Mails sind leer.");
  }

  const ergebnis = await runReminders(appUrl);
  console.log(ergebnis.note);
  if (ergebnis.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Benachrichtigungslauf fehlgeschlagen:", err);
  process.exit(1);
});
