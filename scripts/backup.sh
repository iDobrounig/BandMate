#!/usr/bin/env bash
# BandMate — Backup von Datenbank und Uploads.
#
# Legt pro Lauf ein Verzeichnis an:
#
#   $BACKUP_DIR/2026-07-23_030000/
#     band.db        konsistente Kopie (SQLite-Backup-API, danach geprüft)
#     uploads.tar.gz Archiv der hochgeladenen Noten/Audios
#     MANIFEST.txt   Zeitstempel, Größen, Zeilenzahlen, Prüfergebnis
#   $BACKUP_DIR/latest -> neuestes Verzeichnis
#
# Unveränderte Uploads werden NICHT neu gepackt, sondern als Hardlink auf das
# Archiv des Vorlaufs gelegt — eine unveränderte Upload-Sammlung kostet über die
# ganze Aufbewahrungszeit nur einmal Platz statt einmal pro Nacht.
#
# Aufruf:
#   ./scripts/backup.sh                 normaler (nächtlicher) Lauf
#   ./scripts/backup.sh --label pre-deploy   Snapshot vor einem Deploy
#
# Umgebungsvariablen (alle optional):
#   DATA_DIR        wie in der App (Default: <repo>/data)
#   BACKUP_DIR      Zielverzeichnis  (Default: <DATA_DIR>/../bandmate-backups)
#   RETENTION_DAYS  Aufbewahrung in Tagen (Default: 35 — muss länger sein als
#                   die Papierkorb-Frist, siehe README)
#   KEEP_MIN        so viele Läufe bleiben IMMER erhalten (Default: 3)
#
# Restore: siehe README, Abschnitt „Backup & Restore".

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$PWD"

LABEL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label) LABEL="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

# Werte aus der .env lesen — dieselbe Datei, aus der die App ihr DATA_DIR
# bezieht. Ohne das würde dieses Script auf einem Server, wo DATA_DIR nur in
# der .env steht, das falsche Verzeichnis sichern (oder gar nichts finden).
#
# Bewusst KEIN `source .env`: die Datei enthält Secrets und würde dabei als
# Shell-Code ausgeführt. Hier wird nur der Wert der gesuchten Zuweisung
# herausgeschnitten.
ENV_FILE="$REPO_DIR/.env"
env_datei_wert() {
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
    | tail -1 \
    | sed -e 's/[[:space:]]\{1,\}#.*$//' -e 's/[[:space:]]*$//' \
          -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# Reihenfolge: gesetzte Umgebungsvariable > .env > Default. So kann eine
# Cron-Zeile weiterhin alles überschreiben.
DATA_DIR="${DATA_DIR:-$(env_datei_wert DATA_DIR)}"
DATA_DIR="${DATA_DIR:-$REPO_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$(env_datei_wert BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DATA_DIR")/bandmate-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-$(env_datei_wert RETENTION_DAYS)}"
RETENTION_DAYS="${RETENTION_DAYS:-35}"
KEEP_MIN="${KEEP_MIN:-$(env_datei_wert KEEP_MIN)}"
KEEP_MIN="${KEEP_MIN:-3}"

DB_FILE="$DATA_DIR/band.db"
UPLOADS_DIR="$DATA_DIR/uploads"

[[ -f "$DB_FILE" ]] || { echo "FEHLER: $DB_FILE nicht gefunden. DATA_DIR falsch?" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"

# Sperre über mkdir (atomar, und anders als flock überall vorhanden).
LOCK_DIR="$BACKUP_DIR/.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  # Wird ein Lauf hart abgeschossen (SIGKILL, Reboot), bleibt die Sperre liegen
  # und jeder weitere Cron-Lauf würde still scheitern. Ein Backup dauert
  # Minuten — eine Sperre älter als 6 Stunden ist definitiv verwaist.
  if [[ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +360 2>/dev/null)" ]]; then
    echo "WARNUNG: verwaiste Sperre älter als 6 h gefunden — wird entfernt." >&2
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "FEHLER: Es läuft bereits ein Backup ($LOCK_DIR). Abbruch." >&2
    exit 1
  fi
fi
# Bei Abbruch aufräumen: Sperre lösen und ein halbfertiges Verzeichnis entfernen,
# damit kein unvollständiger Lauf als gültiges Backup stehen bleibt.
RUN_DIR=""
cleanup() {
  local code=$?
  rmdir "$LOCK_DIR" 2>/dev/null || true
  if [[ $code -ne 0 && -n "$RUN_DIR" && -d "$RUN_DIR" ]]; then
    echo "→ Räume unvollständigen Lauf auf: $RUN_DIR" >&2
    rm -rf "$RUN_DIR"
  fi
}
trap cleanup EXIT

STAMP="$(date +%Y-%m-%d_%H%M%S)"
RUN_NAME="$STAMP"
[[ -n "$LABEL" ]] && RUN_NAME="${STAMP}_${LABEL}"
RUN_DIR="$BACKUP_DIR/$RUN_NAME"

# Vorlauf für den Hardlink-Vergleich der Uploads (vor Anlage des neuen Laufs).
PREV_DIR="$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '20*' 2>/dev/null | sort | tail -1)"

mkdir -p "$RUN_DIR"
echo "→ Backup nach $RUN_DIR"

# ---------------------------------------------------------------- Datenbank
echo "→ Datenbank sichern und prüfen"
DB_INFO="$(node "$REPO_DIR/scripts/backup-db.js" "$DB_FILE" "$RUN_DIR/band.db")"
echo "  $DB_INFO"

# ------------------------------------------------------------------ Uploads
checksum() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  else shasum -a 256 | cut -d' ' -f1; fi
}

# Fingerabdruck über Größe, Änderungszeit und Pfad aller Upload-Dateien —
# nur Metadaten, liest also auch bei vielen GB keine Dateiinhalte.
# `ls -ln`: Spalten 1–4 (Rechte, Links, UID, GID) interessieren nicht, der Rest
# der Zeile (Größe, Datum, Pfad) bleibt inklusive Leerzeichen im Namen erhalten.
uploads_fingerprint() {
  if [[ ! -d "$UPLOADS_DIR" ]]; then echo "leer"; return; fi
  find "$UPLOADS_DIR" -type f -exec ls -ln {} + 2>/dev/null \
    | awk '{ $1=""; $2=""; $3=""; $4=""; print }' | sort | checksum
}

FINGERPRINT="$(uploads_fingerprint)"
UPLOADS_NOTE=""

if [[ -n "$PREV_DIR" && -f "$PREV_DIR/uploads.tar.gz" ]] \
   && grep -qx "uploads_fingerprint: $FINGERPRINT" "$PREV_DIR/MANIFEST.txt" 2>/dev/null; then
  echo "→ Uploads unverändert — Hardlink auf $(basename "$PREV_DIR")"
  ln "$PREV_DIR/uploads.tar.gz" "$RUN_DIR/uploads.tar.gz"
  UPLOADS_NOTE="unverändert (Hardlink auf $(basename "$PREV_DIR"))"
elif [[ -d "$UPLOADS_DIR" ]]; then
  echo "→ Uploads packen"
  tar czf "$RUN_DIR/uploads.tar.gz" -C "$DATA_DIR" uploads
  # Archiv gegenlesen — ein nicht entpackbares tar fällt sonst erst im Ernstfall auf.
  tar tzf "$RUN_DIR/uploads.tar.gz" >/dev/null
  UPLOADS_NOTE="neu gepackt"
else
  echo "→ Kein Uploads-Verzeichnis vorhanden — überspringe"
  UPLOADS_NOTE="nicht vorhanden"
fi

# ----------------------------------------------------------------- Manifest
UPLOAD_COUNT=0
[[ -d "$UPLOADS_DIR" ]] && UPLOAD_COUNT="$(find "$UPLOADS_DIR" -type f | wc -l | tr -d ' ')"

{
  echo "BandMate-Backup"
  echo "erstellt:            $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "label:               ${LABEL:-—}"
  echo "app_version:         $(node -p "require('$REPO_DIR/package.json').version" 2>/dev/null || echo '?')"
  echo "git_commit:          $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
  echo "data_dir:            $DATA_DIR"
  echo "db:                  $DB_INFO"
  echo "db_bytes:            $(wc -c < "$RUN_DIR/band.db" | tr -d ' ')"
  echo "uploads:             $UPLOADS_NOTE"
  echo "uploads_dateien:     $UPLOAD_COUNT"
  echo "uploads_fingerprint: $FINGERPRINT"
} > "$RUN_DIR/MANIFEST.txt"

ln -sfn "$RUN_NAME" "$BACKUP_DIR/latest"

# ----------------------------------------------------------------- Rotation
# Nach Alter löschen, aber nie unter KEEP_MIN Läufe fallen — lieber zu viel
# aufheben als nach einer Pannenserie ohne Sicherung dazustehen.
# Bewusst kein `mapfile` — das gibt es erst ab Bash 4, macOS liefert 3.2 aus.
ALL_RUNS=()
while IFS= read -r dir; do
  [[ -n "$dir" ]] && ALL_RUNS+=("$dir")
done < <(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '20*' | sort)
TOTAL="${#ALL_RUNS[@]}"
DELETED=0
if (( TOTAL > KEEP_MIN )); then
  CANDIDATES=$(( TOTAL - KEEP_MIN ))
  for dir in "${ALL_RUNS[@]:0:$CANDIDATES}"; do
    if [[ -n "$(find "$dir" -maxdepth 0 -mtime +"$RETENTION_DAYS" 2>/dev/null)" ]]; then
      rm -rf "$dir"
      DELETED=$(( DELETED + 1 ))
    fi
  done
fi

echo "✓ Backup fertig: $RUN_DIR"
echo "  Läufe im Archiv: $(( TOTAL - DELETED ))  ·  gelöscht: $DELETED  ·  Aufbewahrung: ${RETENTION_DAYS} Tage (min. ${KEEP_MIN})"
echo "  Gesamtgröße:     $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
