#!/usr/bin/env bash
# BandMate — Backup zurückspielen.
#
#   ./scripts/restore.sh              Lauf interaktiv auswählen
#   ./scripts/restore.sh --dry-run    nur zeigen, was passieren würde
#   ./scripts/restore.sh --run 2026-07-20_030000 --scope db
#
# Grundhaltung: Ein Restore ist selbst eine zerstörende Aktion und braucht
# seinerseits einen Rückweg. Deshalb wird der AKTUELLE Stand gesichert, bevor
# irgendetwas angefasst wird, und das Ersetzte wird beiseitegelegt statt
# gelöscht. Wer den falschen Lauf erwischt, merkt das oft erst Tage später.
#
# Ablauf:
#   1. Lauf auswählen (Liste aus $BACKUP_DIR mit Datum, Version, Zeilenzahlen)
#   2. Umfang wählen: alles / nur Datenbank / nur Uploads
#   3. Vorschau: Ist-Zustand gegen Backup, als Differenz
#   4. Bestätigen (Name des Laufs abtippen)
#   5. Sicherheitsnetz: backup.sh --label vor-restore
#   6. App stoppen
#   7. Ersetztes beiseitelegen, Backup einspielen
#   8. Prüfen (integrity_check, Zeilenzahlen, Dateizahl)
#   9. App starten
#
# Konfiguration kommt aus der .env (DATA_DIR, BACKUP_DIR) — dieselbe Datei wie
# für App und Backup. PM2_NAME überschreibt den PM2-Prozessnamen (Default:
# bandmate).

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$PWD"

DRY_RUN=0
VORGEWAEHLT=""
UMFANG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --run) VORGEWAEHLT="${2:-}"; shift 2 ;;
    --scope)
      UMFANG="${2:-}"
      case "$UMFANG" in alles|db|uploads) ;; *) echo "--scope: alles|db|uploads" >&2; exit 2 ;; esac
      shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

# --- Konfiguration ----------------------------------------------------------
# Wie in backup.sh: bewusst kein `source .env` (enthält Secrets und würde als
# Shell-Code ausgeführt), sondern nur den Wert der Zuweisung herausschneiden.
ENV_FILE="$REPO_DIR/.env"
env_datei_wert() {
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
    | tail -1 \
    | sed -e 's/[[:space:]]\{1,\}#.*$//' -e 's/[[:space:]]*$//' \
          -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

DATA_DIR="${DATA_DIR:-$(env_datei_wert DATA_DIR)}"
DATA_DIR="${DATA_DIR:-$REPO_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$(env_datei_wert BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DATA_DIR")/bandmate-backups}"
PM2_NAME="${PM2_NAME:-bandmate}"

rot()  { printf '\033[31m%s\033[0m\n' "$*"; }
gelb() { printf '\033[33m%s\033[0m\n' "$*"; }
grau() { printf '\033[90m%s\033[0m\n' "$*"; }

[[ -d "$BACKUP_DIR" ]] || { rot "FEHLER: $BACKUP_DIR gibt es nicht. BACKUP_DIR falsch?"; exit 1; }

# --- Hilfsfunktionen --------------------------------------------------------
manifest_wert() { # <lauf-verzeichnis> <schlüssel>
  sed -n "s/^$2:[[:space:]]*//p" "$1/MANIFEST.txt" 2>/dev/null | head -1
}

# Holt "songs=42" aus einer Zeile wie "integrity=ok users=7 songs=42 …"
zaehler() { # <zeile> <schlüssel>
  echo " $1" | sed -n "s/.*[[:space:]]$2=\([0-9]*\).*/\1/p"
}

db_info() { # <datei.db> -> "integrity=ok users=7 …" oder leer
  [[ -f "$1" ]] || return 0
  node "$REPO_DIR/scripts/db-info.js" "$1" 2>/dev/null || true
}

diff_txt() { # <differenz>
  if   (( $1 > 0 )); then echo "+$1"
  elif (( $1 < 0 )); then echo "$1"
  else echo "—"; fi
}

dateien_zaehlen() { # <verzeichnis>
  [[ -d "$1" ]] && find "$1" -type f | wc -l | tr -d ' ' || echo 0
}

# --- 1. Lauf auswählen ------------------------------------------------------
LAEUFE=()
while IFS= read -r d; do
  [[ -n "$d" && -f "$d/MANIFEST.txt" ]] && LAEUFE+=("$d")
done < <(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '20*' | sort -r)

(( ${#LAEUFE[@]} > 0 )) || { rot "FEHLER: keine Backups in $BACKUP_DIR gefunden."; exit 1; }

echo
echo "Backups in $BACKUP_DIR:"
echo
printf '  %-3s %-26s %-9s %s\n' "Nr" "Lauf" "Version" "Inhalt"
printf '  %-3s %-26s %-9s %s\n' "--" "--------------------------" "-------" "------"
for i in "${!LAEUFE[@]}"; do
  d="${LAEUFE[$i]}"
  name="$(basename "$d")"
  info="$(manifest_wert "$d" db)"
  printf '  %-3s %-26s %-9s Songs %-5s Termine %-5s Dateien %s\n' \
    "$((i + 1))" "$name" "$(manifest_wert "$d" app_version)" \
    "$(zaehler "$info" songs)" "$(zaehler "$info" events)" \
    "$(manifest_wert "$d" uploads_dateien)"
done
echo

if [[ -n "$VORGEWAEHLT" ]]; then
  GEWAEHLT="$BACKUP_DIR/$VORGEWAEHLT"
  [[ -f "$GEWAEHLT/MANIFEST.txt" ]] || { rot "FEHLER: Lauf „$VORGEWAEHLT\" gibt es nicht."; exit 1; }
else
  [[ -t 0 ]] || { rot "FEHLER: keine Eingabe möglich. Lauf mit --run <name> angeben."; exit 1; }
  read -r -p "Welchen Lauf zurückspielen? [1-${#LAEUFE[@]}, Enter = abbrechen] " NR
  [[ -n "${NR:-}" ]] || { echo "Abgebrochen."; exit 0; }
  [[ "$NR" =~ ^[0-9]+$ ]] && (( NR >= 1 && NR <= ${#LAEUFE[@]} )) \
    || { rot "Ungültige Auswahl."; exit 1; }
  GEWAEHLT="${LAEUFE[$((NR - 1))]}"
fi
LAUF_NAME="$(basename "$GEWAEHLT")"

# --- 2. Umfang wählen -------------------------------------------------------
if [[ -z "$UMFANG" && -t 0 ]]; then
  echo
  echo "Was soll zurückgespielt werden?"
  echo "  1) alles — Datenbank und Uploads"
  echo "  2) nur die Datenbank (hochgeladene Dateien bleiben, wie sie sind)"
  echo "  3) nur die Uploads (Datenbank bleibt, wie sie ist)"
  read -r -p "Auswahl [1-3, Enter = alles] " U
  case "${U:-1}" in
    1|"") UMFANG="alles" ;;
    2) UMFANG="db" ;;
    3) UMFANG="uploads" ;;
    *) rot "Ungültige Auswahl."; exit 1 ;;
  esac
fi
UMFANG="${UMFANG:-alles}"

MIT_DB=0; MIT_UPLOADS=0
[[ "$UMFANG" == "alles" || "$UMFANG" == "db" ]] && MIT_DB=1
[[ "$UMFANG" == "alles" || "$UMFANG" == "uploads" ]] && MIT_UPLOADS=1

(( MIT_DB == 0 )) || [[ -f "$GEWAEHLT/band.db" ]] \
  || { rot "FEHLER: $GEWAEHLT/band.db fehlt."; exit 1; }
(( MIT_UPLOADS == 0 )) || [[ -f "$GEWAEHLT/uploads.tar.gz" ]] \
  || { rot "FEHLER: $GEWAEHLT/uploads.tar.gz fehlt."; exit 1; }

# --- 3. Vorschau ------------------------------------------------------------
echo
echo "═══ Vorschau ═══"
echo
grau "$(sed 's/^/  /' "$GEWAEHLT/MANIFEST.txt")"
echo

ALTER_TAGE="$(node -e '
  const m = process.argv[1].match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})/);
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  console.log(Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000)));
' "$LAUF_NAME" 2>/dev/null || echo "?")"

if (( MIT_DB )); then
  IST="$(db_info "$DATA_DIR/band.db")"
  WAR="$(manifest_wert "$GEWAEHLT" db)"
  if [[ -n "$IST" ]]; then
    printf '  %-12s %8s %8s %10s\n' "" "jetzt" "Backup" "Differenz"
    for t in users songs attachments comments setlists events; do
      a="$(zaehler "$IST" "$t")"; b="$(zaehler "$WAR" "$t")"
      [[ -n "$a" && -n "$b" ]] || continue
      printf '  %-12s %8s %8s %10s\n' "$t" "$a" "$b" "$(diff_txt $(( b - a )))"
    done
  else
    gelb "  Aktuell liegt keine lesbare Datenbank in $DATA_DIR — es wird neu aufgebaut."
  fi
  echo
fi

if (( MIT_UPLOADS )); then
  IST_D="$(dateien_zaehlen "$DATA_DIR/uploads")"
  WAR_D="$(manifest_wert "$GEWAEHLT" uploads_dateien)"
  printf '  %-12s %8s %8s %10s\n' "Dateien" "$IST_D" "$WAR_D" "$(diff_txt $(( WAR_D - IST_D )))"
  echo
fi

case "$ALTER_TAGE" in
  0) gelb "  Du gehst auf einen Stand von heute zurück." ;;
  1) gelb "  Du gehst auf den Stand von gestern zurück." ;;
  *) gelb "  Du gehst auf den Stand von vor rund $ALTER_TAGE Tagen zurück." ;;
esac
echo "  Umfang:        $UMFANG"
echo "  Ziel:          $DATA_DIR"
echo

# Warnen, wenn das Backup aus einer anderen App-Version stammt
BACKUP_VERSION="$(manifest_wert "$GEWAEHLT" app_version)"
JETZT_VERSION="$(node -p "require('$REPO_DIR/package.json').version" 2>/dev/null || echo '?')"
if [[ -n "$BACKUP_VERSION" && "$BACKUP_VERSION" != "$JETZT_VERSION" ]]; then
  gelb "  Achtung: Backup stammt aus Version $BACKUP_VERSION, installiert ist $JETZT_VERSION."
  NEUER="$(node -e '
    const teile = (v) => String(v).split(".").map(Number);
    const [a, b] = [teile(process.argv[1]), teile(process.argv[2])];
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) !== (b[i] || 0)) { console.log((a[i] || 0) > (b[i] || 0) ? "ja" : "nein"); process.exit(0); }
    }
    console.log("nein");
  ' "$BACKUP_VERSION" "$JETZT_VERSION" 2>/dev/null || echo nein)"
  if [[ "$NEUER" == "ja" ]]; then
    rot  "  Das Backup ist NEUER als der installierte Stand. Erst die App aktualisieren,"
    rot  "  sonst trifft neueres Datenformat auf älteren Code."
  else
    echo "  Ältere Backups sind unproblematisch: fehlende Migrationen laufen beim Start nach."
  fi
  echo
fi

if (( DRY_RUN )); then
  echo "── Probelauf, es wurde nichts verändert. ──"
  exit 0
fi

# --- 4. Bestätigen ----------------------------------------------------------
[[ -t 0 ]] || { rot "FEHLER: keine Eingabe möglich — Restore braucht eine Bestätigung."; exit 1; }
rot "  Das ersetzt den aktuellen Datenbestand."
echo "  Der jetzige Stand wird vorher gesichert und beiseitegelegt, ist also nicht verloren."
echo
read -r -p "  Zum Bestätigen den Namen des Laufs eintippen ($LAUF_NAME): " EINGABE
[[ "$EINGABE" == "$LAUF_NAME" ]] || { echo "Abgebrochen — Eingabe stimmt nicht überein."; exit 0; }

# --- 5. Sicherheitsnetz -----------------------------------------------------
echo
echo "→ Sicherung des aktuellen Stands"
if [[ -f "$DATA_DIR/band.db" ]]; then
  "$REPO_DIR/scripts/backup.sh" --label vor-restore \
    || { rot "Sicherung fehlgeschlagen — Restore abgebrochen, es wurde nichts verändert."; exit 1; }
else
  gelb "  Keine Datenbank vorhanden — nichts zu sichern."
fi

# --- 6. App stoppen ---------------------------------------------------------
APP_LIEF=0
if command -v pm2 >/dev/null 2>&1; then
  PID="$(pm2 pid "$PM2_NAME" 2>/dev/null | tr -d '[:space:]' || echo 0)"
  if [[ "${PID:-0}" =~ ^[0-9]+$ ]] && (( PID > 0 )); then
    echo "→ App stoppen (PM2: $PM2_NAME)"
    pm2 stop "$PM2_NAME" >/dev/null
    APP_LIEF=1
  else
    grau "  App läuft nicht — nichts zu stoppen."
  fi
else
  gelb "  PM2 nicht gefunden. Läuft die App gerade, MUSS sie jetzt gestoppt werden —"
  gelb "  sonst schreibt sie weiter in die alte Datenbank."
  read -r -p "  Ist die App gestoppt? [ja/nein] " A
  [[ "$A" == "ja" ]] || { echo "Abgebrochen."; exit 0; }
fi

# --- 7. Beiseitelegen und einspielen ----------------------------------------
BEISEITE="${DATA_DIR}.vor-restore-$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$BEISEITE" "$DATA_DIR"
echo "→ Bisherigen Stand beiseitelegen: $BEISEITE"

if (( MIT_DB )); then
  # -wal und -shm gehören zur alten DB und dürfen nicht neben der neuen liegen
  for f in "$DATA_DIR"/band.db "$DATA_DIR"/band.db-wal "$DATA_DIR"/band.db-shm; do
    [[ -e "$f" ]] && mv "$f" "$BEISEITE/"
  done
  echo "→ Datenbank einspielen"
  cp "$GEWAEHLT/band.db" "$DATA_DIR/band.db"
fi

if (( MIT_UPLOADS )); then
  [[ -d "$DATA_DIR/uploads" ]] && mv "$DATA_DIR/uploads" "$BEISEITE/"
  echo "→ Uploads entpacken"
  tar xzf "$GEWAEHLT/uploads.tar.gz" -C "$DATA_DIR"
fi

# --- 8. Prüfen --------------------------------------------------------------
echo "→ Ergebnis prüfen"
FEHLER=0

if (( MIT_DB )); then
  NEU="$(db_info "$DATA_DIR/band.db")"
  SOLL="$(manifest_wert "$GEWAEHLT" db)"
  if [[ "$NEU" != "$SOLL" ]]; then
    rot "  Datenbank weicht vom Manifest ab!"
    echo "    erwartet: $SOLL"
    echo "    erhalten: ${NEU:-<nicht lesbar>}"
    FEHLER=1
  else
    echo "  Datenbank: $NEU"
  fi
fi

if (( MIT_UPLOADS )); then
  NEU_D="$(dateien_zaehlen "$DATA_DIR/uploads")"
  SOLL_D="$(manifest_wert "$GEWAEHLT" uploads_dateien)"
  if [[ "$NEU_D" != "$SOLL_D" ]]; then
    rot "  Dateizahl weicht ab: erwartet $SOLL_D, gefunden $NEU_D"
    FEHLER=1
  else
    echo "  Uploads:   $NEU_D Dateien"
  fi
fi

if (( FEHLER )); then
  echo
  rot "✗ Restore unvollständig. Der vorherige Stand liegt unangetastet in:"
  echo "    $BEISEITE"
  echo "  Zurück kommst du, indem du dessen Inhalt nach $DATA_DIR zurückschiebst."
  echo "  Die App bleibt gestoppt."
  exit 1
fi

# --- 9. App starten ---------------------------------------------------------
if (( APP_LIEF )); then
  echo "→ App starten"
  pm2 start "$PM2_NAME" >/dev/null
fi

echo
echo "✓ Restore abgeschlossen — Stand von $LAUF_NAME ($UMFANG)."
echo
echo "  Der ersetzte Stand liegt weiterhin hier:"
echo "    $BEISEITE"
echo "  Wenn alles passt, kann er weg:"
echo "    rm -rf \"$BEISEITE\""
(( APP_LIEF )) || echo
(( APP_LIEF )) || gelb "  Die App war nicht über PM2 gestartet — bitte selbst wieder starten."
