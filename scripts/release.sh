#!/usr/bin/env bash
# Erstellt einen neuen Release: Version erhöhen, committen, Tag pushen.
# CHANGELOG.md VORHER aktualisieren (siehe RELEASING.md).
# Aufruf: ./scripts/release.sh <major|minor|patch>
set -euo pipefail

cd "$(dirname "$0")/.."

level="${1:-}"
if [[ ! "$level" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: ./scripts/release.sh <major|minor|patch>" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Arbeitsverzeichnis ist nicht sauber — bitte erst committen (außer CHANGELOG.md)." >&2
  git status --short
  exit 1
fi

# Version in package.json erhöhen (ohne eigenen Commit/Tag von npm)
npm version "$level" --no-git-tag-version >/dev/null
version="v$(node -e "console.log(require('./package.json').version)")"

echo "→ Release $version"
git add -A
git commit -m "Release $version"
git tag -a "$version" -m "$version"
git push
git push origin "$version"

echo "✓ $version getaggt und gepusht."
echo "  Jetzt auf GitHub unter Releases aus dem Tag $version einen Release erstellen"
echo "  (Beschreibung = CHANGELOG-Abschnitt). Siehe RELEASING.md."
