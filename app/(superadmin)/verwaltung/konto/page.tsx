import { requireSuperAdmin } from "@/lib/auth";
import { AccountForm, OwnPasswordForm } from "@/components/superadmin-forms";

export const metadata = { title: "Mein Konto" };

export default async function VerwaltungKontoPage() {
  const admin = await requireSuperAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="headline text-3xl">Mein Konto</h1>
        <p className="mt-1 text-sm text-mute">Super-Admin — Name, E-Mail und Passwort.</p>
      </div>

      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Stammdaten</h2>
        <AccountForm name={admin.name} email={admin.email} />
      </section>

      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Passwort ändern</h2>
        <OwnPasswordForm />
      </section>
    </div>
  );
}
