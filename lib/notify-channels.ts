import type { NotifyChannel } from "@/lib/db/schema";
import { NOTIFY_CHANNELS } from "@/lib/constants";

/**
 * Reine Kanal-Logik für Web Push (keine DB, kein Netz).
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 */

export type PlannedChannels = { push: boolean; mail: boolean };

/**
 * Über welche Kanäle bekommt eine Person eine Nachricht, die ihr laut Matrix
 * zusteht? Ohne aktives Gerät (oder ohne Push-Konfiguration am Server) geht
 * IMMER Mail raus — auch bei "push". Niemand fällt still durchs Raster.
 */
export function planChannels(
  pref: NotifyChannel,
  deviceCount: number,
  pushConfigured: boolean
): PlannedChannels {
  const push = pushConfigured && deviceCount > 0 && pref !== "mail";
  return { push, mail: !push || pref !== "push" };
}

/** War nur Push geplant und ist an kein Gerät etwas angekommen → Mail als Rückfall. */
export function mailFallbackNeeded(planned: PlannedChannels, delivered: number): boolean {
  return planned.push && !planned.mail && delivered === 0;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

const MAX_BODY = 180;

function kuerzen(text: string, max: number): string {
  const zeichen = Array.from(text); // nach Codepoints, damit kein Emoji zerfällt
  return zeichen.length <= max ? text : zeichen.slice(0, max - 1).join("") + "…";
}

/**
 * Nur Ziele derselben Herkunft — als Pfad. Alles andere (fremde Domain,
 * protokoll-relativ, javascript:) wird zu "/". Der Service Worker prüft
 * zusätzlich selbst.
 */
function sichererPfad(url: string | undefined, appUrl: string): string {
  if (!url) return "/";
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  try {
    const ziel = new URL(url);
    if (appUrl && ziel.origin === new URL(appUrl).origin) {
      return ziel.pathname + ziel.search + ziel.hash;
    }
  } catch {
    // ungültige URL → "/"
  }
  return "/";
}

/** Macht aus dem Mail-Inhalt eine kurze Push-Nachricht. */
export function toPushPayload(
  c: {
    intro: string;
    highlight?: string;
    quote?: string;
    details?: string[];
    cta?: { url: string };
  },
  bandName: string,
  opts: { appUrl: string; tag?: string }
): PushPayload {
  const zusatz = c.highlight ?? c.quote ?? c.details?.[0];
  const body = zusatz ? `${c.intro} ${zusatz}` : c.intro;
  return {
    title: `BandMate · ${bandName}`,
    body: kuerzen(body.replace(/\s+/g, " ").trim(), MAX_BODY),
    url: sichererPfad(c.cta?.url, opts.appUrl),
    ...(opts.tag ? { tag: opts.tag } : {}),
  };
}

export type ValidSubscription = { endpoint: string; p256dh: string; auth: string };

/**
 * Hosts der Push-Dienste (exakt oder als Subdomain). Der Server schickt
 * Requests an den Endpoint — ohne diese Liste könnte ein Client ihn auf
 * beliebige Adressen zeigen lassen (SSRF).
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge (Android), Opera, Samsung
  "updates.push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari / iOS-Homescreen-Apps (web.push.apple.com)
  "notify.windows.com", // Edge (Windows)
];

const MAX_ENDPOINT = 1000;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function schluessel(wert: unknown, bytes: number): string | null {
  if (typeof wert !== "string" || wert.length > 200 || !BASE64URL.test(wert)) return null;
  return Buffer.from(wert, "base64url").length === bytes ? wert : null;
}

/** Prüft ein PushSubscription-JSON aus dem Browser. Ungültig → null. */
export function parseSubscription(input: unknown): ValidSubscription | null {
  if (!input || typeof input !== "object") return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!PUSH_HOSTS.some((h) => host === h || host.endsWith("." + h))) return null;

  if (!keys || typeof keys !== "object") return null;
  const k = keys as { p256dh?: unknown; auth?: unknown };
  const p256dh = schluessel(k.p256dh, 65); // unkomprimierter P-256-Punkt
  const auth = schluessel(k.auth, 16);
  if (!p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

/** Lesbare Gerätebezeichnung aus dem User-Agent — einfache Heuristik. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unbekanntes Gerät";
  const ua = userAgent;
  const geraet = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Gerät";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  return `${geraet} · ${browser}`;
}

/** Liest die Kanalwahl (Feld `notifyChannel`) aus einem Formular. Ungültig → null. */
export function readChannelForm(formData: FormData): NotifyChannel | null {
  const wert = String(formData.get("notifyChannel") ?? "");
  return wert in NOTIFY_CHANNELS ? (wert as NotifyChannel) : null;
}
