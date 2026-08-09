import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { fetchSettings } from "@/lib/notifications";
import { NewMemberForm, MemberRow } from "@/components/member-admin";
import { SmtpTestForm } from "@/components/smtp-test";

export const metadata = { title: "Mitglieder" };

export default async function MitgliederPage() {
  const user = await requireUser();

  if (user.role !== "admin") {
    const members = await db
      .select({ id: users.id, name: users.name, instrument: users.instrument, email: users.email })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name));

    return (
      <div className="max-w-3xl">
        <h1 className="headline text-3xl">Mitglieder</h1>
        <p className="mt-1 text-sm text-mute">Wer spielt was — und wie erreicht man wen.</p>
        <section className="mt-8 space-y-3">
          {members.map((member) => (
            <div key={member.id} className="card p-4">
              <p className="font-semibold">{member.name}</p>
              <p className="truncate text-sm text-mute">
                {member.instrument && `${member.instrument} · `}
                <a className="text-accent-hi hover:underline" href={`mailto:${member.email}`}>
                  {member.email}
                </a>
              </p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const admin = user;
  const members = await db.select().from(users).orderBy(asc(users.name));
  // Je Mitglied die aufgelösten Einstellungen (Standardwerte eingesetzt)
  const settings = await Promise.all(members.map((m) => fetchSettings(m.id)));

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
        {members.map((member, i) => (
          <MemberRow
            key={member.id}
            member={member}
            isSelf={member.id === admin.id}
            settings={settings[i]}
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
