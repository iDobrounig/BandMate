import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mono-display text-xs uppercase tracking-[0.4em] text-accent">
            ● rec
          </p>
          <h1 className="headline mt-2 text-5xl">Bandraum</h1>
          <p className="mt-2 text-sm text-mute">
            Songs, Noten &amp; Setlisten — intern.
          </p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-faint">
          Kein Zugang? Frag den Admin eurer Band.
        </p>
      </div>
    </main>
  );
}
