#!/usr/bin/env bash
# BandMate — zentraler Cron-Dispatcher.
#
# Ein einziger Cron-Eintrag ruft dieses Script minütlich auf; welche Aufgabe
# wann läuft, steht unten in der SCHEDULE-Tabelle — also in Git, nicht in der
# crontab. Neue periodische Aufgaben (z.B. der Wochen-Digest) sind damit eine
# Zeile im Repo statt einer Server-Bastelei.
#
#   * * * * * cd /pfad/zu/BandMate && ./scripts/cron.sh
#
#   ./scripts/cron.sh --list          zeigt den Zeitplan
#   ./scripts/cron.sh --run backup    führt eine Aufgabe sofort aus (zum Testen)
#
# Die Einzelskripte (backup.sh, npm run …) bleiben eigenständig aufrufbar — der
# Dispatcher orchestriert nur. Wer lieber getrennte Cron-Zeilen mag, kann dieses
# Script ignorieren.

set -uo pipefail   # bewusst KEIN -e: `(( … ))` als Zeitvergleich liefert bei
                   # „trifft nicht zu" Exit 1, das darf das Script nicht beenden.

cd "$(dirname "$0")/.."
REPO_DIR="$PWD"

# --- Umgebung --------------------------------------------------------------
# Cron startet mit minimalem PATH — node/npm müssen gefunden werden. Wie in
# deploy.sh: bei mehreren Node-Versionen die gewünschte voranstellen.
NODE_BIN_DIR="/usr/local/node22/bin"
NODE_BIN_DIR="${NODE_BIN_DIR:-}"
[[ -n "$NODE_BIN_DIR" ]] && export PATH="$NODE_BIN_DIR:$PATH"

# Trigger meinen LOKALE Zeit. Ohne das rechnet `date` in der System-Zeitzone —
# auf einem UTC-Server liefe „6:00" um 8:00 lokal. Muss zur App passen (TZ in
# ecosystem.config.js).
export TZ="${TZ:-Europe/Vienna}"

LOG_DIR="${LOG_DIR:-$REPO_DIR/logs}"
mkdir -p "$LOG_DIR"

# --- Zeitplan --------------------------------------------------------------
# Felder: name | min | hour | wochentag(1=Mo..7=So, * = egal) | befehl
# Der Befehl ist statischer, im Repo stehender Text (kein Nutzer-Input), wird
# darum via eval ausgeführt. Diese Tabelle ist die einzige Quelle für Ausführung
# UND --list, damit beide nicht auseinanderlaufen.
SCHEDULE=(
  "backup    | 30 | 3 | * | ./scripts/backup.sh"
  "purge     | 0  | 4 | * | npm run --silent trash:purge"
  "reminders | 0  | 6 | * | npm run --silent notify:reminders"
  "digest    | 0  | 18| 7 | npm run --silent notify:digest"  # sonntags 18:00
)

# Feld aus einer SCHEDULE-Zeile, umschließende Leerzeichen entfernt. Bewusst
# KEIN xargs — das würde Anführungszeichen im Befehl interpretieren und
# zerstören (`sh -c 'exit 7'` → `sh -c exit 7`).
feld() {
  local v; v=$(echo "$1" | cut -d'|' -f"$2")
  v="${v#"${v%%[![:space:]]*}"}"   # führende Leerzeichen
  v="${v%"${v##*[![:space:]]}"}"   # nachfolgende Leerzeichen
  echo "$v"
}

# --- --list ----------------------------------------------------------------
if [[ "${1:-}" == "--list" ]]; then
  printf "Zeitplan (TZ=%s):\n\n" "$TZ"
  printf "  %-11s %-8s %-10s %s\n" "Aufgabe" "Zeit" "Tag" "Befehl"
  printf "  %-11s %-8s %-10s %s\n" "-------" "----" "---" "------"
  for eintrag in "${SCHEDULE[@]}"; do
    name=$(feld "$eintrag" 1); min=$(feld "$eintrag" 2)
    hour=$(feld "$eintrag" 3); dow=$(feld "$eintrag" 4); cmd=$(feld "$eintrag" 5)
    [[ "$dow" == "*" ]] && tag="täglich" || tag="Wochentag $dow"
    printf "  %-11s %02d:%02d    %-10s %s\n" "$name" "$hour" "$min" "$tag" "$cmd"
  done
  exit 0
fi

# --- eine Aufgabe ausführen (mit eigenem Logfile, Fehler sichtbar) ---------
FAILED=0
run_task() {
  local name="$1" cmd="$2"
  local log="$LOG_DIR/$name.log"
  echo "[$(date '+%F %T %Z')] start $name" >>"$log"
  # Subshell: ein Befehl, der intern `exit` aufruft, beendet so nur die
  # Subshell, nicht den ganzen Dispatcher.
  if ( eval "$cmd" ) >>"$log" 2>&1; then
    echo "[$(date '+%F %T %Z')] ok $name" >>"$log"
  else
    local code=$?
    echo "[$(date '+%F %T %Z')] FEHLER $name (exit $code)" >>"$log"
    # Nach stderr, damit Cron es per MAILTO meldet:
    echo "BandMate-Cron: $name fehlgeschlagen (exit $code) — siehe $log" >&2
    FAILED=1
  fi
}

# --- --run <name>: erzwingt eine Aufgabe, unabhängig von der Zeit ----------
if [[ "${1:-}" == "--run" ]]; then
  ziel="${2:-}"
  for eintrag in "${SCHEDULE[@]}"; do
    if [[ "$(feld "$eintrag" 1)" == "$ziel" ]]; then
      run_task "$ziel" "$(feld "$eintrag" 5)"
      exit $FAILED
    fi
  done
  echo "Unbekannte Aufgabe: ${ziel:-<keine>}" >&2
  echo "Verfügbar: $(for e in "${SCHEDULE[@]}"; do feld "$e" 1; done | tr '\n' ' ')" >&2
  exit 2
fi

# --- normaler minütlicher Lauf ---------------------------------------------
# Sperre, damit eine lang laufende Aufgabe (großes Uploads-Backup) nicht vom
# nächsten Minutenlauf gestört wird. mkdir ist atomar und überall vorhanden.
LOCK="$LOG_DIR/.cron.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  # Verwaiste Sperre (hart abgeschossener Lauf) nach 2 h brechen.
  if [[ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]]; then
    rmdir "$LOCK" 2>/dev/null || true
    mkdir "$LOCK" 2>/dev/null || exit 0
  else
    exit 0   # es läuft schon einer — stillschweigend aussteigen
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

H=$(date +%-H); M=$(date +%-M); W=$(date +%u)

for eintrag in "${SCHEDULE[@]}"; do
  name=$(feld "$eintrag" 1)
  min=$(feld "$eintrag" 2); hour=$(feld "$eintrag" 3); dow=$(feld "$eintrag" 4)
  [[ "$min"  == "*" || "$min"  -eq "$M" ]] || continue
  [[ "$hour" == "*" || "$hour" -eq "$H" ]] || continue
  [[ "$dow"  == "*" || "$dow"  -eq "$W" ]] || continue
  run_task "$name" "$(feld "$eintrag" 5)"
done

exit $FAILED
