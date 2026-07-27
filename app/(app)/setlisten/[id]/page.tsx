import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { songAktiv, setlistAktiv } from "@/lib/db/filters";
import { formatDate } from "@/lib/format";
import { duplicateSetlist } from "@/lib/actions/setlists";
import { DeleteSetlistButton } from "@/components/setlist-forms";
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
    where: and(eq(setlists.id, setlistId), setlistAktiv),
  });
  if (!setlist) notFound();

  const rows = await db
    .select({
      id: setlistItems.id,
      kind: setlistItems.kind,
      songId: setlistItems.songId,
      label: setlistItems.label,
      breakSeconds: setlistItems.breakSeconds,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .leftJoin(songs, eq(setlistItems.songId, songs.id))
    .where(and(eq(setlistItems.setlistId, setlistId), songAktiv))
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
    .where(
      and(
        or(eq(songs.status, "repertoire"), eq(songs.status, "rehearsing")),
        songAktiv
      )
    )
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
          <div className="flex flex-wrap gap-2">
            <Link href={`/setlisten/${setlist.id}/buehne`} className="btn btn-primary">
              ▶ Bühnenmodus
            </Link>
            <Link href={`/setlisten/${setlist.id}/bearbeiten`} className="btn">
              ✎ Bearbeiten
            </Link>
            <Link href={`/setlisten/${setlist.id}/druck`} className="btn">
              🖨 Druckansicht
            </Link>
            <form action={duplicateSetlist.bind(null, setlist.id)}>
              <button type="submit" className="btn" title="Kopie dieser Setliste anlegen">
                ⧉ Duplizieren
              </button>
            </form>
            <DeleteSetlistButton setlistId={setlist.id} name={setlist.name} />
          </div>
        </div>
      </div>

      <SetlistEditor
        key={rows.map((r) => r.id).sort((a, b) => a - b).join("-")}
        setlistId={setlist.id}
        items={items}
        songOptions={songOptions}
        targetSeconds={setlist.targetSeconds}
      />
    </div>
  );
}
