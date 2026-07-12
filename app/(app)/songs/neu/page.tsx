import { requireUser } from "@/lib/auth";
import { SongForm } from "@/components/song-form";

export const metadata = { title: "Song vorschlagen" };

export default async function NeuerSongPage() {
  await requireUser();

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Song vorschlagen</h1>
      <p className="mt-1 text-sm text-mute">
        Nur der Titel ist Pflicht — alles andere kann die Band später ergänzen.
      </p>
      <div className="card mt-8 p-6">
        <SongForm />
      </div>
    </div>
  );
}
