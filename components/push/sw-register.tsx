"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push-client";

/**
 * Registriert den Push-Service-Worker (public/sw.js). Nur, wenn der Server Push
 * anbietet und der Browser es kann. Der Worker hat keinen fetch-Handler und
 * greift deshalb nie in Seitenaufrufe ein.
 */
export function SwRegister({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    registerServiceWorker().catch((err) => {
      console.warn("[push] Service Worker nicht registriert:", err);
    });
  }, [enabled]);
  return null;
}
