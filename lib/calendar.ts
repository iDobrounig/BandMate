import crypto from "node:crypto";
import { sessionOptions } from "@/lib/session";
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
    "PRODID:-//Bandraum//Termine//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Bandraum",
    "X-WR-CALDESC:Proben und Gigs der Band",
  ];

  for (const event of eventList) {
    const kindLabel = event.kind === "gig" ? "Gig" : "Probe";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:bandraum-${event.id}@bandraum`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (event.startTime) {
      // Lokale Zeit ohne Zeitzone ("floating") — Kalender interpretiert lokal
      lines.push(`DTSTART:${icsDateTime(event.date, event.startTime)}`);
      // Proben 2h, Gigs 3h als Standarddauer
      lines.push(
        `DTEND:${addHours(event.date, event.startTime, event.kind === "gig" ? 3 : 2)}`
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(`${kindLabel}: ${event.title}`)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    const descParts = [
      event.notes ?? "",
      appUrl ? `Zu-/Absagen: ${appUrl}/termine/${event.id}` : "",
    ].filter(Boolean);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcs(descParts.join("\n\n"))}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
