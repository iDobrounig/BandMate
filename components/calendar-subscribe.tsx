"use client";

import { useState } from "react";
import { IconCalendar } from "@/components/icons";

/**
 * Zeigt die Abo-URL des ICS-Feeds mit Kopier-Button. Die absolute URL wird
 * clientseitig aus window.location gebaut, falls keine APP_URL gesetzt ist.
 */
export function CalendarSubscribe({
  feedPath,
  appUrl,
}: {
  feedPath: string;
  appUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = `${appUrl || (typeof window !== "undefined" ? window.location.origin : "")}${feedPath}`;

  return (
    <div className="relative">
      <button
        type="button"
        className="btn inline-flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <IconCalendar className="size-4" />
        Kalender abonnieren
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-80 space-y-2 p-4 text-left text-sm sm:w-96">
          <p className="text-mute">
            Diese URL in deiner Kalender-App als <strong>Kalender-Abo</strong>{" "}
            hinzufügen (iPhone: Einstellungen → Kalender → Accounts →
            Kalenderabo; Google Kalender: „Per URL hinzufügen"). Neue Termine
            erscheinen dann automatisch.
          </p>
          <div className="flex gap-2">
            <input
              className="input mono-display flex-1 text-xs"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "✓ Kopiert" : "Kopieren"}
            </button>
          </div>
          <p className="text-xs text-faint">
            Die URL enthält einen geheimen Schlüssel — nur mit Bandmitgliedern
            teilen.
          </p>
        </div>
      )}
    </div>
  );
}
