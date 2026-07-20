import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { NewMemberForm, MemberRow } from "@/components/member-admin";
import { SmtpTestForm } from "@/components/smtp-test";

export const metadata = { title: "Mitglieder" };

export default async function MitgliederPage() {
  const admin = await requireAdmin();
  const members = await db.select().from(users).orderBy(asc(users.name));

  return (
    <div className="max-w-3xl">
      <h1 className="headline text-3xl">Mitglieder</h1>
      <p className="mt-1 text-sm text-mute">
        Neue Bandmitglieder anlegen, Passwörter setzen, Rollen verwalten.
      </p>

      <section className="card mt-8 p-5">
        <h2 className="headline mb-4 text-lg">Neues Mitglied</h2>
        <NewMemberForm />
      </section>

      <section className="mt-8 space-y-3">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isSelf={member.id === admin.id}
          />
        ))}
      </section>

      <section className="card mt-8 p-5">
        <h2 className="headline mb-4 text-lg">SMTP-Verbindung testen</h2>
        <SmtpTestForm adminEmail={admin.email} />
      </section>
    </div>
  );
}
