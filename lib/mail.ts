import nodemailer from "nodemailer";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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
  text: string;
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
      if (recipients.length === 0) return;
      await transporter().sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        bcc: recipients.map((r) => r.email),
        subject: `[Bandraum] ${opts.subject}`,
        text: opts.text,
      });
    } catch (err) {
      console.error("E-Mail-Versand fehlgeschlagen:", err);
    }
  })();
}
