import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  songs,
  notificationLog,
  notificationRuns,
} from "@/lib/db/schema";
import { fetchRecipients } from "@/lib/notifications";
import {
  createBatchMailer,
  isSmtpConfigured,
  type MailContent,
} from "@/lib/mail";
import { formatDate } from "@/lib/format";
import { EVENT_KIND } from "@/lib/constants";

/**
 * Termin-Erinnerungen.
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Zwei Auslöser mit verschiedenem Zweck (Entwurf E4):
 *  - 2 Tage vorher an alle OHNE Rückmeldung — holt fehlende Zu-/Absagen ein,
 *    solange noch umdisponiert werden kann (refType "event_rsvp").
 *  - am Vortag an alle, die zu- oder vielleicht-gesagt haben — die eigentliche
 *    Erinnerung mit Ort, Zeit und Agenda (refType "event_soon").
 *
 * Nie zwei gleiche Mails an dieselbe Person: der eindeutige Index über
 * (kind, refType, refId, userId) im Versand-Log macht das Ganze idempotent —
 * ein doppelter Cron-Lauf verschickt beim zweiten Mal nichts.
 */

export type ReminderRefType = "event_rsvp" | "event_soon";

/** Ein geplanter Versand — noch nicht abgeschickt, noch nicht geloggt. */
export type PlannedSend = {
  userId: number;
  email: string;
  refType: ReminderRefType;
  refId: number;
  subject: string;
  content: MailContent;
};

/** Datum als YYYY-MM-DD, um `tage` verschoben. Lokale Zeit (TZ ist gesetzt). */
export function tagePlus(tage: number, heute = new Date()): string {
  const d = new Date(heute);
  d.setHours(12, 0, 0, 0); // Mittag: gegen Sommerzeit-Sprünge robust
  d.setDate(d.getDate() + tage);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function terminZeile(datum: string, startTime: string | null): string {
  return `${formatDate(datum)}${startTime ? `, ${startTime} Uhr` : ""}`;
}

async function agendaZeilen(eventId: number): Promise<string[]> {
  const rows = await db
    .select({ title: songs.title, artist: songs.artist })
    .from(eventSongs)
    .innerJoin(songs, eq(eventSongs.songId, songs.id))
    .where(and(eq(eventSongs.eventId, eventId), isNull(songs.deletedAt)))
    .orderBy(eventSongs.position);
  return rows.map((r) => `• ${r.title}${r.artist ? ` – ${r.artist}` : ""}`);
}

/**
 * Stellt alle fälligen Erinnerungen für einen Stichtag zusammen — ohne die
 * bereits versendeten. Reine Planung, verschickt nichts.
 */
export async function planReminders(
  appUrl: string,
  heute = new Date()
): Promise<PlannedSend[]> {
  // Empfänger sind pro Band verschieden — je Band einmal auflösen und cachen.
  const empfCache = new Map<number, Awaited<ReturnType<typeof fetchRecipients>>>();
  const empfaengerFuer = async (bandId: number) => {
    let e = empfCache.get(bandId);
    if (!e) {
      e = await fetchRecipients("reminder", bandId);
      empfCache.set(bandId, e);
    }
    return e;
  };

  const geplant: PlannedSend[] = [];

  // ---- 2 Tage vorher: an alle ohne Rückmeldung -----------------------------
  const in2Tagen = tagePlus(2, heute);
  const termineRsvp = await db.query.events.findMany({
    where: (e, { and, eq, isNull }) => and(eq(e.date, in2Tagen), isNull(e.deletedAt)),
  });
  for (const event of termineRsvp) {
    if (event.bandId == null) continue;
    const empfaenger = await empfaengerFuer(event.bandId);
    const geantwortet = await db
      .select({ userId: eventAttendance.userId })
      .from(eventAttendance)
      .where(eq(eventAttendance.eventId, event.id));
    const hatGeantwortet = new Set(geantwortet.map((a) => a.userId));
    const kindLabel = EVENT_KIND[event.kind].label;

    for (const person of empfaenger) {
      if (hatGeantwortet.has(person.id)) continue;
      geplant.push({
        userId: person.id,
        email: person.email,
        refType: "event_rsvp",
        refId: event.id,
        subject: `Sag noch zu: ${event.title}`,
        content: {
          heading: `${kindLabel} in 2 Tagen`,
          intro: `Du hast für „${event.title}" noch nicht zu- oder abgesagt.`,
          highlight: `${event.title} — ${terminZeile(event.date, event.startTime)}`,
          details: event.location ? [`Ort: ${event.location}`] : undefined,
          cta: { label: "Zu-/Absagen", url: `${appUrl}/termine/${event.id}` },
        },
      });
    }
  }

  // ---- am Vortag: an alle mit yes/maybe ------------------------------------
  const morgen = tagePlus(1, heute);
  const termineSoon = await db.query.events.findMany({
    where: (e, { and, eq, isNull }) => and(eq(e.date, morgen), isNull(e.deletedAt)),
  });
  for (const event of termineSoon) {
    if (event.bandId == null) continue;
    const empfById = new Map((await empfaengerFuer(event.bandId)).map((e) => [e.id, e]));
    const zusagen = await db
      .select({ userId: eventAttendance.userId })
      .from(eventAttendance)
      .where(
        and(
          eq(eventAttendance.eventId, event.id),
          inArray(eventAttendance.status, ["yes", "maybe"])
        )
      );
    const kindLabel = EVENT_KIND[event.kind].label;
    const agenda = await agendaZeilen(event.id);

    for (const { userId } of zusagen) {
      const person = empfById.get(userId);
      if (!person) continue; // nicht aktiv, kein Bandmitglied oder reminder=nie
      geplant.push({
        userId: person.id,
        email: person.email,
        refType: "event_soon",
        refId: event.id,
        subject: `Morgen: ${event.title}`,
        content: {
          heading: `${kindLabel} morgen`,
          intro: `Erinnerung: „${event.title}" ist morgen.`,
          highlight: `${event.title} — ${terminZeile(event.date, event.startTime)}`,
          details: [
            event.location ? `Ort: ${event.location}` : null,
            agenda.length > 0 ? `Auf der Agenda:\n${agenda.join("\n")}` : null,
          ].filter((x): x is string => Boolean(x)),
          cta: { label: "Zum Termin", url: `${appUrl}/termine/${event.id}` },
        },
      });
    }
  }

  // ---- schon erfolgreich Versendetes herausfiltern (Idempotenz) ------------
  // Nur „ok" gilt als erledigt. Ein „fehler"-Eintrag (z.B. SMTP kurz weg) darf
  // den nächsten Lauf NICHT blockieren — sonst heilt sich ein vorübergehendes
  // Problem nie von selbst.
  if (geplant.length === 0) return [];
  const bereits = await db
    .select({
      refType: notificationLog.refType,
      refId: notificationLog.refId,
      userId: notificationLog.userId,
    })
    .from(notificationLog)
    .where(
      and(eq(notificationLog.kind, "reminder"), eq(notificationLog.status, "ok"))
    );
  const schluessel = new Set(bereits.map((b) => `${b.refType}:${b.refId}:${b.userId}`));

  return geplant.filter(
    (p) => !schluessel.has(`${p.refType}:${p.refId}:${p.userId}`)
  );
}

export type RunResult = { sent: number; errors: number; note: string };

/**
 * Führt einen Erinnerungs-Lauf aus: plant, verschickt einzeln, schreibt jedes
 * Ergebnis ins Log und hält den Lauf selbst in notification_runs fest.
 *
 * Ein Fehler bei einem Empfänger bricht den Lauf nicht ab — er wird gezählt und
 * macht später die Statuszeile auf dem Dashboard rot. Nur ein tatsächlich
 * versendeter Eintrag kommt als „ok" ins Log; ein „fehler"-Eintrag blockiert
 * den nächsten Lauf NICHT, damit ein vorübergehendes SMTP-Problem sich von
 * selbst heilt.
 */
export async function runReminders(
  appUrl: string,
  heute = new Date()
): Promise<RunResult> {
  const [lauf] = await db
    .insert(notificationRuns)
    .values({ art: "reminders" })
    .returning({ id: notificationRuns.id });

  let sent = 0;
  let errors = 0;

  try {
    const geplant = await planReminders(appUrl, heute);

    // Eine Zeile je (kind, refType, refId, userId) — der Unique-Index erzwingt
    // das. Ein Fehlversuch schreibt „fehler"; klappt es beim nächsten Lauf,
    // wird dieselbe Zeile auf „ok" gehoben. Deshalb durchweg Upsert statt
    // Insert, sonst kollidierte der zweite Versuch mit dem Index.
    const schreibeLog = (
      p: PlannedSend,
      status: "ok" | "fehler",
      error: string | null
    ) =>
      db
        .insert(notificationLog)
        .values({
          kind: "reminder",
          refType: p.refType,
          refId: p.refId,
          userId: p.userId,
          status,
          error,
        })
        .onConflictDoUpdate({
          target: [
            notificationLog.kind,
            notificationLog.refType,
            notificationLog.refId,
            notificationLog.userId,
          ],
          set: { status, error, sentAt: new Date() },
        });

    // Eine gepoolte Verbindung für den ganzen Lauf, statt pro Empfänger neu.
    // Ohne SMTP wirft createBatchMailer sofort — dann wird jeder geplante
    // Versand als „fehler" protokolliert (und beim nächsten Lauf erneut
    // versucht), statt still gar nichts zu tun.
    let mailer: ReturnType<typeof createBatchMailer> | null = null;
    try {
      mailer = createBatchMailer();
    } catch {
      mailer = null;
    }

    // Ein transientes SMTP-Problem („Greeting never received") würde die
    // 2-Tages-Erinnerung endgültig verlieren — der nächste Lauf holt sie nicht
    // nach, weil der Termin dann nur noch einen Tag entfernt ist (andere Sorte).
    // Deshalb je Mail bis zu zwei Versuche mit kurzer Pause.
    const sendeEinmal = async (p: PlannedSend): Promise<void> => {
      // Kein SMTP ist kein transienter Fehler — nicht wiederholen.
      if (!mailer) throw new Error("SMTP nicht konfiguriert");
      let letzter: unknown;
      for (let versuch = 1; versuch <= 2; versuch++) {
        try {
          await mailer.send(p.email, p.subject, p.content);
          return;
        } catch (err) {
          letzter = err;
          if (versuch < 2) await new Promise((r) => setTimeout(r, 750));
        }
      }
      throw letzter;
    };

    try {
      for (const p of geplant) {
        try {
          await sendeEinmal(p);
          await schreibeLog(p, "ok", null);
          sent++;
        } catch (err) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          await schreibeLog(p, "fehler", message.slice(0, 500));
        }
      }
    } finally {
      mailer?.close();
    }
  } finally {
    const note = !isSmtpConfigured()
      ? "SMTP nicht konfiguriert — nichts versendet"
      : `${sent} versendet, ${errors} Fehler`;
    await db
      .update(notificationRuns)
      .set({ finishedAt: new Date(), sentCount: sent, errorCount: errors, note })
      .where(eq(notificationRuns.id, lauf.id));
  }

  return {
    sent,
    errors,
    note: `${sent} Erinnerung(en) versendet, ${errors} Fehler`,
  };
}
