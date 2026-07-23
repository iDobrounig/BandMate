// Konsistente Kopie der SQLite-Datenbank über die Online-Backup-API von SQLite.
//
// WICHTIG: Ein simples `cp band.db` ist KEIN gültiges Backup. Die App läuft im
// WAL-Modus — frisch geschriebene Daten stehen dann noch in band.db-wal, und
// eine Kopie mitten in einem Schreibvorgang kann zerrissen sein. Die
// Backup-API sperrt sauber, zieht den WAL-Inhalt mit und liefert eine in sich
// stimmige Datei.
//
// Aufruf:  node scripts/backup-db.js <quelle.db> <ziel.db>
// Exit 0 = Backup erstellt UND geprüft, sonst != 0.
//
// Bewusst reines CommonJS-JS statt TypeScript: läuft mit blankem `node` auf dem
// Server, ohne tsx/Build-Schritt — ein Backup-Script darf nicht an der
// Toolchain hängen.

const Database = require("better-sqlite3");
const { dbInfo } = require("./db-info");

const [source, target] = process.argv.slice(2);

if (!source || !target) {
  console.error("Aufruf: node scripts/backup-db.js <quelle.db> <ziel.db>");
  process.exit(2);
}

async function main() {
  // readonly: die Quelle wird beim Backup unter keinen Umständen verändert.
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }

  // Gegenprüfung auf der KOPIE — ein ungeprüftes Backup ist kein Backup.
  // Die Zeilenzahlen landen im Manifest, damit man einem Backup auf einen Blick
  // ansieht, ob es plausibel ist (z.B. "songs=0" nach einem Unfall).
  const info = dbInfo(target);
  if (!info.startsWith("integrity=ok")) {
    console.error(`Integritätsprüfung fehlgeschlagen: ${info}`);
    process.exit(1);
  }
  console.log(info);
}

main().catch((err) => {
  console.error(`Backup fehlgeschlagen: ${err.message}`);
  process.exit(1);
});
