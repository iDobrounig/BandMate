import nodemailer from "nodemailer";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { buildEmailHtml, buildEmailText } from "@/lib/email-template";

const smtpConfigured = Boolean(process.env.SMTP_HOST);

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

/**
 * Benachrichtigt alle aktiven Mitglieder mit aktivierter E-Mail-Benachrichtigung,
 * außer dem Auslöser. Fire-and-forget: Fehler werden nur geloggt.
 */
export function notifyBand(opts: {
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
      const recipients = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            eq(users.active, true),
            eq(users.notifyByEmail, true),
            opts.excludeUserId !== undefined
              ? ne(users.id, opts.excludeUserId)
              : undefined
          )
        );
      if (recipients.length === 0) {
        console.log(
          `[mail] keine Empfänger für "${opts.subject}" — Auslöser ausgeschlossen oder niemand mit aktivierter Benachrichtigung`
        );
        return;
      }
      await transporter().sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        bcc: recipients.map((r) => r.email),
        subject: `[BandMate] ${opts.subject}`,
        text: buildEmailText(opts),
        html: buildEmailHtml({ ...opts, preheader: opts.intro }),
      });
    } catch (err) {
      console.error("E-Mail-Versand fehlgeschlagen:", err);
    }
  })();
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
