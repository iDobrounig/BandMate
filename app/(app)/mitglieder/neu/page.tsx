import Link from "next/link";
import { requireBandAdmin } from "@/lib/auth";
import { NewMemberForm } from "@/components/member-admin";
import { InviteForm } from "@/components/invite-forms";

export const metadata = { title: "Mitglied anlegen" };

export default async function NeuesMitgliedPage() {
  await requireBandAdmin();

  return (
    <div className="max-w-2xl">
      <Link href="/mitglieder" className="text-sm text-mute hover:text-ink">
        ← Zurück zu den Mitgliedern
      </Link>
      <h1 className="headline mt-2 text-3xl">Mitglied anlegen</h1>

      <section className="card mt-6 p-5">
        <h2 className="headline mb-1 text-lg">Direkt anlegen</h2>
        <p className="mb-4 text-sm text-mute">
          Konto samt Startpasswort selbst vergeben — praktisch, wenn du das
          Passwort persönlich weitergibst.
        </p>
        <NewMemberForm />
      </section>

      <section className="card mt-6 p-5">
        <h2 className="headline mb-1 text-lg">Per Einladungslink aufnehmen</h2>
        <p className="mb-4 text-sm text-mute">
          Für Leute, die schon ein BandMate-Konto haben (aus einer anderen Band) —
          oder wenn sie ihr Passwort selbst setzen sollen. Der Link ist 7 Tage
          gültig und einmal verwendbar.
        </p>
        <InviteForm />
      </section>
    </div>
  );
}
