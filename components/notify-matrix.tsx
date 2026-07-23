"use client";

import { NOTIFY_KINDS, NOTIFY_KIND_ORDER, NOTIFY_MODES } from "@/lib/constants";
import type { SettingsMap } from "@/lib/notifications";

/**
 * Benachrichtigungs-Einstellungen je Ereignistyp.
 *
 * Löst den alten einen Schalter ab: Wer nur den Vorschlags-Spam loswerden
 * wollte, verlor damit auch jede Gig-Ankündigung — und drehte irgendwann alles
 * ab. Die Felder heißen `notify_<kind>`, gelesen von readSettingsForm().
 */
export function NotifyMatrix({
  settings,
  digestEnabled,
  idPrefix = "",
}: {
  settings: SettingsMap;
  digestEnabled: boolean;
  idPrefix?: string;
}) {
  const zeigeDigestHinweis = NOTIFY_KIND_ORDER.some(
    (kind) => settings[kind] === "gesammelt"
  );

  return (
    <div className="space-y-4">
      {NOTIFY_KIND_ORDER.map((kind) => {
        const meta = NOTIFY_KINDS[kind];
        return (
          <div key={kind}>
            <p className="text-sm font-semibold">{meta.label}</p>
            <p className="mb-2 text-xs text-faint">{meta.hint}</p>
            <div className="flex flex-wrap gap-2">
              {meta.modes.map((mode) => {
                const id = `${idPrefix}notify-${kind}-${mode}`;
                return (
                  <label
                    key={mode}
                    htmlFor={id}
                    className="btn btn-sm cursor-pointer has-checked:border-accent has-checked:bg-accent/15 has-checked:text-accent-hi"
                    title={NOTIFY_MODES[mode].hint}
                  >
                    <input
                      type="radio"
                      id={id}
                      name={`notify_${kind}`}
                      value={mode}
                      defaultChecked={settings[kind] === mode}
                      className="sr-only"
                    />
                    {NOTIFY_MODES[mode].label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="border-t border-line-soft pt-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="digestEnabled"
            defaultChecked={digestEnabled}
            className="mt-0.5 size-4 accent-(--color-accent)"
          />
          <span>
            <span className="font-semibold">Wochen-Digest am Sonntag</span>
            <span className="block text-xs text-faint">
              Was ansteht, worüber du noch nicht abgestimmt hast — und alles,
              was oben auf „Gesammelt" steht.
            </span>
          </span>
        </label>
        {zeigeDigestHinweis && !digestEnabled && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Du hast etwas auf „Gesammelt" gestellt, aber den Wochen-Digest
            abgeschaltet — diese Benachrichtigungen erreichen dich dann gar nicht.
          </p>
        )}
      </div>
    </div>
  );
}
