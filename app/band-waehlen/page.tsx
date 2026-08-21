import { redirect } from "next/navigation";
import { requireUser, fetchMemberships } from "@/lib/auth";
import { setActiveBand } from "@/lib/actions/bands";
import { IconRepeat } from "@/components/icons";

export const metadata = { title: "Band wählen" };

export default async function BandWaehlenPage() {
  const user = await requireUser();
  const memberships = await fetchMemberships(user.id);

  // Keine Band → dorthin, wo requireBandContext ohnehin hinleiten würde.
  if (memberships.length === 0) {
    redirect(user.isSuperAdmin ? "/verwaltung" : "/keine-band");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mono-display text-xs uppercase tracking-[0.4em] text-accent">
            ● rec
          </p>
          <h1 className="headline mt-2 text-3xl">Welche Band?</h1>
          <p className="mt-2 text-sm text-mute">
            Du bist in mehreren Bands. Wähle, mit welcher du weitermachst.
          </p>
        </div>
        <div className="card p-3">
          <ul className="flex flex-col gap-1">
            {memberships.map((m) => (
              <li key={m.bandId}>
                <form
                  action={async () => {
                    "use server";
                    await setActiveBand(m.bandId);
                  }}
                >
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-raise"
                  >
                    <span>
                      <span className="font-semibold">{m.bandName}</span>
                      {m.role === "band_admin" && (
                        <span className="ml-2 text-xs text-faint">Band-Admin</span>
                      )}
                    </span>
                    <IconRepeat className="size-4 text-faint" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
