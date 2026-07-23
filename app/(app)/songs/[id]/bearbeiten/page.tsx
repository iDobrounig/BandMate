import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { songs, songLinks } from "@/lib/db/schema";
import { songAktiv } from "@/lib/db/filters";
import { SongForm } from "@/components/song-form";

export const metadata = { title: "Song bearbeiten" };

export default async function SongBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const songId = Number(id);
  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), songAktiv),
  });
  if (!song) notFound();
  const links = await db.query.songLinks.findMany({
    where: eq(songLinks.songId, songId),
  });

  return (
    <div className="max-w-2xl">
      <Link href={`/songs/${song.id}`} className="text-sm text-mute hover:text-ink">
        ← Zurück zum Song
      </Link>
      <h1 className="headline mt-3 text-3xl">„{song.title}" bearbeiten</h1>
      <div className="card mt-8 p-6">
        <SongForm song={song} links={links} />
      </div>
    </div>
  );
}
