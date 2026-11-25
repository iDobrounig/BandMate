"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushSupport, currentSubscription, subscribe } from "@/lib/push-client";
import { savePushSubscription } from "@/lib/actions/push";

const SPEICHER_KEY = "bandmate.pushPrompt";

function weggeklickt(): boolean {
  try {
    return localStorage.getItem(SPEICHER_KEY) === "aus";
  } catch {
    return false;
  }
}

function merkeWeggeklickt() {
  try {
    localStorage.setItem(SPEICHER_KEY, "aus");
  } catch {
    // ohne localStorage erscheint die Karte eben wieder — harmlos
  }
}

/**
 * Einmalige, wegklickbare Einladung auf dem Dashboard, Push auf diesem Gerät
 * zu aktivieren. Fragt NICHT von selbst nach der Berechtigung — erst nach
 * Tippen auf „Aktivieren“. Erscheint nur, wo es auch funktioniert.
 */
export function PushPrompt({ publicKey }: { publicKey: string }) {
  const router = useRouter();
  const [sichtbar, setSichtbar] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      if (weggeklickt() || pushSupport() !== "ok") return;
      if (Notification.permission !== "default") return;
      const sub = await currentSubscription().catch(() => null);
      if (aktiv && !sub) setSichtbar(true);
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  if (!sichtbar) return null;

  async function aktivieren() {
    setFehler(null);
    setLaeuft(true);
    try {
      const sub = await subscribe(publicKey);
      if (!sub) {
        // abgelehnt — nicht weiter nerven
        merkeWeggeklickt();
        setSichtbar(false);
        return;
      }
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) {
        setFehler(r.error);
        return;
      }
      setSichtbar(false);
      router.refresh();
    } catch (err) {
      console.error("[push] Aktivieren fehlgeschlagen:", err);
      setFehler("Aktivieren hat nicht geklappt. Du kannst es später im Profil erneut versuchen.");
    } finally {
      setLaeuft(false);
    }
  }

  function neinDanke() {
    merkeWeggeklickt();
    setSichtbar(false);
  }

  return (
    <section className="card mt-6 flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Benachrichtigungen auf diesem Gerät aktivieren?</p>
        <p className="text-sm text-mute">
          Neue Termine, Erinnerungen und Vorschläge kommen dann direkt aufs Gerät. Im Profil
          jederzeit änderbar.
        </p>
        {fehler && <p className="mt-1 text-sm text-red-300">{fehler}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={aktivieren} disabled={laeuft}>
          {laeuft ? "Aktiviere …" : "Aktivieren"}
        </button>
        <button type="button" className="btn btn-sm" onClick={neinDanke} disabled={laeuft}>
          Nein, danke
        </button>
      </div>
    </section>
  );
}
