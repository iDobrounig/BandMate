import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchSettings } from "@/lib/notifications";
import { fetchUserContributions, fetchAttendanceStats } from "@/lib/queries";
import { formatFee, formatDate } from "@/lib/format";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { ProfileForm, PasswordForm } from "@/components/profile-forms";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await requireUser();
  const [settings, contributions, attendanceStats] = await Promise.all([
    fetchSettings(user.id),
    fetchUserContributions(user.id),
    fetchAttendanceStats(),
  ]);
  const contributionTotal = contributions.reduce((acc, c) => acc + c.amount, 0);
  const ownAttendance = attendanceStats.find((s) => s.userId === user.id);

  return (
    <div>
      <h1 className="headline text-3xl">Mein Profil</h1>
      <p className="mt-1 text-sm text-mute">
        Angemeldet als {user.email}
        {user.role === "admin" ? " · Admin" : ""}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <ProfileForm user={user} settings={settings} />
          <section className="card p-5">
            <h2 className="headline mb-4 text-lg">Passwort</h2>
            <PasswordForm />
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Meine Beteiligungen</h2>
            {contributions.length === 0 ? (
              <p className="text-sm text-faint">Noch keine Beteiligungen eingetragen.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {contributions.map((c) => (
                    <li key={c.equipmentId} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/equipment/${c.equipmentId}`}
                          className="min-w-0 truncate font-medium text-accent-hi hover:underline"
                        >
                          {c.equipmentName}
                        </Link>
                        <span className="mono-display shrink-0">{formatFee(c.amount)}</span>
                      </div>
                      {c.note && <p className="text-xs text-faint">{c.note}</p>}
                    </li>
                  ))}
                </ul>
                <div className="mono-display mt-4 border-t border-line-soft pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-faint">SUMME</span>
                    <span>{formatFee(contributionTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Über dich</h2>
            <div className="mono-display space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-faint">MITGLIED SEIT</span>
                <span>{formatDate(user.createdAt)}</span>
              </div>
              {ownAttendance && (
                <div className="flex items-center justify-between">
                  <span className="text-faint">ANWESENHEIT PROBEN</span>
                  <span>
                    {ownAttendance.percentage == null ? "–" : `${ownAttendance.percentage}%`}
                    {ownAttendance.yes + ownAttendance.no + ownAttendance.maybe > 0 && (
                      <span className="ml-1 text-faint">
                        ({ownAttendance.yes}
                        {ATTENDANCE_STATUS.yes.symbol} {ownAttendance.no}
                        {ATTENDANCE_STATUS.no.symbol} {ownAttendance.maybe}
                        {ATTENDANCE_STATUS.maybe.symbol})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
