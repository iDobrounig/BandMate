import { asc } from "drizzle-orm";
import { requireBandContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { fetchSettings } from "@/lib/notifications";
import { fetchAttendanceStats, fetchBandMembers, type AttendanceStats } from "@/lib/queries";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { NewMemberForm, MemberRow } from "@/components/member-admin";
import { SmtpTestForm } from "@/components/smtp-test";

export const metadata = { title: "Mitglieder" };

function AttendanceStatsCard({ stats }: { stats: AttendanceStats[] }) {
  return (
    <section className="card mt-8 p-5">
      <h2 className="headline text-lg">Anwesenheits-Statistik</h2>
      <p className="mt-1 text-sm text-mute">Nur vergangene Proben, ohne Gigs.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft text-left text-xs text-faint uppercase">
              <th className="py-2 pr-3 font-semibold">Mitglied</th>
              <th className="px-3 py-2 text-right font-semibold">{ATTENDANCE_STATUS.yes.symbol}</th>
              <th className="px-3 py-2 text-right font-semibold">{ATTENDANCE_STATUS.no.symbol}</th>
              <th className="px-3 py-2 text-right font-semibold">{ATTENDANCE_STATUS.maybe.symbol}</th>
              <th className="py-2 pl-3 text-right font-semibold">Quote</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.userId} className="border-b border-line-soft last:border-0">
                <td className="py-2 pr-3">{s.name}</td>
                <td className={`mono-display px-3 py-2 text-right ${ATTENDANCE_STATUS.yes.color}`}>
                  {s.yes}
                </td>
                <td className={`mono-display px-3 py-2 text-right ${ATTENDANCE_STATUS.no.color}`}>
                  {s.no}
                </td>
                <td className={`mono-display px-3 py-2 text-right ${ATTENDANCE_STATUS.maybe.color}`}>
                  {s.maybe}
                </td>
                <td className="mono-display py-2 pl-3 text-right font-semibold">
                  {s.percentage == null ? "–" : `${s.percentage}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function MitgliederPage() {
  const { user, bandId, role } = await requireBandContext();
  const stats = await fetchAttendanceStats(bandId);

  if (role !== "band_admin") {
    const members = await fetchBandMembers(bandId);

    return (
      <div>
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
        <AttendanceStatsCard stats={stats} />
      </div>
    );
  }

  const admin = user;
  const members = await db.select().from(users).orderBy(asc(users.name));
  // Je Mitglied die aufgelösten Einstellungen (Standardwerte eingesetzt)
  const settings = await Promise.all(members.map((m) => fetchSettings(m.id)));

  return (
    <div>
      <h1 className="headline text-3xl">Mitglieder</h1>
      <p className="mt-1 text-sm text-mute">
        Neue Bandmitglieder anlegen, Passwörter setzen, Rollen verwalten.
      </p>

      <section className="card mt-8 max-w-2xl p-5">
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

      <AttendanceStatsCard stats={stats} />

      <section className="card mt-8 max-w-2xl p-5">
        <h2 className="headline mb-4 text-lg">SMTP-Verbindung testen</h2>
        <SmtpTestForm adminEmail={admin.email} />
      </section>
    </div>
  );
}
