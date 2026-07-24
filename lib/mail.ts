import nodemailer from "nodemailer";
import { fetchRecipients } from "@/lib/notifications";
import type { NotificationKind } from "@/lib/db/schema";
import { buildEmailHtml, buildEmailText } from "@/lib/email-template";

const smtpConfigured = Boolean(process.env.SMTP_HOST);

function transporter(extra?: nodemailer.TransportOptions) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Knappe Timeouts: ohne diese hängt ein zickender Server (kein Greeting)
    // bis zu 2 Minuten am Default. So scheitert ein Versuch nach Sekunden und
    // der Wiederholungsversuch (frische Verbindung) kann greifen.
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
    ...extra,
  } as nodemailer.TransportOptions);
}

/**
 * Ein wiederverwendbarer Versender für viele Einzelmails (Erinnerungen,
 * Digest). Hält EINE gepoolte Verbindung offen, statt sie pro Empfänger neu
 * aufzubauen — genau das führte im Test zu „Greeting never received", wenn
 * schnell hintereinander frische Verbindungen geöffnet wurden.
 *
 * `close()` am Ende nicht vergessen, sonst hängt der Prozess an der offenen
 * Verbindung. Wirft beim Anlegen, wenn kein SMTP konfiguriert ist.
 */
export function createBatchMailer() {
  if (!smtpConfigured) throw new Error("SMTP nicht konfiguriert");
  const t = transporter({ pool: true, maxConnections: 1 } as nodemailer.TransportOptions);
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  return {
    async send(toEmail: string, subject: string, content: MailContent) {
      await t.sendMail({
        from,
        to: toEmail,
        subject: `[BandMate] ${subject}`,
        text: buildEmailText(content),
        html: buildEmailHtml({ ...content, preheader: content.intro }),
      });
    },
    close() {
      t.close();
    },
  };
}

export type BatchMailer = ReturnType<typeof createBatchMailer>;

/**
 * Benachrichtigt alle aktiven Mitglieder, die für DIESEN Ereignistyp „sofort"
 * eingestellt haben — außer dem Auslöser. Wer „gesammelt" gewählt hat, findet
 * es später im Wochen-Digest; „nie" bekommt nichts.
 *
 * Fire-and-forget: Fehler werden nur geloggt. Für die zeitgesteuerten Mails
 * (Erinnerungen, Digest) gilt das NICHT — die warten auf das Ergebnis und
 * schreiben es ins Versand-Log, siehe docs/specs/2026-07-23-benachrichtigungen-design.md.
 */
export function notifyBand(opts: {
  kind: NotificationKind;
  subject: string;
  heading: string;
  intro: string;
  highlight?: string;
  details?: string[];
  quote?: string;
  cta: { label: string; url: string };
  excludeUserId?: number;
}) {
  if (!smtpConfigured) {
    console.log(`[mail deaktiviert] ${opts.subject}`);
    return;
  }
  void (async () => {
    try {
      const recipients = await fetchRecipients(opts.kind, {
        excludeUserId: opts.excludeUserId,
      });
      if (recipients.length === 0) {
        console.log(
          `[mail] keine Empfänger für "${opts.subject}" (${opts.kind}) — Auslöser ausgeschlossen oder niemand auf "sofort"`
        );
        return;
      }
      const mail = {
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        bcc: recipients.map((r) => r.email),
        subject: `[BandMate] ${opts.subject}`,
        text: buildEmailText(opts),
        html: buildEmailHtml({ ...opts, preheader: opts.intro }),
      };
      // Ein Versuch, bei transientem Zicken (z.B. „Greeting never received")
      // ein zweiter nach kurzer Pause — wie im Erinnerungslauf. Danach gibt
      // notifyBand auf: fire-and-forget, der Fehler wird nur geloggt.
      const t = transporter();
      try {
        await t.sendMail(mail);
      } catch {
        await new Promise((r) => setTimeout(r, 750));
        await t.sendMail(mail);
      }
    } catch (err) {
      console.error("E-Mail-Versand fehlgeschlagen:", err);
    }
  })();
}

export type MailContent = {
  heading: string;
  intro: string;
  highlight?: string;
  details?: string[];
  quote?: string;
  cta?: { label: string; url: string };
};

export function isSmtpConfigured(): boolean {
  return smtpConfigured;
}

/**
 * Prüft die SMTP-Verbindung und verschickt eine echte Test-Mail.
 * Für die Admin-Diagnose auf /mitglieder — wirft nie, liefert stattdessen
 * ein Ergebnis-Objekt mit deutscher Klartext-Fehlermeldung.
 */
export async function sendTestMail(
  toEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!smtpConfigured) {
    return {
      ok: false,
      error:
        "SMTP_HOST ist nicht gesetzt. Bitte .env prüfen und die App danach neu starten (pm2 restart --update-env).",
    };
  }
  try {
    const t = transporter();
    await t.verify();
    const content = {
      heading: "Test-E-Mail",
      intro:
        "Diese Test-Mail bestätigt, dass der SMTP-Versand von BandMate funktioniert.",
    };
    await t.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: toEmail,
      subject: "[BandMate] Test-E-Mail",
      text: buildEmailText(content),
      html: buildEmailHtml({ ...content, preheader: content.intro }),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `SMTP-Fehler: ${message}` };
  }
}

/**
 * Verschickt den Passwort-Reset-Link an eine einzelne Adresse. Wirft nie —
 * Fehler werden geloggt, der Aufrufer (requestPasswordReset) ignoriert das
 * Ergebnis bewusst, um kein Timing-/Fehler-Seitenkanal-Leck über die
 * Existenz eines Accounts zu erzeugen.
 */
export async function sendPasswordResetMail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  if (!smtpConfigured) {
    console.log(`[mail deaktiviert] Passwort-Reset für ${toEmail}`);
    return;
  }
  try {
    const content = {
      heading: "Passwort zurücksetzen",
      intro:
        "Du hast ein neues Passwort für dein BandMate-Konto angefordert. Der Link ist eine Stunde gültig.",
      cta: { label: "Neues Passwort vergeben", url: resetUrl },
    };
    await transporter().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: toEmail,
      subject: "[BandMate] Passwort zurücksetzen",
      text: buildEmailText(content),
      html: buildEmailHtml({ ...content, preheader: content.intro }),
    });
  } catch (err) {
    console.error("Passwort-Reset-Mail fehlgeschlagen:", err);
  }
}
