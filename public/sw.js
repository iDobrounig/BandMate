/*
 * BandMate Service Worker — NUR für Web Push.
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 *
 * Bewusst OHNE fetch-Handler und ohne Caching: Der Worker greift nie in
 * Seitenaufrufe ein, es kann also keine veraltete App-Version hängen bleiben.
 */

self.addEventListener("install", () => {
  // Neue Version sofort aktivieren — ohne fetch-Handler gibt es keinen Cache,
  // der dabei inkonsistent werden könnte.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "BandMate", {
      body: d.body || "",
      icon: "/icon-192.png",
      tag: d.tag,
      // Ersetzt eine Nachricht mit gleichem tag (z.B. zweiter Kommentar zum
      // selben Song) die alte, soll sie trotzdem wieder Ton/Vibration auslösen.
      renotify: Boolean(d.tag),
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  // Nur Ziele derselben Herkunft öffnen — sonst die Startseite.
  let url = self.location.origin + "/";
  try {
    const target = new URL(typeof raw === "string" ? raw : "/", self.location.origin);
    if (target.origin === self.location.origin) url = target.href;
  } catch {
    // ungültig → Startseite
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          try {
            await w.focus();
            // navigate() scheitert bei Fenstern, die dieser Worker (noch) nicht
            // steuert, z.B. nach einem harten Neuladen → dann neues Fenster.
            return await w.navigate(url);
          } catch {
            break;
          }
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
