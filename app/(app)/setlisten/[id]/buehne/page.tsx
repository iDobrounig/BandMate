import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireBandContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs, attachments } from "@/lib/db/schema";
import { songAktiv, setlistAktiv, anhangAktiv } from "@/lib/db/filters";
import { StageView } from "@/components/stage/stage-view";
import type { StagePage, StageSheet } from "@/components/stage/types";

export const metadata = { title: "Bühnenmodus" };
// Bis unter Notch/Display-Rundung ziehen, damit die Safe-Area-Insets (env())
// greifen; die Kopf-/Fußzeilen halten den Inhalt darüber frei.
export const viewport: Viewport = { viewportFit: "cover" };

export default async function SetlistBuehnePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { bandId, instrument } = await requireBandContext();
  const { id } = await params;
  const setlistId = Number(id);

  const setlist = await db.query.setlists.findFirst({
    where: and(eq(setlists.id, setlistId), eq(setlists.bandId, bandId), setlistAktiv),
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
      capo: songs.capo,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
      lyricsChords: songs.lyricsChords,
    })
    .from(setlistItems)
    .leftJoin(songs, eq(setlistItems.songId, songs.id))
    .where(and(eq(setlistItems.setlistId, setlistId), songAktiv))
    .orderBy(asc(setlistItems.position));

  // Aktive Noten aller vorkommenden Songs, je Song gruppiert.
  const songIds = rows.filter((r) => r.songId != null).map((r) => r.songId!);
  const sheetsBySong = new Map<number, StageSheet[]>();
  if (songIds.length > 0) {
    const sheetRows = await db
      .select({
        id: attachments.id,
        songId: attachments.songId,
        instrument: attachments.instrument,
        mime: attachments.mime,
        originalName: attachments.originalName,
      })
      .from(attachments)
      .where(
        and(
          inArray(attachments.songId, songIds),
          eq(attachments.kind, "sheet"),
          anhangAktiv
        )
      )
      .orderBy(asc(attachments.id));
    for (const s of sheetRows) {
      const list = sheetsBySong.get(s.songId) ?? [];
      list.push({
        id: s.id,
        instrument: s.instrument,
        mime: s.mime,
        originalName: s.originalName,
      });
      sheetsBySong.set(s.songId, list);
    }
  }

  const pages: StagePage[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    breakSeconds: r.breakSeconds,
    note: r.note,
    title: r.title,
    artist: r.artist,
    songKey: r.songKey,
    capo: r.capo,
    tempoBpm: r.tempoBpm,
    durationSeconds: r.durationSeconds,
    lyricsChords: r.lyricsChords,
    sheets: r.songId != null ? sheetsBySong.get(r.songId) ?? [] : [],
  }));

  if (pages.length === 0) notFound();

  return (
    <StageView
      setlistId={setlistId}
      setlistName={setlist.name}
      pages={pages}
      currentInstrument={instrument}
    />
  );
}
