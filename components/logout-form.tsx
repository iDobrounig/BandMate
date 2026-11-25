"use client";

import { useRef } from "react";
import { logout } from "@/lib/actions/auth";
import { removePushSubscription } from "@/lib/actions/push";
import { unsubscribeHere } from "@/lib/push-client";

/** Höchstens so lange wartet das Abmelden auf das Push-Aufräumen. */
const PUSH_AUFRAEUMEN_MS = 1500;

/**
 * Meldet das Push-Abo DIESES Geräts ab, damit auf einem geteilten Gerät nach
 * dem Abmelden keine Nachrichten der vorigen Person mehr ankommen.
 * Best effort: Jeder Fehler wird geschluckt.
 */
async function pushAbmelden(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const endpoint = await unsubscribeHere();
  if (endpoint) await removePushSubscription(endpoint);
}

export function LogoutForm({
  className,
  ariaLabel,
  title,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  title?: string;
  children: React.ReactNode;
}) {
  // Zweiter Durchlauf nach dem Aufräumen: dann wirklich absenden.
  const bereit = useRef(false);

  return (
    <form
      action={logout}
      onSubmit={(e) => {
        if (bereit.current) return;
        e.preventDefault();
        if (!confirm("Wirklich abmelden?")) return;
        const form = e.currentTarget;
        void (async () => {
          try {
            await Promise.race([
              pushAbmelden(),
              new Promise((r) => setTimeout(r, PUSH_AUFRAEUMEN_MS)),
            ]);
          } catch {
            // Abmelden darf daran nie scheitern
          }
          bereit.current = true;
          form.requestSubmit();
        })();
      }}
    >
      <button
        type="submit"
        aria-label={ariaLabel}
        title={title}
        className={className}
      >
        {children}
      </button>
    </form>
  );
}
