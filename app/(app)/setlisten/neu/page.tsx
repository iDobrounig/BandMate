import { requireUser } from "@/lib/auth";
import { SetlistForm } from "@/components/setlist-forms";

export const metadata = { title: "Neue Setliste" };

export default async function NeueSetlistePage() {
  await requireUser();

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Neue Setliste</h1>
      <p className="mt-1 text-sm text-mute">
        Nur der Name ist Pflicht — die Songs stellst du danach auf der
        Setlisten-Seite zusammen.
      </p>
      <div className="card mt-8 p-6">
        <SetlistForm />
      </div>
    </div>
  );
}
