"use server";

import crypto from "node:crypto";
import { eq, max } from "drizzle-orm";
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
import { notifyBand } from "@/lib/mail";
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
  return {
    title,
    kind,
    date,
    startTime: startTime || null,
    location: location || null,
    notes: notes || null,
    setlistId,
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
  await requireUser();
  const eventId = Number(formData.get("eventId"));
  const fields = readEventFields(formData);
  if (!fields.title) return { error: "Der Termin braucht einen Titel." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))
    return { error: "Bitte ein Datum angeben." };

  await db.update(events).set(fields).where(eq(events.id, eventId));
  revalidatePath("/", "layout");
  return { success: "Termin gespeichert." };
}

export async function deleteEvent(eventId: number, scope: "single" | "series") {
  await requireUser();
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;
  if (scope === "series" && event.seriesId) {
    await db.delete(events).where(eq(events.seriesId, event.seriesId));
  } else {
    await db.delete(events).where(eq(events.id, eventId));
  }
  revalidatePath("/", "layout");
  redirect("/termine");
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
