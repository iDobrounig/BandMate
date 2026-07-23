/**
 * Auskunft über eine BandMate-Datenbank: Integritätsprüfung und Zeilenzahlen.
 *
 * Wird von scripts/backup-db.js (nach dem Sichern) und von scripts/restore.sh
 * (Ist-Zustand vor dem Zurückspielen, Kontrolle danach) genutzt — beide sollen
 * dieselbe Zeile erzeugen, damit sie sich vergleichen lässt.
 *
 * Aufruf:  node scripts/db-info.js <datei.db>
 * Ausgabe: integrity=ok users=7 songs=3 attachments=3 comments=1 setlists=1 events=23
 *
 * Bewusst reines CommonJS: läuft mit blankem `node`, ohne tsx oder Build.
 */

const Database = require("better-sqlite3");

const TABELLEN = ["users", "songs", "attachments", "comments", "setlists", "events"];

/** Liefert die Auskunftszeile — wirft, wenn die Datei keine gültige DB ist. */
function dbInfo(datei) {
  const db = new Database(datei, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma("integrity_check", { simple: true });
    const counts = TABELLEN.map((tabelle) => {
      const row = db.prepare(`select count(*) as n from ${tabelle}`).get();
      return `${tabelle}=${row.n}`;
    });
    return `integrity=${integrity} ${counts.join(" ")}`;
  } finally {
    db.close();
  }
}

module.exports = { dbInfo, TABELLEN };

// Direkt aufgerufen: Zeile ausgeben.
if (require.main === module) {
  const datei = process.argv[2];
  if (!datei) {
    console.error("Aufruf: node scripts/db-info.js <datei.db>");
    process.exit(2);
  }
  try {
    console.log(dbInfo(datei));
  } catch (err) {
    console.error(`Datenbank nicht lesbar: ${err.message}`);
    process.exit(1);
  }
}
