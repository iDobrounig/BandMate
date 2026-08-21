import { requireBandAdmin } from "@/lib/auth";
import { SmtpTestForm } from "@/components/smtp-test";

export const metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  const { user } = await requireBandAdmin();

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Einstellungen</h1>
      <p className="mt-1 text-sm text-mute">Band-Einstellungen und Wartung.</p>

      <section className="card mt-8 p-5">
        <h2 className="headline mb-4 text-lg">SMTP-Verbindung testen</h2>
        <SmtpTestForm adminEmail={user.email} />
      </section>
    </div>
  );
}
