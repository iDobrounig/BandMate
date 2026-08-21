import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bands, bandMembers, users } from "@/lib/db/schema";
import {
  RenameBandForm,
  MemberRoleSelect,
  MembershipRemoveButton,
  AddMemberByEmailForm,
  ToggleBandButton,
} from "@/components/superadmin-forms";

export const metadata = { title: "Band" };

export default async function VerwaltungBandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const bandId = Number(id);

  const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
  if (!band) notFound();

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: bandMembers.role,
      active: bandMembers.active,
      globalActive: users.active,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(eq(bandMembers.bandId, bandId))
    .orderBy(asc(users.name));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/verwaltung" className="text-sm text-mute hover:text-ink">
          ← Alle Bands
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="headline text-3xl">
            {band.name}
            {!band.active && <span className="badge ml-2 border-line text-faint">deaktiviert</span>}
          </h1>
          <ToggleBandButton bandId={band.id} active={band.active} />
        </div>
      </div>

      <section className="card max-w-2xl p-5">
        <h2 className="headline mb-4 text-lg">Band umbenennen</h2>
        <RenameBandForm bandId={band.id} name={band.name} />
      </section>

      <section className="space-y-3">
        <h2 className="headline text-lg">Mitglieder ({members.filter((m) => m.active).length} aktiv)</h2>
        {members.length === 0 ? (
          <p className="text-sm text-faint">Noch keine Mitglieder.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className={`card flex flex-wrap items-center gap-3 p-4 ${m.active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <Link href={`/verwaltung/nutzer/${m.id}`} className="hover:text-accent-hi hover:underline">
                    {m.name}
                  </Link>
                  {!m.globalActive && <span className="badge ml-2 border-line text-faint">gesperrt</span>}
                  {!m.active && <span className="badge ml-2 border-line text-faint">ausgetreten</span>}
                </p>
                <p className="truncate text-sm text-mute">{m.email}</p>
              </div>
              {m.active && <MemberRoleSelect bandId={band.id} userId={m.id} role={m.role} />}
              <MembershipRemoveButton bandId={band.id} userId={m.id} active={m.active} role={m.role} />
            </div>
          ))
        )}
      </section>

      <section className="card max-w-2xl p-5">
        <h2 className="headline mb-1 text-lg">Mitglied aufnehmen</h2>
        <p className="mb-4 text-sm text-mute">
          Bekannte E-Mail → sofort Mitglied. Unbekannte E-Mail → Einladungslink (die Person
          setzt Name und Passwort selbst).
        </p>
        <AddMemberByEmailForm bandId={band.id} />
      </section>
    </div>
  );
}
