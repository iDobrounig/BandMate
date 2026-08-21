import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bands } from "@/lib/db/schema";
import { CreateBandForm, ToggleBandButton } from "@/components/superadmin-forms";

export const metadata = { title: "Bands" };

export default async function VerwaltungBandsPage() {
  const rows = await db
    .select({
      id: bands.id,
      name: bands.name,
      active: bands.active,
      memberCount: sql<number>`(select count(*) from band_members m where m.band_id = bands.id and m.active = 1)`,
    })
    .from(bands)
    .orderBy(asc(bands.name));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="headline text-3xl">Bands</h1>
        <p className="mt-1 text-sm text-mute">
          Bands anlegen und verwalten. Bandinhalte (Songs, Setlisten, Termine) sind hier
          bewusst nicht sichtbar.
        </p>
      </div>

      <section className="card max-w-2xl p-5">
        <h2 className="headline mb-4 text-lg">Neue Band</h2>
        <CreateBandForm />
      </section>

      <section className="space-y-3">
        <h2 className="headline text-lg">Alle Bands ({rows.length})</h2>
        {rows.map((band) => (
          <div key={band.id} className={`card flex flex-wrap items-center gap-3 p-4 ${band.active ? "" : "opacity-50"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {band.name}
                {!band.active && (
                  <span className="badge ml-2 border-line text-faint">deaktiviert</span>
                )}
              </p>
              <p className="text-sm text-mute">
                {band.memberCount} {band.memberCount === 1 ? "Mitglied" : "Mitglieder"}
              </p>
            </div>
            <ToggleBandButton bandId={band.id} active={band.active} />
          </div>
        ))}
      </section>
    </div>
  );
}
