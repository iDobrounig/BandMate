import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { SetlistForm, DeleteSetlistButton } from "@/components/setlist-forms";
import { SetlistEditor, type EditorItem } from "@/components/setlist-editor";

export default async function SetlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const setlistId = Number(id);

  const setlist = await db.query.setlists.findFirst({
    where: eq(setlists.id, setlistId),
  });
  if (!setlist) notFound();

  const rows = await db
    .select({
      id: setlistItems.id,
      songId: setlistItems.songId,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .innerJoin(songs, eq(setlistItems.songId, songs.id))
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.position));

  const items: EditorItem[] = rows;

  // Repertoire zuerst, aber auch "In Probe" anbieten
  const songOptions = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      status: songs.status,
    })
    .from(songs)
    .where(or(eq(songs.status, "repertoire"), eq(songs.status, "rehearsing")))
    .orderBy(asc(songs.title));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/setlisten" className="text-sm text-mute hover:text-ink">
          ← Alle Setlisten
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="headline text-4xl">{setlist.name}</h1>
            <p className="mt-1 text-mute">
              {setlist.eventDate ? formatDate(setlist.eventDate) : "ohne Datum"}
              {setlist.notes ? ` · ${setlist.notes}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/setlisten/${setlist.id}/druck`} className="btn">
              🖨 Druckansicht
            </Link>
            <DeleteSetlistButton setlistId={setlist.id} name={setlist.name} />
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <SetlistEditor
          key={rows.map((r) => r.id).sort((a, b) => a - b).join("-")}
          setlistId={setlist.id}
          items={items}
          songOptions={songOptions}
        />
        <section className="card h-fit p-5">
          <h2 className="headline mb-4 text-lg">Details bearbeiten</h2>
          <SetlistForm setlist={setlist} />
        </section>
      </div>
    </div>
  );
}
