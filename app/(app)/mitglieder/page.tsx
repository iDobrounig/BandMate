import Link from "next/link";
import { requireBandContext } from "@/lib/auth";
import {
  fetchAttendanceStats,
  fetchBandMembers,
  fetchBandMembersAdmin,
  type AttendanceStats,
} from "@/lib/queries";
import { ATTENDANCE_STATUS } from "@/lib/constants";

export const metadata = { title: "Mitglieder" };

function AttendanceStatsCard({ stats }: { stats: AttendanceStats[] }) {
  return (
    <section className="card p-5 lg:sticky lg:top-8">
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
  const { bandId, role } = await requireBandContext();
  const isAdmin = role === "band_admin";
  const stats = await fetchAttendanceStats(bandId);

  const members = isAdmin
    ? await fetchBandMembersAdmin(bandId)
    : await fetchBandMembers(bandId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-3xl">Mitglieder</h1>
          <p className="mt-1 text-sm text-mute">
            {isAdmin
              ? "Mitglieder anlegen, Rollen verwalten und Passwörter setzen."
              : "Wer spielt was — und wie erreicht man wen."}
          </p>
        </div>
        {isAdmin && (
          <Link href="/mitglieder/neu" className="btn btn-primary">
            + Mitglied anlegen
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-3">
          {members.map((member) => {
            const isMemberAdmin = "role" in member && member.role === "band_admin";
            const inactive = "active" in member && !member.active;
            return (
              <div key={member.id} className={`card p-4 ${inactive ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {member.name}
                      {isMemberAdmin && (
                        <span className="badge ml-2 border-accent/40 bg-accent/10 text-accent-hi">
                          Band-Admin
                        </span>
                      )}
                      {inactive && (
                        <span className="badge ml-2 border-line text-faint">ausgetreten</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-mute">
                      {member.instrument && `${member.instrument} · `}
                      <a
                        className="text-accent-hi hover:underline"
                        href={`mailto:${member.email}`}
                      >
                        {member.email}
                      </a>
                    </p>
                  </div>
                  {isAdmin && (
                    <Link
                      href={`/mitglieder/${member.id}/bearbeiten`}
                      className="btn btn-sm w-full sm:w-auto"
                    >
                      Bearbeiten
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <div className="min-w-0">
          <AttendanceStatsCard stats={stats} />
        </div>
      </div>
    </div>
  );
}
