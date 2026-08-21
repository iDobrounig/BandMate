import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchSettings } from "@/lib/notifications";
import { fetchUserContributions } from "@/lib/queries";
import { formatFee } from "@/lib/format";
import { ProfileForm, PasswordForm } from "@/components/profile-forms";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await requireUser();
  const [settings, contributions] = await Promise.all([
    fetchSettings(user.id),
    fetchUserContributions(user.id),
  ]);
  const contributionTotal = contributions.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div>
      <h1 className="headline text-3xl">Mein Profil</h1>
      <p className="mt-1 text-sm text-mute">
        Angemeldet als {user.email}
        {user.role === "admin" ? " · Admin" : ""}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="headline mb-4 text-lg">Stammdaten</h2>
            <ProfileForm user={user} settings={settings} />
          </section>
          <section className="card p-5">
            <h2 className="headline mb-4 text-lg">Passwort</h2>
            <PasswordForm />
          </section>
        </div>

        <div className="min-w-0">
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
        </div>
      </div>
    </div>
  );
}
