import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Der Service Worker (public/sw.js) in einer nachgebauten Worker-Umgebung:
 * `self` mit Event-Registrierung, `registration.showNotification` und `clients`.
 */
function ladeServiceWorker(fenster: { url: string; navigate: () => Promise<unknown> }[] = []) {
  const handler: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: "https://band.example.com" },
    addEventListener: (typ: string, fn: (e: unknown) => void) => (handler[typ] = fn),
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue(
        fenster.map((w) => ({ ...w, focus: vi.fn().mockResolvedValue(undefined) }))
      ),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
  };
  const code = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  new Function("self", code)(self);

  const ausloesen = async (typ: string, event: Record<string, unknown>) => {
    let warten: Promise<unknown> = Promise.resolve();
    handler[typ]({ ...event, waitUntil: (p: Promise<unknown>) => (warten = p) });
    await warten;
  };
  return { self, ausloesen };
}

const klick = (url: string) => ({
  notification: { close: vi.fn(), data: { url } },
});

describe("Service Worker", () => {
  it("zeigt Push mit Titel, Text, Ziel und meldet sich bei gleichem tag erneut", async () => {
    const { self, ausloesen } = ladeServiceWorker();
    await ausloesen("push", {
      data: { json: () => ({ title: "T", body: "B", url: "/songs/1", tag: "comment-/songs/1" }) },
    });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "T",
      expect.objectContaining({
        body: "B",
        tag: "comment-/songs/1",
        renotify: true,
        data: { url: "/songs/1" },
      })
    );
  });

  it("ohne tag kein renotify (Browser verlangen sonst einen tag)", async () => {
    const { self, ausloesen } = ladeServiceWorker();
    await ausloesen("push", { data: { json: () => ({ title: "T", body: "B" }) } });
    const optionen = self.registration.showNotification.mock.calls[0][1];
    expect(optionen.renotify).toBeFalsy();
  });

  it("öffnet ein neues Fenster, wenn navigate() beim vorhandenen scheitert", async () => {
    const { self, ausloesen } = ladeServiceWorker([
      {
        url: "https://band.example.com/",
        navigate: () => Promise.reject(new TypeError("not controlled")),
      },
    ]);
    await ausloesen("notificationclick", klick("/songs/5"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://band.example.com/songs/5");
  });

  it("navigiert ein vorhandenes Fenster der App zum Ziel", async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const { self, ausloesen } = ladeServiceWorker([
      { url: "https://band.example.com/profil", navigate },
    ]);
    await ausloesen("notificationclick", klick("/termine/3"));
    expect(navigate).toHaveBeenCalledWith("https://band.example.com/termine/3");
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("öffnet bei fremder Herkunft nur die Startseite", async () => {
    const { self, ausloesen } = ladeServiceWorker();
    await ausloesen("notificationclick", klick("https://evil.example/x"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://band.example.com/");
  });
});
