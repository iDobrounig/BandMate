"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pushSupport,
  currentSubscription,
  subscribe,
  unsubscribeHere,
  passtZumSchluessel,
  type PushSupport,
} from "@/lib/push-client";
import {
  savePushSubscription,
  removePushSubscription,
  removeMyDevice,
  sendTestPush,
} from "@/lib/actions/push";

export type PushDevice = {
  id: number;
  label: string;
  endpoint: string;
  /** schon serverseitig formatiert (keine Zeitzonen-Abweichung beim Hydrieren) */
  aktiviert: string;
  zugestellt: string | null;
};

type Zustand =
  | { art: "laedt" }
  | { art: PushSupport | "blockiert" | "aus" | "aktiv"; endpoint?: string };

/**
 * Push-Benachrichtigungen auf DIESEM Gerät an-/abschalten, testen, und die
 * eigenen Geräte verwalten. Die Berechtigung wird nur nach Tippen erfragt.
 */
export function PushSettings({
  publicKey,
  devices,
}: {
  publicKey: string;
  devices: PushDevice[];
}) {
  const router = useRouter();
  const [zustand, setZustand] = useState<Zustand>({ art: "laedt" });
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, startTransition] = useTransition();
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  const bekannteEndpoints = devices.map((d) => d.endpoint).join("|");

  useEffect(() => {
    let aktiv = true;
    (async () => {
      const support = pushSupport();
      if (support !== "ok") return aktiv && setZustand({ art: support });
      if (Notification.permission === "denied") return aktiv && setZustand({ art: "blockiert" });
      const sub = await currentSubscription().catch(() => null);
      // Aktiv nur, wenn der Server das Abo kennt UND es zum aktuellen Schlüssel
      // passt — sonst (abgelaufen, anderer Account, Schlüsselwechsel) neu
      // aktivieren lassen.
      const bekannt =
        sub &&
        passtZumSchluessel(sub, publicKey) &&
        bekannteEndpoints.split("|").includes(sub.endpoint);
      if (!aktiv) return;
      setZustand(
        bekannt && sub ? { art: "aktiv", endpoint: sub.endpoint } : { art: "aus" }
      );
    })();
    return () => {
      aktiv = false;
    };
  }, [bekannteEndpoints, publicKey]);

  async function aktivieren() {
    setMeldung(null);
    setBeschaeftigt(true);
    try {
      const ergebnis = await subscribe(publicKey);
      if (!ergebnis) {
        setZustand({
          art: Notification.permission === "denied" ? "blockiert" : "aus",
        });
        setMeldung({ ok: false, text: "Ohne Erlaubnis kann BandMate keine Push-Nachrichten schicken." });
        return;
      }
      const { sub, ersetzt } = ergebnis;
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) {
        setMeldung({ ok: false, text: r.error });
        return;
      }
      // Altes Abo (Schlüsselwechsel) auch am Server entfernen.
      if (ersetzt && ersetzt !== sub.endpoint) await removePushSubscription(ersetzt);
      setZustand({ art: "aktiv", endpoint: sub.endpoint });
      setMeldung({ ok: true, text: "Push ist auf diesem Gerät aktiv." });
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("[push] Aktivieren fehlgeschlagen:", err);
      setMeldung({
        ok: false,
        text: "Aktivieren hat nicht geklappt. Bitte später noch einmal versuchen.",
      });
    } finally {
      setBeschaeftigt(false);
    }
  }

  async function deaktivieren() {
    setMeldung(null);
    setBeschaeftigt(true);
    try {
      const endpoint = await unsubscribeHere();
      if (endpoint) await removePushSubscription(endpoint);
      setZustand({ art: "aus" });
      setMeldung({ ok: true, text: "Push ist auf diesem Gerät ausgeschaltet." });
      startTransition(() => router.refresh());
    } finally {
      setBeschaeftigt(false);
    }
  }

  async function testen() {
    setMeldung(null);
    setBeschaeftigt(true);
    try {
      const r = await sendTestPush();
      setMeldung(
        r.ok
          ? {
              ok: true,
              text:
                r.delivered === 1
                  ? "Test-Push verschickt."
                  : `Test-Push an ${r.delivered} Geräte verschickt.`,
            }
          : { ok: false, text: r.error }
      );
      startTransition(() => router.refresh());
    } finally {
      setBeschaeftigt(false);
    }
  }

  function entfernen(id: number) {
    setMeldung(null);
    startTransition(async () => {
      await removeMyDevice(id);
      router.refresh();
    });
  }

  const gesperrt = beschaeftigt || laeuft;
  const hier = zustand.art === "aktiv" ? zustand.endpoint : undefined;

  return (
    <section className="card p-5">
      <h2 className="headline mb-1 text-lg">Push-Benachrichtigungen</h2>
      <p className="mb-4 text-sm text-mute">
        Nachrichten direkt aufs Gerät, auch wenn der Mailversand mal hakt.
      </p>

      {zustand.art === "laedt" && <p className="text-sm text-faint">Prüfe dieses Gerät …</p>}

      {zustand.art === "unsupported" && (
        <p className="text-sm text-mute">
          Dieser Browser unterstützt keine Push-Benachrichtigungen.
        </p>
      )}

      {zustand.art === "ios-install" && (
        <div className="space-y-2 text-sm text-mute">
          <p>Auf iPhone und iPad geht Push nur in der installierten App:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              In Safari auf <span className="font-semibold text-ink">Teilen</span> tippen
            </li>
            <li>
              <span className="font-semibold text-ink">Zum Home-Bildschirm</span> wählen
            </li>
            <li>BandMate vom Home-Bildschirm öffnen und hier aktivieren</li>
          </ol>
        </div>
      )}

      {zustand.art === "blockiert" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Benachrichtigungen sind für BandMate blockiert. Erlaube sie in den Einstellungen
          deines Geräts bzw. Browsers (Website-Einstellungen → Benachrichtigungen) und lade
          die Seite danach neu.
        </p>
      )}

      {zustand.art === "aus" && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={aktivieren}
          disabled={gesperrt}
        >
          {beschaeftigt ? "Aktiviere …" : "Auf diesem Gerät aktivieren"}
        </button>
      )}

      {zustand.art === "aktiv" && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="badge mr-2">Aktiv</span>auf diesem Gerät
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={testen} disabled={gesperrt}>
              Test-Push senden
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={deaktivieren}
              disabled={gesperrt}
            >
              Deaktivieren
            </button>
          </div>
        </div>
      )}

      {meldung && (
        <p
          role="status"
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            meldung.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {meldung.text}
        </p>
      )}

      {devices.length > 0 && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <h3 className="label">Meine Geräte</h3>
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {d.label}
                    {d.endpoint === hier && (
                      <span className="ml-2 text-xs text-accent-hi">dieses Gerät</span>
                    )}
                  </p>
                  <p className="text-xs text-faint">
                    aktiviert {d.aktiviert} ·{" "}
                    {d.zugestellt ? `zuletzt zugestellt ${d.zugestellt}` : "noch nichts zugestellt"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm shrink-0"
                  onClick={() => entfernen(d.id)}
                  disabled={gesperrt}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
