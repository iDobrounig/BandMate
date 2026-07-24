import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  notificationSettings,
  notificationRuns,
  type NotificationKind,
  type NotificationMode,
} from "@/lib/db/schema";
import { NOTIFY_KINDS, NOTIFY_KIND_ORDER } from "@/lib/constants";

/**
 * Benachrichtigungs-Einstellungen.
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * In der Tabelle stehen nur ABWEICHUNGEN vom Standard. Fehlt eine Zeile, gilt
 * `NOTIFY_KINDS[kind].default`. Das hält die Tabelle klein und sorgt dafür,
 * dass ein später ergänzter Ereignistyp ohne Nachmigration einen sinnvollen
 * Wert hat.
 */

export type SettingsMap = Record<NotificationKind, NotificationMode>;

function mitStandard(
  abweichungen: { kind: NotificationKind; mode: NotificationMode }[]
): SettingsMap {
  const map = {} as SettingsMap;
  for (const kind of NOTIFY_KIND_ORDER) map[kind] = NOTIFY_KINDS[kind].default;
  for (const a of abweichungen) map[a.kind] = a.mode;
  return map;
}

/** Einstellungen einer Person, Standardwerte bereits eingesetzt. */
export async function fetchSettings(userId: number): Promise<SettingsMap> {
  const zeilen = await db
    .select({ kind: notificationSettings.kind, mode: notificationSettings.mode })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.userId, userId),
        eq(notificationSettings.channel, "mail")
      )
    );
  return mitStandard(zeilen);
}

/**
 * Speichert die Einstellungen einer Person. Werte, die dem Standard
 * entsprechen, werden nicht gespeichert, sondern gelöscht — sonst wüchse die
 * Tabelle mit jedem Speichern und eine spätere Änderung des Standards ginge an
 * allen vorbei, die ihn nie bewusst gewählt haben.
 */
export async function saveSettings(userId: number, gewuenscht: Partial<SettingsMap>) {
  for (const kind of NOTIFY_KIND_ORDER) {
    const mode = gewuenscht[kind];
    if (!mode || !NOTIFY_KINDS[kind].modes.includes(mode)) continue;

    const wo = and(
      eq(notificationSettings.userId, userId),
      eq(notificationSettings.kind, kind),
      eq(notificationSettings.channel, "mail")
    );

    if (mode === NOTIFY_KINDS[kind].default) {
      await db.delete(notificationSettings).where(wo);
    } else {
      await db
        .insert(notificationSettings)
        .values({ userId, kind, channel: "mail", mode })
        .onConflictDoUpdate({
          target: [
            notificationSettings.userId,
            notificationSettings.kind,
            notificationSettings.channel,
          ],
          set: { mode },
        });
    }
  }
}

/** Liest eine Einstellungs-Matrix aus einem Formular (Felder `notify_<kind>`). */
export function readSettingsForm(formData: FormData): Partial<SettingsMap> {
  const out: Partial<SettingsMap> = {};
  for (const kind of NOTIFY_KIND_ORDER) {
    const wert = String(formData.get(`notify_${kind}`) ?? "");
    if (NOTIFY_KINDS[kind].modes.includes(wert as NotificationMode)) {
      out[kind] = wert as NotificationMode;
    }
  }
  return out;
}

export type Recipient = { id: number; name: string; email: string };

/**
 * Wer bekommt bei diesem Ereignis SOFORT eine Mail?
 *
 * Aktive Mitglieder, deren Einstellung für diesen Typ „sofort" ist — entweder
 * ausdrücklich oder weil sie den Standard nie geändert haben. Wer „gesammelt"
 * gewählt hat, findet es später im Wochen-Digest; „nie" bekommt nichts.
 */
export async function fetchRecipients(
  kind: NotificationKind,
  opts: { excludeUserId?: number } = {}
): Promise<Recipient[]> {
  const aktive = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.active, true));

  const kandidaten = aktive.filter((u) => u.id !== opts.excludeUserId);
  if (kandidaten.length === 0) return [];

  // Nur Abweichungen stehen in der Tabelle — wer hier nicht auftaucht, hat den
  // Standard, und der ist für alle Typen "sofort".
  const abweichungen = await db
    .select({ userId: notificationSettings.userId, mode: notificationSettings.mode })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.kind, kind),
        eq(notificationSettings.channel, "mail"),
        inArray(
          notificationSettings.userId,
          kandidaten.map((k) => k.id)
        )
      )
    );

  const abweichend = new Map(abweichungen.map((a) => [a.userId, a.mode]));
  const standard = NOTIFY_KINDS[kind].default;
  return kandidaten.filter((u) => (abweichend.get(u.id) ?? standard) === "sofort");
}

/**
 * Zustand des letzten Erinnerungs-Laufs — für die Statuszeile auf dem
 * Admin-Dashboard (Entwurf E3). Sie ist die Gegenmaßnahme zum Cron-Dispatcher:
 * Läuft der nicht (vergessen einzurichten, Server aus, Script kaputt), bleibt
 * hier der letzte Lauf alt stehen, und die Zeile wird rot.
 */
export type ReminderStatus = {
  lastRunAt: Date | null;
  sentCount: number;
  errorCount: number;
  /** true, wenn seit >2 Tagen kein Lauf verzeichnet ist oder der letzte Fehler hatte. */
  stale: boolean;
};

const ZWEI_TAGE_MS = 2 * 24 * 60 * 60 * 1000;

export async function fetchReminderStatus(): Promise<ReminderStatus> {
  const [letzter] = await db
    .select()
    .from(notificationRuns)
    .where(eq(notificationRuns.art, "reminders"))
    .orderBy(desc(notificationRuns.startedAt))
    .limit(1);

  if (!letzter) {
    return { lastRunAt: null, sentCount: 0, errorCount: 0, stale: true };
  }
  const alt = Date.now() - letzter.startedAt.getTime() > ZWEI_TAGE_MS;
  return {
    lastRunAt: letzter.startedAt,
    sentCount: letzter.sentCount,
    errorCount: letzter.errorCount,
    stale: alt || letzter.errorCount > 0,
  };
}
