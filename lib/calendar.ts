import crypto from "node:crypto";
import { sessionOptions } from "@/lib/session";
import { formatFee } from "@/lib/format";
import type { BandEvent } from "@/lib/db/schema";

/**
 * Geheimer Token für den Kalender-Feed (Kalender-Apps können sich nicht
 * einloggen). Vom SESSION_SECRET abgeleitet — ändert sich das Secret,
 * ändert sich auch die Feed-URL.
 */
export function calendarToken(): string {
  return crypto
    .createHash("sha256")
    .update(`${sessionOptions.password}:bandraum-ics-feed`)
    .digest("hex")
    .slice(0, 32);
}

export function calendarFeedPath(): string {
  return `/api/kalender/${calendarToken()}`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDateTime(date: string, time: string): string {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function addHours(date: string, time: string, hours: number): string {
  const d = new Date(`${date}T${time}:00`);
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
}

function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * Faltet zu lange Zeilen nach RFC 5545: höchstens 75 Oktette je Zeile,
 * Fortsetzungen beginnen mit einem Leerzeichen (das mitzählt).
 *
 * Gemessen wird in Oktetten, nicht in Zeichen — ein Umlaut belegt zwei. Und es
 * darf nicht mitten in ein UTF-8-Zeichen geschnitten werden, sonst steht im
 * Kalender Buchstabensalat.
 */
function foldIcsLine(line: string): string[] {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return [line];

  const teile: string[] = [];
  let start = 0;
  let laenge = 75; // Folgezeilen: 74 + führendes Leerzeichen
  while (start < bytes.length) {
    let ende = Math.min(start + laenge, bytes.length);
    // Nicht in ein Fortsetzungsbyte (10xxxxxx) hineinschneiden
    while (ende > start + 1 && ende < bytes.length && (bytes[ende] & 0xc0) === 0x80) {
      ende--;
    }
    teile.push(bytes.subarray(start, ende).toString("utf8"));
    start = ende;
    laenge = 74;
  }
  return teile.map((t, i) => (i === 0 ? t : ` ${t}`));
}

/**
 * Erinnerungen für einen Termin. Ohne die kommen Termine zwar im abonnierten
 * Kalender an, aber ohne Wecker — und damit ohne den eigentlichen Nutzen.
 *
 * Bei Terminen mit Uhrzeit zwei Alarme: am Vortag zur selben Zeit („morgen ist
 * Probe") und zwei Stunden vorher („losfahren"). Ganztägige Termine bekommen
 * nur einen, zwölf Stunden vor Mitternacht — also mittags am Vortag; `-P1D`
 * wäre dort Mitternacht und damit nutzlos.
 */
function valarms(event: BandEvent, kindLabel: string): string[] {
  const titel = `${kindLabel}: ${event.title}`;
  const alarm = (trigger: string, text: string) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${escapeIcs(text)}`,
    "END:VALARM",
  ];

  if (!event.startTime) return alarm("-PT12H", `Morgen — ${titel}`);
  return [
    ...alarm("-P1D", `Morgen — ${titel}`),
    ...alarm("-PT2H", `In 2 Stunden — ${titel}`),
  ];
}

/** Baut den kompletten VCALENDAR-Text für alle Termine. */
export function buildIcs(eventList: BandEvent[], appUrl: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(
    now.getUTCSeconds()
  )}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BandMate//Termine//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:BandMate",
    "X-WR-CALDESC:Proben und Gigs der Band",
  ];

  for (const event of eventList) {
    const kindLabel = event.kind === "gig" ? "Gig" : "Probe";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:bandmate-${event.id}@bandmate`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (event.startTime) {
      // Lokale Zeit ohne Zeitzone ("floating") — Kalender interpretiert lokal
      lines.push(`DTSTART:${icsDateTime(event.date, event.startTime)}`);
      // Proben 2h. Gigs: bis Auftritt + 2h (startTime ist Load-in), sonst +3h.
      const gig = event.kind === "gig";
      const endBase = gig && event.stageTime ? event.stageTime : event.startTime;
      const endHours = gig ? (event.stageTime ? 2 : 3) : 2;
      lines.push(`DTEND:${addHours(event.date, endBase, endHours)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(`${kindLabel}: ${event.title}`)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    const logistik: string[] = [];
    if (event.kind === "gig") {
      const zeiten = [
        event.startTime ? `Load-in ${event.startTime}` : null,
        event.soundcheckTime ? `Soundcheck ${event.soundcheckTime}` : null,
        event.stageTime ? `Auftritt ${event.stageTime}` : null,
      ].filter(Boolean);
      if (zeiten.length) logistik.push(zeiten.join(" · "));
      if (event.contactName || event.contactPhone)
        logistik.push(
          `Kontakt: ${[event.contactName, event.contactPhone].filter(Boolean).join(", ")}`
        );
      if (event.fee != null || event.feeExtras)
        logistik.push(
          `Gage: ${[formatFee(event.fee), event.feeExtras].filter(Boolean).join(" · ")}`
        );
      if (event.travelNotes) logistik.push(`Anfahrt: ${event.travelNotes}`);
      if (event.backlineNotes) logistik.push(`Backline: ${event.backlineNotes}`);
    }
    const descParts = [
      logistik.length ? logistik.join("\n") : "",
      event.notes ?? "",
      appUrl ? `Zu-/Absagen: ${appUrl}/termine/${event.id}` : "",
    ].filter(Boolean);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcs(descParts.join("\n\n"))}`);
    }
    lines.push(...valarms(event, kindLabel));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // Erst ganz am Schluss falten: vorher wird noch escaped und zusammengesetzt.
  return lines.flatMap(foldIcsLine).join("\r\n") + "\r\n";
}
