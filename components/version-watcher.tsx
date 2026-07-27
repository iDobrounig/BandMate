"use client";

import { useEffect, useState } from "react";
import { IconRepeat } from "@/components/icons";

const MY_BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "";

/**
 * Erkennt, wenn der Server nach einem Deploy eine neue Build-Kennung meldet, und
 * bietet einen wegklickbaren Reload-Hinweis an. Geprüft wird beim Zurückkehren in
 * den Tab und alle paar Minuten. Weggeklickt bleibt der Hinweis weg, bis eine noch
 * neuere Kennung auftaucht (in sessionStorage gemerkt) — nervt also nicht.
 */
export function VersionWatcher() {
  const [server, setServer] = useState<{ build: string; version: string } | null>(
    null
  );
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    // Ohne eingebackene Build-Kennung (z.B. lokal ohne git) macht der Vergleich
    // keinen Sinn — dann ruht der Wächter.
    if (!MY_BUILD) return;
    setDismissed(sessionStorage.getItem("vw-dismissed"));

    let active = true;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { build?: string; version?: string };
        if (active && typeof data.build === "string") {
          setServer({ build: data.build, version: data.version ?? "" });
        }
      } catch {
        /* offline o.ä. — still ignorieren */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 5 * 60 * 1000);
    check();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  const outdated = server && server.build !== MY_BUILD;
  if (!outdated || server!.build === dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("vw-dismissed", server!.build);
    setDismissed(server!.build);
  };

  return (
    <div className="card mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 border-accent/40 bg-accent/5 p-4">
      <IconRepeat className="size-5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 basis-[calc(100%-2rem)] text-sm sm:basis-auto">
        <span className="font-semibold">Neue Version verfügbar</span>
        {server!.version ? ` (→ ${server!.version})` : ""}. Lade neu, um sie zu nutzen.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => location.reload()}
        >
          Neu laden
        </button>
        <button type="button" className="btn btn-sm" onClick={dismiss}>
          Später
        </button>
      </div>
    </div>
  );
}
