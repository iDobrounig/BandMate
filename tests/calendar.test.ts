import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/calendar";
import type { BandEvent } from "@/lib/db/schema";

function termin(over: Partial<BandEvent> = {}): BandEvent {
  return {
    id: 1,
    title: "Bandprobe",
    kind: "rehearsal",
    date: "2026-08-06",
    startTime: "19:30",
    location: "Proberaum",
    notes: null,
    setlistId: null,
    seriesId: null,
    createdById: 1,
    createdAt: new Date("2026-07-01T10:00:00Z"),
    deletedAt: null,
    deletedById: null,
    soundcheckTime: null,
    stageTime: null,
    contactName: null,
    contactPhone: null,
    fee: null,
    feeExtras: null,
    travelNotes: null,
    backlineNotes: null,
    ...over,
  } as BandEvent;
}

/** Entfaltet den Feed wieder (RFC 5545: CRLF + Leerzeichen = Fortsetzung). */
function entfalten(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

/** Holt die entfaltete DESCRIPTION und macht ICS-Maskierung rückgängig. */
function beschreibung(ics: string): string | undefined {
  const z = entfalten(ics).find((l) => l.startsWith("DESCRIPTION:"));
  return z
    ?.slice("DESCRIPTION:".length)
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

describe("Erinnerungen (VALARM)", () => {
  it("hängt einem Termin mit Uhrzeit zwei Alarme an", () => {
    const zeilen = entfalten(buildIcs([termin()], "https://band.example.com"));
    expect(zeilen.filter((z) => z === "BEGIN:VALARM")).toHaveLength(2);
    expect(zeilen).toContain("TRIGGER:-P1D");
    expect(zeilen).toContain("TRIGGER:-PT2H");
    expect(zeilen).toContain("DESCRIPTION:Morgen — Probe: Bandprobe");
    expect(zeilen).toContain("DESCRIPTION:In 2 Stunden — Probe: Bandprobe");
  });

  it("gibt einem ganztägigen Termin einen Alarm zur Mittagszeit des Vortags", () => {
    const zeilen = entfalten(buildIcs([termin({ startTime: null })], ""));
    expect(zeilen.filter((z) => z === "BEGIN:VALARM")).toHaveLength(1);
    // -P1D wäre bei einem Ganztagestermin Mitternacht und damit nutzlos
    expect(zeilen).toContain("TRIGGER:-PT12H");
    expect(zeilen).not.toContain("TRIGGER:-P1D");
  });

  it("steckt die Alarme in den Termin, nicht zwischen zwei Termine", () => {
    const ics = buildIcs([termin({ id: 1 }), termin({ id: 2, title: "Gig" })], "");
    const zeilen = entfalten(ics);
    // Zwischen jedem BEGIN:VEVENT und dem zugehörigen END:VEVENT
    let offen = false;
    for (const z of zeilen) {
      if (z === "BEGIN:VEVENT") offen = true;
      if (z === "BEGIN:VALARM") expect(offen).toBe(true);
      if (z === "END:VEVENT") offen = false;
    }
    expect(zeilen.filter((z) => z === "BEGIN:VALARM")).toHaveLength(4);
    expect(zeilen.filter((z) => z === "END:VALARM")).toHaveLength(4);
  });

  it("nennt bei einem Gig auch „Gig“ und nicht „Probe“", () => {
    const zeilen = entfalten(buildIcs([termin({ kind: "gig", title: "Stadtfest" })], ""));
    expect(zeilen).toContain("DESCRIPTION:Morgen — Gig: Stadtfest");
  });
});

describe("Zeilenfaltung (RFC 5545)", () => {
  it("hält jede Zeile bei höchstens 75 Oktetten", () => {
    const ics = buildIcs(
      [termin({ notes: "Sehr lange Notiz. ".repeat(30), location: "Ö".repeat(60) })],
      "https://band.example.com"
    );
    for (const zeile of ics.split("\r\n")) {
      expect(Buffer.from(zeile, "utf8").length).toBeLessThanOrEqual(75);
    }
  });

  it("liefert den Inhalt nach dem Entfalten unverändert zurück", () => {
    // Bewusst ohne Komma/Semikolon: hier geht es um die Faltung, nicht um die
    // Maskierung (die prüft „maskiert Sonderzeichen"). Dafür viele Umlaute —
    // die belegen zwei Oktette und landen so auf den Faltungsgrenzen.
    const notiz = "Bitte Verstärker mitbringen — Öfen Ärger Übung Straße".repeat(4);
    const zeilen = entfalten(buildIcs([termin({ notes: notiz })], ""));
    const desc = zeilen.find((z) => z.startsWith("DESCRIPTION:Bitte"));
    expect(desc).toBe(`DESCRIPTION:${notiz}`);
    expect(desc).not.toContain("�"); // kein zerschnittenes UTF-8-Zeichen
  });

  it("lässt kurze Zeilen unangetastet", () => {
    const ics = buildIcs([termin({ notes: null, location: null })], "");
    expect(ics).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(ics).toContain("\r\nSUMMARY:Probe: Bandprobe\r\n");
  });
});

describe("Gig-Logistik im Feed", () => {
  const gig = {
    kind: "gig" as const,
    title: "Stadtfest",
    date: "2026-08-06",
    startTime: "15:00",
    soundcheckTime: "16:30",
    stageTime: "20:00",
    contactName: "Max Huber",
    contactPhone: "0664 1234567",
    fee: 400,
    feeExtras: "warmes Essen",
    travelNotes: "Parkplatz hinterm Zelt",
    backlineNotes: "Drumkit steht",
  };

  it("stellt einem Gig einen Logistik-Block in die DESCRIPTION voran", () => {
    const desc = beschreibung(buildIcs([termin(gig)], "https://b.example.com"));
    expect(desc).toContain("Load-in 15:00 · Soundcheck 16:30 · Auftritt 20:00");
    expect(desc).toContain("Kontakt: Max Huber, 0664 1234567");
    expect(desc).toContain("Gage: 400 € · warmes Essen");
    expect(desc).toContain("Anfahrt: Parkplatz hinterm Zelt");
    expect(desc).toContain("Backline: Drumkit steht");
  });

  it("setzt DTEND bei einem Gig auf Auftrittszeit + 2 h", () => {
    const zeilen = entfalten(buildIcs([termin(gig)], ""));
    expect(zeilen).toContain("DTSTART:20260806T150000");
    expect(zeilen).toContain("DTEND:20260806T220000");
  });

  it("lässt Proben unverändert (kein Block, DTEND = startTime + 2 h)", () => {
    const desc = beschreibung(
      buildIcs([termin({ date: "2026-08-06", startTime: "19:30", notes: "Nur Notiz" })], "")
    );
    expect(desc).not.toContain("Load-in");
    const zeilen = entfalten(buildIcs([termin({ date: "2026-08-06", startTime: "19:30" })], ""));
    expect(zeilen).toContain("DTEND:20260806T213000");
  });
});

describe("Grundgerüst", () => {
  it("bleibt ein gültiger Kalender mit passenden Klammern", () => {
    const zeilen = entfalten(buildIcs([termin(), termin({ id: 2 })], ""));
    expect(zeilen[0]).toBe("BEGIN:VCALENDAR");
    expect(zeilen.filter((z) => z === "END:VCALENDAR")).toHaveLength(1);
    expect(zeilen.filter((z) => z === "BEGIN:VEVENT")).toHaveLength(2);
    expect(zeilen.filter((z) => z === "END:VEVENT")).toHaveLength(2);
  });

  it("maskiert Sonderzeichen in Titel und Ort", () => {
    const zeilen = entfalten(
      buildIcs([termin({ title: "Gig; mit, Komma", location: "Weg\\Gasse" })], "")
    );
    expect(zeilen).toContain("SUMMARY:Probe: Gig\\; mit\\, Komma");
    expect(zeilen).toContain("LOCATION:Weg\\\\Gasse");
  });
});
