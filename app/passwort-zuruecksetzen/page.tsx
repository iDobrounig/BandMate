import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/reset-forms";

export const metadata = { title: "Passwort zurücksetzen" };

export default async function PasswortZuruecksetzenPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/");
  const { token } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mono-display text-xs uppercase tracking-[0.4em] text-accent">
            ● rec
          </p>
          <h1 className="headline mt-2 text-5xl">BandMate</h1>
          <p className="mt-2 text-sm text-mute">
            Neues Passwort vergeben.
          </p>
        </div>
        <div className="card p-6">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </main>
  );
}
