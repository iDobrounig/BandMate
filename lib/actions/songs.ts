"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { songs, songLinks, type SongStatus } from "@/lib/db/schema";
import { requireBandContext } from "@/lib/auth";
import { detectLinkKind } from "@/lib/links";
import { parseDuration } from "@/lib/format";
import { saveUpload } from "@/lib/files";
import { notifyBand } from "@/lib/mail";
import { songAktiv } from "@/lib/db/filters";
import { matchesDuplicateTitle } from "@/lib/matching";
import type { FormState } from "@/lib/actions/auth";

function readSongFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const tempoRaw = String(formData.get("tempoBpm") ?? "").trim();
  const tempoBpm = tempoRaw ? Number(tempoRaw) : null;
  const songKey = String(formData.get("songKey") ?? "").trim();
  const capoRaw = String(formData.get("capo") ?? "").trim();
  const capo = capoRaw ? Number(capoRaw) : null;
  const durationSeconds = parseDuration(String(formData.get("duration") ?? ""));
  const lyricsChords = String(formData.get("lyricsChords") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    title,
    artist: artist || null,
    tempoBpm: tempoBpm && Number.isFinite(tempoBpm) ? Math.round(tempoBpm) : null,
    songKey: songKey || null,
    capo: capo && Number.isFinite(capo) ? capo : null,
    durationSeconds,
    lyricsChords: lyricsChords || null,
    notes: notes || null,
  };
}

function readLinks(formData: FormData) {
  const urls = formData.getAll("linkUrl").map(String);
  const labels = formData.getAll("linkLabel").map(String);
  return urls
    .map((url, i) => ({ url: url.trim(), label: labels[i]?.trim() || null }))
    .filter((l) => l.url.length > 0)
    .map((l) => ({ ...l, kind: detectLinkKind(l.url) }));
}

export type DuplicateMatch = {
  id: number;
  title: string;
  artist: string | null;
  status: SongStatus;
};

/** Für die Dubletten-Warnung beim Songvorschlag: bis zu 5 ähnliche, aktive Songs. */
export async function checkDuplicateTitle(title: string): Promise<DuplicateMatch[]> {
  const { bandId } = await requireBandContext();
  const input = title.trim();
  if (input.length < 2) return [];

  const candidates = await db
    .select({ id: songs.id, title: songs.title, artist: songs.artist, status: songs.status })
    .from(songs)
    .where(and(songAktiv, eq(songs.bandId, bandId)));

  const inputLower = input.toLowerCase();
  return candidates
    .filter((c) => matchesDuplicateTitle(c.title, input))
    .sort((a, b) => {
      const aExact = a.title.trim().toLowerCase() === inputLower;
      const bExact = b.title.trim().toLowerCase() === inputLower;
      return Number(bExact) - Number(aExact);
    })
    .slice(0, 5);
}

export async function createSong(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, bandId } = await requireBandContext();
  const fields = readSongFields(formData);
  if (!fields.title) return { error: "Der Titel darf nicht leer sein." };

  const [song] = await db
    .insert(songs)
    .values({ ...fields, bandId, suggestedById: user.id })
    .returning();

  const links = readLinks(formData);
  if (links.length > 0) {
    await db.insert(songLinks).values(links.map((l) => ({ ...l, songId: song.id })));
  }

  // Optionale Uploads direkt beim Anlegen
  let uploadFailed = false;
  try {
    const audio = formData.get("audioFile");
    if (audio instanceof File && audio.size > 0) {
      await saveUpload({ file: audio, songId: song.id, kind: "audio", userId: user.id });
    }
    const sheet = formData.get("sheetFile");
    if (sheet instanceof File && sheet.size > 0) {
      const instrument = String(formData.get("sheetInstrument") ?? "").trim();
      await saveUpload({
        file: sheet,
        songId: song.id,
        kind: "sheet",
        instrument,
        userId: user.id,
      });
    }
  } catch (err) {
    // Song ist angelegt, nur der Upload schlug fehl — auf der Detailseite nachholbar.
    // Die Detailseite zeigt einen Hinweis (?upload_error=1), sonst bekommt es niemand mit.
    console.error("Upload beim Anlegen fehlgeschlagen:", err);
    uploadFailed = true;
  }

  notifyBand({
    kind: "suggestion",
    bandId,
    subject: `Neuer Songvorschlag: ${fields.title}`,
    heading: "Neuer Songvorschlag",
    intro: `${user.name} hat einen neuen Song vorgeschlagen:`,
    highlight: `${fields.title}${fields.artist ? ` – ${fields.artist}` : ""}`,
    cta: {
      label: "Jetzt anhören und abstimmen",
      url: `${process.env.APP_URL ?? ""}/songs/${song.id}`,
    },
    excludeUserId: user.id,
  });

  revalidatePath("/", "layout");
  redirect(`/songs/${song.id}${uploadFailed ? "?upload_error=1" : ""}`);
}

export async function updateSong(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { bandId } = await requireBandContext();
  const songId = Number(formData.get("songId"));
  const fields = readSongFields(formData);
  if (!fields.title) return { error: "Der Titel darf nicht leer sein." };

  await db
    .update(songs)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(songs.id, songId), eq(songs.bandId, bandId)));

  // Links komplett ersetzen
  await db.delete(songLinks).where(eq(songLinks.songId, songId));
  const links = readLinks(formData);
  if (links.length > 0) {
    await db.insert(songLinks).values(links.map((l) => ({ ...l, songId })));
  }

  revalidatePath("/", "layout");
  redirect(`/songs/${songId}`);
}

export async function setSongStatus(songId: number, status: SongStatus) {
  const { bandId } = await requireBandContext();
  await db
    .update(songs)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(songs.id, songId), eq(songs.bandId, bandId)));
  revalidatePath("/", "layout");
}

/** Speichert clientseitig transponierte Lyrics (und ggf. die neue Tonart). */
export async function saveTransposedLyrics(
  songId: number,
  lyricsChords: string,
  songKey: string | null
) {
  const { bandId } = await requireBandContext();
  await db
    .update(songs)
    .set({
      lyricsChords: lyricsChords.trim() ? lyricsChords : null,
      songKey: songKey?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(songs.id, songId), eq(songs.bandId, bandId)));
  revalidatePath(`/songs/${songId}`);
}

/**
 * Legt den Song in den Papierkorb. Die Dateien bleiben auf der Platte, bis
 * endgültig gelöscht wird — siehe lib/trash.ts.
 */
export async function deleteSong(songId: number) {
  const { user, bandId } = await requireBandContext();
  await db
    .update(songs)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(and(eq(songs.id, songId), eq(songs.bandId, bandId)));
  revalidatePath("/", "layout");
  redirect(`/songs?undo=song:${songId}`);
}
