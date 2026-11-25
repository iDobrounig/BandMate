/**
 * Browser-Seite von Web Push (nur in Client-Komponenten verwenden).
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 */

export type PushSupport = "ok" | "unsupported" | "ios-install";

function istIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS meldet sich als Mac — erkennbar an Touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function istInstalliert(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Kann dieses Gerät Push? Auf iPhone/iPad geht es nur in der vom Homescreen
 * gestarteten App (iOS 16.4+), im normalen Safari-Tab nicht.
 */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (istIos() && !istInstalliert()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "ok";
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** Das Push-Abo dieses Browsers, falls vorhanden. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function gleicherSchluessel(sub: PushSubscription, publicKey: string): boolean {
  const vorhanden = sub.options.applicationServerKey;
  if (!vorhanden) return false;
  const a = new Uint8Array(vorhanden);
  const b = base64UrlToUint8Array(publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Fragt (falls nötig) die Berechtigung an und meldet den Browser beim
 * Push-Dienst an. MUSS direkt aus einem Tippen/Klick aufgerufen werden —
 * iOS verlangt das. Liefert null, wenn die Berechtigung verweigert wurde.
 */
export async function subscribe(publicKey: string): Promise<PushSubscription | null> {
  // Zuerst die Berechtigung — noch innerhalb der Nutzer-Geste.
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") return null;

  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  const vorhanden = await reg.pushManager.getSubscription();
  if (vorhanden) {
    if (gleicherSchluessel(vorhanden, publicKey)) return vorhanden;
    // Server-Schlüssel gewechselt → altes Abo ist wertlos.
    await vorhanden.unsubscribe();
  }
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  });
}

/** Meldet diesen Browser ab und liefert den bisherigen Endpoint (oder null). */
export async function unsubscribeHere(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
