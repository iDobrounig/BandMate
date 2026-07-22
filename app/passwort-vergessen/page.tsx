import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { RequestResetForm } from "@/components/reset-forms";

export const metadata = { title: "Passwort vergessen" };

export default async function PasswortVergessenPage() {
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mono-display text-xs uppercase tracking-[0.4em] text-accent">
            ● rec
          </p>
          <h1 className="headline mt-2 text-5xl">BandMate</h1>
          <p className="mt-2 text-sm text-mute">
            Gib deine E-Mail-Adresse ein, wir schicken dir einen Link zum
            Zurücksetzen.
          </p>
        </div>
        <div className="card p-6">
          <RequestResetForm />
        </div>
        <p className="mt-4 text-center text-xs text-faint">
          <a href="/login" className="underline">
            Zurück zur Anmeldung
          </a>
        </p>
      </div>
    </main>
  );
}
