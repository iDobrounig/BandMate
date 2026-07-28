# Automatischer Deploy nach Release (GitHub Actions)

Der Workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deployt
BandMate auf den Server, sobald ein **GitHub-Release veröffentlicht** wird
(`./scripts/release.sh` legt das an). Er ruft nichts Neues auf, sondern nur das bestehende
[`deploy.sh`](../deploy.sh) — inklusive dessen Pre-Migration-Backup.

## Wie es funktioniert

```
release.sh  →  GitHub-Release  →  Workflow „Deploy nach Release"
                                     ├─ pruefen: MAJOR (X.0.0)?
                                     │    ├─ ja  → nur Hinweis, KEIN Auto-Deploy
                                     │    └─ nein → deploy-Job …
                                     └─ deploy: [Approval-Gate] → ./deploy.sh → Health-Check
```

Zwei Sicherungen:

1. **Approval-Gate** über das Environment `production` (required reviewers): Der Deploy-Job
   **pausiert** und wartet auf deine manuelle Freigabe im GitHub-UI, bevor irgendetwas auf dem
   Server läuft.
2. **MAJOR-Releases (`X.0.0`) werden nicht automatisch deployt.** Sie brauchen laut
   [RELEASING.md](../RELEASING.md) manuelle Schritte (Migration/`.env`/Deploy-Anpassungen). Der
   Workflow meldet das nur und überlässt dir den manuellen `./deploy.sh`.

Zusätzlich stellt `concurrency: deploy` sicher, dass nie zwei Deploys gleichzeitig laufen, und
der **Health-Check** (`/api/version`) lässt den Lauf rot werden, wenn die App nach dem Neustart
nicht antwortet — GitHub schickt dir dann automatisch eine Fehler-Mail.

## Einrichtung

Voraussetzung: Auf dem Server läuft BandMate bereits über `deploy.sh` + PM2 (siehe README,
„Produktiv-Deployment"). Alles unten macht der **Deploy-User** (der, der sonst `./deploy.sh`
tippt) — **nicht** root.

### 1. Self-hosted Runner installieren

GitHub → Repo → **Settings → Actions → Runners → New self-hosted runner** (Linux). GitHub zeigt
dort die genauen Befehle mit Download-URL und Registrierungs-Token. Wichtig beim `config.sh`:
**das Label `bandmate` vergeben** (der Workflow läuft auf `[self-hosted, bandmate]`):

```bash
# als Deploy-User, in einem eigenen Ordner (z.B. ~/actions-runner)
./config.sh --url https://github.com/iDobrounig/BandMate \
            --token <TOKEN-VON-GITHUB> \
            --labels bandmate \
            --name bandmate-vps
```

Danach als **Dienst** installieren, damit er Neustarts überlebt und im Hintergrund läuft:

```bash
sudo ./svc.sh install <deploy-user>   # denselben User, der deploy.sh ausführt
sudo ./svc.sh start
sudo ./svc.sh status
```

> **PATH/pm2:** Der Dienst startet mit minimalem PATH. `deploy.sh` stellt `NODE_BIN_DIR` dem
> PATH voran, also finden `node`/`npm`/`next` sich. Liegt **`pm2` nicht** im selben Bin-Ordner,
> ergänze den Pfad — am einfachsten in `deploy.sh` (`NODE_BIN_DIR` passend setzen) oder in der
> Runner-Umgebung (`~/actions-runner/.env` → `PATH=/usr/local/node22/bin:...`). Ein
> `./deploy.sh` von Hand aus einer frischen, „nackten" Shell ist der beste Vorab-Test.

### 2. Environment „production" mit Approval-Gate

GitHub → Repo → **Settings → Environments → New environment** → Name exakt **`production`**.
Darin unter **Deployment protection rules**:

- **Required reviewers** aktivieren und **dich** eintragen (bis zu 6 Reviewer möglich).
- Optional **Wait timer** = 0.

Damit hält jeder Deploy an und wartet auf deinen Klick auf **Review deployments → Approve and
deploy**. (Ohne Reviewer läuft der Deploy sofort durch — das Gate lebt allein von dieser
Einstellung, nicht vom Workflow.)

### 3. Repo-Variablen setzen

GitHub → Repo → **Settings → Secrets and variables → Actions → Variables → New repository
variable**:

| Variable | Pflicht | Wert |
|---|---|---|
| `DEPLOY_PATH` | **ja** | Absoluter Pfad zum App-Clone auf dem Server, z.B. `/home/deploy/BandMate` |
| `HEALTHCHECK_URL` | nein | Überschreibt die Default-URL des Health-Checks (Standard `http://localhost:8059/api/version`) |

Es werden **keine Secrets** benötigt — der Runner läuft ja auf dem Server, kein SSH-Key nötig.

### 4. Testen

- **Ohne Release:** GitHub → **Actions → „Deploy nach Release" → Run workflow** (`workflow_dispatch`).
  Das deployt den aktuellen `main`-Stand und durchläuft dasselbe Approval-Gate.
- **Echt:** einen Patch releasen (`./scripts/release.sh patch`) und im Actions-Tab den Lauf
  freigeben.

## Betrieb & Stolperfallen

- **MAJOR immer manuell.** Bei `X.0.0` überspringt der Workflow den Deploy bewusst. Zuerst die
  manuellen Schritte aus RELEASING.md erledigen, dann auf dem Server `./deploy.sh`.
- **Fehlgeschlagener Deploy.** `deploy.sh` bricht **vor** dem Neustart ab, wenn das Backup oder
  der Build scheitert — die laufende App bleibt dann unangetastet. Schlägt erst der Health-Check
  fehl, ist die neue Version zwar gestartet, aber unerreichbar: `pm2 logs bandmate` prüfen und
  notfalls über [`scripts/restore.sh`](../scripts/restore.sh) das `pre-deploy`-Backup
  zurückspielen. Einen Auto-Rollback gibt es bewusst nicht.
- **Sicherheit.** Nur Maintainer können Releases veröffentlichen → nur sie lösen den Deploy aus,
  und das Approval-Gate ist die zweite Schranke. Den Runner als Deploy-User laufen lassen, nicht
  als root.
- **Runner offline?** Dann bleibt der Lauf „queued", bis der Runner wieder da ist — es wird
  nichts halb deployt.
