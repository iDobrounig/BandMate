import { requireUser } from "@/lib/auth";
import { ProfileForm, PasswordForm } from "@/components/profile-forms";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Mein Profil</h1>
      <p className="mt-1 text-sm text-mute">
        Angemeldet als {user.email}
        {user.role === "admin" ? " · Admin" : ""}
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="headline mb-4 text-lg">Stammdaten</h2>
          <ProfileForm user={user} />
        </section>
        <section className="card p-5">
          <h2 className="headline mb-4 text-lg">Passwort</h2>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
