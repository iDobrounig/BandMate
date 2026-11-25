import { describe, expect, it } from "vitest";
import {
  planChannels,
  mailFallbackNeeded,
  toPushPayload,
  parseSubscription,
  deviceLabel,
  readChannelForm,
} from "@/lib/notify-channels";

describe("planChannels", () => {
  it("folgt der Kanal-Tabelle aus dem Entwurf", () => {
    expect(planChannels("beides", 2, true)).toEqual({ push: true, mail: true });
    expect(planChannels("beides", 0, true)).toEqual({ push: false, mail: true });
    expect(planChannels("push", 1, true)).toEqual({ push: true, mail: false });
    expect(planChannels("push", 0, true)).toEqual({ push: false, mail: true });
    expect(planChannels("mail", 3, true)).toEqual({ push: false, mail: true });
  });

  it("ohne Push-Konfiguration geht immer Mail raus", () => {
    expect(planChannels("push", 2, false)).toEqual({ push: false, mail: true });
    expect(planChannels("beides", 2, false)).toEqual({ push: false, mail: true });
  });
});

describe("mailFallbackNeeded", () => {
  it("greift, wenn nur Push geplant war und nichts zugestellt wurde", () => {
    expect(mailFallbackNeeded({ push: true, mail: false }, 0)).toBe(true);
  });
  it("greift nicht, wenn Push mindestens einmal ankam", () => {
    expect(mailFallbackNeeded({ push: true, mail: false }, 1)).toBe(false);
  });
  it("greift nicht, wenn Mail ohnehin geplant war", () => {
    expect(mailFallbackNeeded({ push: true, mail: true }, 0)).toBe(false);
  });
});

describe("toPushPayload", () => {
  const appUrl = "https://band.example.com";
  const basis = {
    intro: "Anna hat einen neuen Song vorgeschlagen:",
    highlight: "Wonderwall – Oasis",
    cta: { url: "https://band.example.com/songs/5" },
  };

  it("setzt Titel mit Bandnamen und Text aus intro + highlight", () => {
    const p = toPushPayload(basis, "Testband", { appUrl });
    expect(p.title).toBe("BandMate · Testband");
    expect(p.body).toBe("Anna hat einen neuen Song vorgeschlagen: Wonderwall – Oasis");
  });

  it("nimmt quote, wenn kein highlight; sonst details[0]; sonst nur intro", () => {
    expect(
      toPushPayload({ intro: "Bert schreibt:", quote: "Super!" }, "B", { appUrl }).body
    ).toBe("Bert schreibt: Super!");
    expect(
      toPushPayload({ intro: "Geändert:", details: ["Datum: 1.1. → 2.1.", "x"] }, "B", { appUrl })
        .body
    ).toBe("Geändert: Datum: 1.1. → 2.1.");
    expect(toPushPayload({ intro: "Nur das." }, "B", { appUrl }).body).toBe("Nur das.");
  });

  it("kürzt auf höchstens 180 Zeichen mit …", () => {
    const p = toPushPayload({ intro: "x".repeat(300) }, "B", { appUrl });
    expect(Array.from(p.body).length).toBeLessThanOrEqual(180);
    expect(p.body.endsWith("…")).toBe(true);
  });

  it("zerschneidet beim Kürzen kein Emoji", () => {
    const p = toPushPayload({ intro: "🎸".repeat(200) }, "B", { appUrl });
    expect(p.body).toBe("🎸".repeat(179) + "…");
  });

  it("macht eigene absolute URLs zu Pfaden", () => {
    expect(toPushPayload(basis, "B", { appUrl }).url).toBe("/songs/5");
  });

  it("lässt Pfade durch", () => {
    expect(toPushPayload({ intro: "i", cta: { url: "/termine/3" } }, "B", { appUrl }).url).toBe(
      "/termine/3"
    );
  });

  it("fremde Herkunft, protokoll-relative URL oder fehlender Link → /", () => {
    const url = (u?: string) =>
      toPushPayload({ intro: "i", cta: u ? { url: u } : undefined }, "B", { appUrl }).url;
    expect(url("https://evil.example/x")).toBe("/");
    expect(url("//evil.example")).toBe("/");
    expect(url("javascript:alert(1)")).toBe("/");
    expect(url(undefined)).toBe("/");
  });

  it("reicht den tag durch", () => {
    expect(toPushPayload(basis, "B", { appUrl, tag: "suggestion-5" }).tag).toBe("suggestion-5");
  });
});

describe("parseSubscription", () => {
  const p256dh =
    "BK7Gsftp1cmlkfTBg3s73C1iP30ikHsW2LHr-oG2E1aQj0VCGcs6rdLYKG2d4oCUet7MYf3cNrURRG-qqbAAR74";
  const auth = "V5eA8Zz8koLH4Vaje3BCYw";
  const sub = (endpoint: string, keys: Record<string, string> = { p256dh, auth }) => ({
    endpoint,
    keys,
  });

  it("akzeptiert gültige Abos der bekannten Push-Dienste", () => {
    for (const host of [
      "fcm.googleapis.com",
      "web.push.apple.com",
      "updates.push.services.mozilla.com",
      "wns2-par02p.notify.windows.com",
    ]) {
      expect(parseSubscription(sub(`https://${host}/send/abc`))).toEqual({
        endpoint: `https://${host}/send/abc`,
        p256dh,
        auth,
      });
    }
  });

  it("lehnt fremde oder unsichere Endpoints ab", () => {
    for (const ep of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilpush.apple.com/x",
      "https://localhost/x",
      "kein-url",
      "https://fcm.googleapis.com/" + "a".repeat(1000),
    ]) {
      expect(parseSubscription(sub(ep))).toBeNull();
    }
  });

  it("lehnt kaputte Schlüssel ab", () => {
    const ep = "https://fcm.googleapis.com/fcm/send/abc";
    expect(parseSubscription(sub(ep, { p256dh: p256dh.replace("-", "+"), auth }))).toBeNull();
    expect(parseSubscription(sub(ep, { p256dh: p256dh.slice(0, 40), auth }))).toBeNull();
    expect(parseSubscription(sub(ep, { p256dh, auth: auth + "AAAA" }))).toBeNull();
    expect(parseSubscription(sub(ep, { p256dh }))).toBeNull();
    expect(parseSubscription({ endpoint: ep })).toBeNull();
    expect(parseSubscription(null)).toBeNull();
    expect(parseSubscription("x")).toBeNull();
  });
});

describe("deviceLabel", () => {
  it("erkennt gängige Geräte und Browser", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iPhone · Safari");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("Android · Chrome");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0"
      )
    ).toBe("Mac · Firefox");
    expect(deviceLabel(null)).toBe("Unbekanntes Gerät");
  });
});

describe("readChannelForm", () => {
  const fd = (v?: string) => {
    const f = new FormData();
    if (v !== undefined) f.set("notifyChannel", v);
    return f;
  };
  it("liest gültige Werte, sonst null", () => {
    expect(readChannelForm(fd("push"))).toBe("push");
    expect(readChannelForm(fd("beides"))).toBe("beides");
    expect(readChannelForm(fd("quatsch"))).toBeNull();
    expect(readChannelForm(fd())).toBeNull();
  });
});
