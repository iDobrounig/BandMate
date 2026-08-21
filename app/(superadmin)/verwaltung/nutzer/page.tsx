import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, bands, bandMembers } from "@/lib/db/schema";
import { ToggleUserButton, CreateUserGlobalForm } from "@/components/superadmin-forms";

export const metadata = { title: "Nutzer" };

export default async function VerwaltungNutzerPage() {
  const admin = await requireSuperAdmin();

  const [alleUsers, mitgliedschaften, alleBands] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        active: users.active,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .orderBy(asc(users.name)),
    db
      .select({
        userId: bandMembers.userId,
        bandName: bands.name,
        role: bandMembers.role,
        active: bandMembers.active,
      })
      .from(bandMembers)
      .innerJoin(bands, eq(bandMembers.bandId, bands.id)),
    db.select({ id: bands.id, name: bands.name }).from(bands).where(eq(bands.active, true)).orderBy(asc(bands.name)),
  ]);

  const byUser = new Map<number, { bandName: string; role: string; active: boolean }[]>();
  for (const m of mitgliedschaften) {
    const list = byUser.get(m.userId) ?? [];
    list.push({ bandName: m.bandName, role: m.role, active: m.active });
    byUser.set(m.userId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="headline text-3xl">Nutzer</h1>
        <p className="mt-1 text-sm text-mute">
          Alle Konten und ihre Bandzugehörigkeiten. Sperren wirkt global (über alle Bands).
        </p>
      </div>

      <section className="card max-w-2xl p-5">
        <h2 className="headline mb-4 text-lg">Neuer Nutzer</h2>
        <CreateUserGlobalForm bands={alleBands} />
      </section>

      <section className="space-y-3">
        {alleUsers.map((u) => {
          const memberships = byUser.get(u.id) ?? [];
          return (
            <div key={u.id} className={`card flex flex-wrap items-center gap-3 p-4 ${u.active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <Link href={`/verwaltung/nutzer/${u.id}`} className="hover:text-accent-hi hover:underline">
                    {u.name}
                  </Link>
                  {u.isSuperAdmin && (
                    <span className="badge ml-2 border-accent/40 bg-accent/10 text-accent-hi">Super-Admin</span>
                  )}
                  {!u.active && <span className="badge ml-2 border-line text-faint">gesperrt</span>}
                </p>
                <p className="truncate text-sm text-mute">{u.email}</p>
                <p className="mt-1 text-xs text-faint">
                  {memberships.length === 0
                    ? u.isSuperAdmin
                      ? "— keine Band (reine Verwaltung)"
                      : "— in keiner Band"
                    : memberships
                        .map(
                          (m) =>
                            `${m.bandName}${m.role === "band_admin" ? " (Admin)" : ""}${m.active ? "" : " – ausgetreten"}`
                        )
                        .join(" · ")}
                </p>
              </div>
              <ToggleUserButton userId={u.id} active={u.active} isSelf={u.id === admin.id} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
