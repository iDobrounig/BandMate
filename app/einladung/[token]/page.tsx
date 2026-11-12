import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { fetchValidInvite } from "@/lib/invites";
import { JoinBandButton, NewAccountForm } from "@/components/invite-forms";
import { LogoutForm } from "@/components/logout-form";

export const metadata = { title: "Einladung" };

export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await fetchValidInvite(token);
  const user = await currentUser();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mono-display text-xs uppercase tracking-[0.4em] text-accent">● rec</p>
          <h1 className="headline mt-2 text-3xl">Einladung</h1>
        </div>

        {!valid ? (
          <div className="card p-6 text-center text-mute">
            <p>Dieser Einladungslink ist ungültig oder abgelaufen.</p>
            <p className="mt-3 text-sm">
              <Link href="/login" className="text-accent-hi underline">
                Zur Anmeldung
              </Link>
            </p>
          </div>
        ) : (
          <div className="card p-6">
            <p className="mb-5 text-center text-sm text-mute">
              Du wurdest zu <span className="font-semibold text-ink">{valid.bandName}</span>{" "}
              eingeladen.
            </p>

            {user && user.isSuperAdmin ? (
              <p className="text-center text-sm text-mute">
                Super-Admin-Konten können keiner Band beitreten.
              </p>
            ) : user && user.email.toLowerCase() !== valid.invite.email ? (
              // Die Einladung gilt nur für die eingeladene Adresse.
              <div className="space-y-3 text-center">
                <p className="text-sm text-mute">
                  Diese Einladung gilt für {valid.invite.email}, du bist aber als{" "}
                  {user.email} angemeldet. Melde dich ab und öffne den Link erneut.
                </p>
                <LogoutForm className="btn w-full">Abmelden</LogoutForm>
              </div>
            ) : user ? (
              // Eingeloggt → ein Klick tritt bei.
              <JoinBandButton token={token} />
            ) : valid.emailKnown ? (
              // Konto existiert, aber nicht angemeldet → erst anmelden.
              <div className="space-y-3 text-center">
                <p className="text-sm text-mute">
                  Für {valid.invite.email} gibt es bereits ein Konto. Melde dich an, um der
                  Band beizutreten.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/einladung/${token}`)}`}
                  className="btn btn-primary w-full"
                >
                  Anmelden
                </Link>
              </div>
            ) : (
              // Neuer Nutzer → Konto anlegen.
              <NewAccountForm token={token} email={valid.invite.email} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
