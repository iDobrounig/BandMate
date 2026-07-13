# Versionierung & Releases

BandMate nutzt [Semantic Versioning](https://semver.org/lang/de/): `MAJOR.MINOR.PATCH`
(z.B. `1.2.0`). Git-Tags tragen das Präfix `v` (z.B. `v1.2.0`).

## Wann welche Stelle erhöhen?

| Stelle | Wann | Beispiele |
|---|---|---|
| **MAJOR** (`2.0.0`) | Inkompatible Änderung — ein Update braucht manuelles Eingreifen | Umbenannte/entfernte `.env`-Variable, geänderte Deploy-Schritte, DB-Migration mit Handarbeit, geändertes Datenformat |
| **MINOR** (`1.3.0`) | Neues Feature, abwärtskompatibel — `./deploy.sh` reicht | Neue Seite/Funktion, neues Feld (migriert automatisch), zusätzliche optionale `.env`-Variable |
| **PATCH** (`1.2.1`) | Bugfix, Doku, Optik — kein neues Feature | Fehler behoben, Text-/Style-Korrektur, Abhängigkeit aktualisiert |

Im Zweifel: Ändert sich für die Band sichtbar etwas Neues → MINOR. Nur repariert → PATCH.

## Einen Release erstellen

Voraussetzung: [GitHub CLI](https://cli.github.com/) installiert und eingeloggt
(`gh auth login`).

1. **`CHANGELOG.md` pflegen** — Einträge aus dem `[Unreleased]`-Abschnitt unter eine neue
   Versionsüberschrift mit Datum verschieben.
2. **Version taggen + Release veröffentlichen** (im Projektverzeichnis):
   ```bash
   ./scripts/release.sh minor      # oder: major | patch
   ```
   Das Script erhöht die Version in `package.json`, committet („Release vX.Y.Z"),
   erstellt den annotierten Git-Tag `vX.Y.Z`, pusht Commit + Tag und legt mit `gh`
   direkt den GitHub-Release an (Notes aus dem `CHANGELOG.md`-Abschnitt der Version).

### Manuell (ohne Script)

```bash
npm version minor --no-git-tag-version
git commit -am "Release v1.1.0"
git tag -a v1.1.0 -m "v1.1.0"
git push && git push origin v1.1.0
gh release create v1.1.0 --title v1.1.0 --notes-file <(sed -n '/## \[1.1.0\]/,/## \[/p' CHANGELOG.md)
```

Ohne `gh` alternativ über die Weboberfläche: **Releases → Draft a new release**, Tag
`vX.Y.Z` wählen, Titel = Tag, Beschreibung = passender `CHANGELOG.md`-Abschnitt, **Publish**.

## Auf dem Server auf eine bestimmte Version aktualisieren

`./deploy.sh` zieht immer den neuesten `main`-Stand. Willst du gezielt auf einen
getaggten Stand gehen:

```bash
git fetch --tags
git checkout v1.1.0
npm install && npm run build
pm2 restart ecosystem.config.js --update-env
```
