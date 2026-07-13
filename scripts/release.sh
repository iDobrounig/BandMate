#!/usr/bin/env bash
# Erstellt einen neuen Release: Version erhöhen, committen, Tag pushen,
# GitHub-Release via gh anlegen.
# CHANGELOG.md VORHER aktualisieren (siehe RELEASING.md).
# Aufruf: ./scripts/release.sh <major|minor|patch>
set -euo pipefail

cd "$(dirname "$0")/.."

level="${1:-}"
if [[ ! "$level" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: ./scripts/release.sh <major|minor|patch>" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) nicht gefunden — bitte installieren und 'gh auth login'." >&2
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

# Release-Notes aus dem passenden CHANGELOG-Abschnitt ziehen
# (CHANGELOG-Überschriften ohne "v"-Präfix: "## [1.1.0]")
notes="$(awk -v hdr="## [${version#v}]" '
  index($0, hdr) == 1 { grab = 1; next }
  grab && index($0, "## [") == 1 { exit }
  grab { print }
' CHANGELOG.md)"

if [[ -z "${notes//[[:space:]]/}" ]]; then
  echo "  Kein CHANGELOG-Abschnitt für $version gefunden — Release mit Auto-Notes." >&2
  gh release create "$version" --title "$version" --generate-notes
else
  gh release create "$version" --title "$version" --notes "$notes"
fi

echo "✓ $version getaggt, gepusht und als GitHub-Release veröffentlicht."
