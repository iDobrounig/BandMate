"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  votes,
  practiceStatus,
  comments,
  songs,
  type PracticeState,
} from "@/lib/db/schema";
import { requireBandContext } from "@/lib/auth";
import { notifyBand } from "@/lib/mail";
import type { FormState } from "@/lib/actions/auth";

/** Prüft, ob der Song zur Band gehört — Voraussetzung für jede Interaktion. */
async function songInBand(songId: number, bandId: number): Promise<boolean> {
  return !!(await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), eq(songs.bandId, bandId)),
  }));
}

/** value: +1 / -1 stimmt ab, 0 entfernt die eigene Stimme. */
export async function setVote(songId: number, value: 1 | -1 | 0) {
  const { user, bandId } = await requireBandContext();
  if (!(await songInBand(songId, bandId))) return;
  if (value === 0) {
    await db
      .delete(votes)
      .where(and(eq(votes.songId, songId), eq(votes.userId, user.id)));
  } else {
    await db
      .insert(votes)
      .values({ songId, userId: user.id, value })
      .onConflictDoUpdate({
        target: [votes.songId, votes.userId],
        set: { value },
      });
  }
  revalidatePath("/", "layout");
}

export async function setPracticeState(songId: number, status: PracticeState) {
  const { user, bandId } = await requireBandContext();
  if (!(await songInBand(songId, bandId))) return;
  await db
    .insert(practiceStatus)
    .values({ songId, userId: user.id, status })
    .onConflictDoUpdate({
      target: [practiceStatus.songId, practiceStatus.userId],
      set: { status },
    });
  revalidatePath(`/songs/${songId}`);
}

export async function addComment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, bandId } = await requireBandContext();
  const songId = Number(formData.get("songId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Der Kommentar darf nicht leer sein." };
  if (body.length > 2000) return { error: "Kommentar ist zu lang (max. 2000 Zeichen)." };

  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), eq(songs.bandId, bandId)),
  });
  if (!song) return { error: "Song nicht gefunden." };

  await db.insert(comments).values({ songId, userId: user.id, body });

  {
    notifyBand({
      kind: "comment",
      bandId,
      subject: `Neuer Kommentar zu „${song.title}"`,
      heading: "Neuer Kommentar",
      intro: `${user.name} schreibt zu „${song.title}":`,
      quote: body,
      cta: {
        label: "Antworten",
        url: `${process.env.APP_URL ?? ""}/songs/${songId}`,
      },
      excludeUserId: user.id,
    });
  }

  revalidatePath(`/songs/${songId}`);
  return { success: "Kommentar gesendet." };
}

export async function deleteComment(commentId: number) {
  const { user, bandId, role } = await requireBandContext();
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });
  if (!comment) return;
  // Kommentar muss zu einem Song DIESER Band gehören.
  if (!(await songInBand(comment.songId, bandId))) return;
  // Eigene Kommentare oder als Band-Admin löschen
  if (comment.userId !== user.id && role !== "band_admin") return;
  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/songs/${comment.songId}`);
}
