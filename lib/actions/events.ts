"use server";

import crypto from "node:crypto";
import { and, eq, gte, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  type AttendanceStatus,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eventAktiv } from "@/lib/db/filters";
import { notifyBand } from "@/lib/mail";
import { describeEventChanges } from "@/lib/event-notify";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/actions/auth";

const MAX_SERIES_INSTANCES = 30;

function readEventFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const kind = formData.get("kind") === "gig" ? ("gig" as const) : ("rehearsal" as const);
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const setlistIdRaw = String(formData.get("setlistId") ?? "").trim();
  const setlistId = setlistIdRaw ? Number(setlistIdRaw) : null;

  // Gig-Logistik. Fehlen die Felder (Probe-Termin, Block nicht gerendert),
  // liest FormData sie als leer → null; ein Umschalten Gig→Probe leert sie.
  const t = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const feeNum = feeRaw ? Number(feeRaw) : NaN;

  return {
    title,
    kind,
    date,
    startTime: startTime || null,
    location: location || null,
    notes: notes || null,
    setlistId,
    soundcheckTime: t("soundcheckTime"),
    stageTime: t("stageTime"),
    contactName: t("contactName"),
    contactPhone: t("contactPhone"),
    // Tippfehler soll das Formular nicht blockieren → NaN wird zu null.
    fee: Number.isFinite(feeNum) ? feeNum : null,
    feeExtras: t("feeExtras"),
    travelNotes: t("travelNotes"),
    backlineNotes: t("backlineNotes"),
  };
}

export async function createEvent(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const fields = readEventFields(formData);
  if (!fields.title) return { error: "Der Termin braucht einen Titel." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))
    return { error: "Bitte ein Datum angeben." };

  const repeatWeekly = formData.get("repeatWeekly") === "on";
  const repeatUntil = String(formData.get("repeatUntil") ?? "").trim();
  const sendMail = formData.get("sendMail") === "on";

  // Termindaten (bei Serie: alle Wochen-Instanzen materialisieren)
  const dates: string[] = [fields.date];
  if (repeatWeekly) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(repeatUntil))
      return { error: "Bitte ein Enddatum für die Wiederholung angeben." };
    if (repeatUntil <= fields.date)
      return { error: "Das Enddatum muss nach dem ersten Termin liegen." };
    const cursor = new Date(`${fields.date}T12:00:00`);
    while (dates.length < MAX_SERIES_INSTANCES) {
      cursor.setDate(cursor.getDate() + 7);
      const iso = cursor.toISOString().slice(0, 10);
      if (iso > repeatUntil) break;
      dates.push(iso);
    }
  }

  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const inserted = await db
    .insert(events)
    .values(
      dates.map((date) => ({
        ...fields,
        date,
        seriesId,
        createdById: user.id,
      }))
    )
    .returning({ id: events.id });

  if (sendMail) {
    const kindLabel = fields.kind === "gig" ? "Gig" : "Probe";
    const when =
      dates.length > 1
        ? `Wöchentlich ab ${formatDate(dates[0])} bis ${formatDate(dates[dates.length - 1])} (${dates.length} Termine)`
        : `${formatDate(dates[0])}${fields.startTime ? `, ${fields.startTime} Uhr` : ""}`;
    notifyBand({
      kind: "event_new",
      subject: `Neuer Termin: ${fields.title} (${kindLabel})`,
      heading: "Neuer Termin",
      intro: `${user.name} hat einen neuen Termin angelegt:`,
      highlight: `${fields.title} (${kindLabel})`,
      details: [when, fields.location ? `Ort: ${fields.location}` : null].filter(
        (l): l is string => Boolean(l)
      ),
      cta: {
        label: "Zu-/Absagen",
        url: `${process.env.APP_URL ?? ""}/termine/${inserted[0].id}`,
      },
      excludeUserId: user.id,
    });
  }

  revalidatePath("/", "layout");
  redirect(dates.length > 1 ? "/termine" : `/termine/${inserted[0].id}`);
}

export async function updateEvent(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const eventId = Number(formData.get("eventId"));
  const fields = readEventFields(formData);
  if (!fields.title) return { error: "Der Termin braucht einen Titel." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))
    return { error: "Bitte ein Datum angeben." };

  // Alten Stand VOR dem Speichern lesen, damit die Mail „alt → neu" nennen kann.
  const alt = await db.query.events.findFirst({ where: eq(events.id, eventId) });

  await db.update(events).set(fields).where(eq(events.id, eventId));

  const sendMail = formData.get("sendMail") === "on";
  if (sendMail && alt) {
    const changes = describeEventChanges(alt, fields, fields.kind);
    // Nur benachrichtigen, wenn sich Datum/Load-in/Ort/Soundcheck/Auftritt geändert hat.
    if (changes.length > 0) {
      const kindLabel = fields.kind === "gig" ? "Gig" : "Probe";
      notifyBand({
        kind: "event_changed",
        subject: `Termin geändert: ${fields.title} (${kindLabel})`,
        heading: "Termin geändert",
        intro: `${user.name} hat „${fields.title}" geändert:`,
        details: changes,
        cta: {
          label: "Zum Termin",
          url: `${process.env.APP_URL ?? ""}/termine/${eventId}`,
        },
        excludeUserId: user.id,
      });
    }
  }

  revalidatePath("/", "layout");
  redirect(`/termine/${eventId}`);
}

/**
 * Uhrzeit/Ort/Notiz für alle KÜNFTIGEN Termine einer Serie auf einmal ändern.
 * Titel und Datum bleiben Sache des Einzeltermins. Anders als beim Löschen der
 * ganzen Serie (das bewusst keine Datumsgrenze kennt) bleiben bereits
 * stattgefundene Termine der Serie unangetastet.
 */
export async function updateEventSeries(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const eventId = Number(formData.get("eventId"));
  const startTime = String(formData.get("startTime") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { error: "Termin nicht gefunden." };
  if (!event.seriesId) return { error: "Dieser Termin gehört zu keiner Serie." };

  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(events)
    .set({ startTime, location, notes })
    .where(and(eq(events.seriesId, event.seriesId), gte(events.date, today), eventAktiv));

  const sendMail = formData.get("sendMail") === "on";
  if (sendMail) {
    const changes = describeEventChanges(
      { date: event.date, startTime: event.startTime, location: event.location },
      { date: event.date, startTime, location },
      event.kind
    );
    if (changes.length > 0) {
      const kindLabel = event.kind === "gig" ? "Gig" : "Probe";
      notifyBand({
        kind: "event_changed",
        subject: `Serientermin geändert: ${event.title} (${kindLabel})`,
        heading: "Serientermin geändert",
        intro: `${user.name} hat alle kommenden Termine der Serie „${event.title}" geändert:`,
        details: changes,
        cta: {
          label: "Zum Termin",
          url: `${process.env.APP_URL ?? ""}/termine/${eventId}`,
        },
        excludeUserId: user.id,
      });
    }
  }

  revalidatePath("/", "layout");
  redirect(`/termine/${eventId}`);
}

export async function deleteEvent(eventId: number, scope: "single" | "series") {
  const user = await requireUser();
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;
  // Identischer Zeitstempel für die ganze Serie — daran erkennt der Papierkorb,
  // was gesammelt weggeworfen wurde, und zeigt einen Eintrag statt zwölf.
  const geloescht = { deletedAt: new Date(), deletedById: user.id };
  if (scope === "series" && event.seriesId) {
    await db.update(events).set(geloescht).where(eq(events.seriesId, event.seriesId));
  } else {
    await db.update(events).set(geloescht).where(eq(events.id, eventId));
  }
  revalidatePath("/", "layout");
  redirect(`/termine?undo=event:${eventId}`);
}

/** Song auf die Probe-Agenda eines Termins setzen. */
export async function addSongToEvent(eventId: number, songId: number) {
  await requireUser();
  const [row] = await db
    .select({ maxPos: max(eventSongs.position) })
    .from(eventSongs)
    .where(eq(eventSongs.eventId, eventId));
  await db.insert(eventSongs).values({
    eventId,
    songId,
    position: (row?.maxPos ?? 0) + 1,
  });
  revalidatePath(`/termine/${eventId}`);
}

export async function removeEventSong(eventSongId: number) {
  await requireUser();
  const row = await db.query.eventSongs.findFirst({
    where: eq(eventSongs.id, eventSongId),
  });
  if (!row) return;
  await db.delete(eventSongs).where(eq(eventSongs.id, eventSongId));
  revalidatePath(`/termine/${row.eventId}`);
}

export async function setAttendance(
  eventId: number,
  status: AttendanceStatus,
  comment?: string
) {
  const user = await requireUser();
  await db
    .insert(eventAttendance)
    .values({ eventId, userId: user.id, status, comment: comment?.trim() || null })
    .onConflictDoUpdate({
      target: [eventAttendance.eventId, eventAttendance.userId],
      set: { status, comment: comment?.trim() || null },
    });
  revalidatePath("/", "layout");
}
