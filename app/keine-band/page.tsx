import { redirect } from "next/navigation";
import { requireUser, fetchMemberships } from "@/lib/auth";
import { LogoutForm } from "@/components/logout-form";
import { IconLogout } from "@/components/icons";

export const metadata = { title: "Keine Band" };

export default async function KeineBandPage() {
  const user = await requireUser();
  const memberships = await fetchMemberships(user.id);
  // Doch wieder Mitglied (oder Super-Admin) → weiter, nicht hier hängen bleiben.
  if (memberships.length > 0) redirect("/band-waehlen");
  if (user.isSuperAdmin) redirect("/verwaltung");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="headline text-3xl">Noch keine Band</h1>
        <p className="mt-3 text-sm text-mute">
          Dein Konto gehört derzeit zu keiner aktiven Band. Sobald dich ein
          Band-Admin aufnimmt oder einlädt, erscheint sie hier automatisch.
        </p>
        <div className="mt-6 flex justify-center">
          <LogoutForm
            ariaLabel="Abmelden"
            title="Abmelden"
            className="btn inline-flex items-center gap-2"
          >
            <IconLogout className="size-4" />
            Abmelden
          </LogoutForm>
        </div>
      </div>
    </main>
  );
}
