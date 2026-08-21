import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bands, bandMembers, users } from "@/lib/db/schema";
import {
  UserEditForm,
  UserPasswordForm,
  MemberRoleSelect,
  MembershipRemoveButton,
  AssignToBandControl,
  ToggleUserButton,
} from "@/components/superadmin-forms";

export const metadata = { title: "Nutzer" };

export default async function VerwaltungNutzerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const userId = Number(id);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) notFound();

  const [memberships, alleBands] = await Promise.all([
    db
      .select({ bandId: bandMembers.bandId, bandName: bands.name, role: bandMembers.role, active: bandMembers.active })
      .from(bandMembers)
      .innerJoin(bands, eq(bandMembers.bandId, bands.id))
      .where(eq(bandMembers.userId, userId))
      .orderBy(asc(bands.name)),
    db.select({ id: bands.id, name: bands.name }).from(bands).where(eq(bands.active, true)).orderBy(asc(bands.name)),
  ]);

  const memberBandIds = new Set(memberships.map((m) => m.bandId));
  const zuweisbar = alleBands.filter((b) => !memberBandIds.has(b.id));

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/verwaltung/nutzer" className="text-sm text-mute hover:text-ink">
          ← Alle Nutzer
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="headline text-3xl">
            {user.name}
            {user.isSuperAdmin && (
              <span className="badge ml-2 border-accent/40 bg-accent/10 text-accent-hi">Super-Admin</span>
            )}
            {!user.active && <span className="badge ml-2 border-line text-faint">gesperrt</span>}
          </h1>
          <ToggleUserButton userId={user.id} active={user.active} isSelf={user.id === admin.id} />
        </div>
      </div>

      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Stammdaten</h2>
        <UserEditForm userId={user.id} name={user.name} email={user.email} />
      </section>

      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Passwort zurücksetzen</h2>
        <UserPasswordForm userId={user.id} />
      </section>

      {user.isSuperAdmin ? (
        <p className="text-sm text-faint">Super-Admin-Konten sind keine Bandmitglieder.</p>
      ) : (
        <section className="space-y-4">
          <h2 className="headline text-lg">Bandzugehörigkeiten</h2>
          {memberships.length === 0 ? (
            <p className="text-sm text-faint">In keiner Band.</p>
          ) : (
            memberships.map((m) => (
              <div key={m.bandId} className={`card flex flex-wrap items-center gap-3 p-4 ${m.active ? "" : "opacity-50"}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <Link href={`/verwaltung/bands/${m.bandId}`} className="hover:text-accent-hi hover:underline">
                      {m.bandName}
                    </Link>
                    {!m.active && <span className="badge ml-2 border-line text-faint">ausgetreten</span>}
                  </p>
                </div>
                {m.active && <MemberRoleSelect bandId={m.bandId} userId={user.id} role={m.role} />}
                <MembershipRemoveButton bandId={m.bandId} userId={user.id} active={m.active} role={m.role} />
              </div>
            ))
          )}
          <div className="card p-5">
            <h3 className="label mb-3">Zu einer Band hinzufügen</h3>
            <AssignToBandControl userId={user.id} bands={zuweisbar} />
          </div>
        </section>
      )}
    </div>
  );
}
