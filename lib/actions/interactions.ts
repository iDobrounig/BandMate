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
import { requireUser } from "@/lib/auth";
import { notifyBand } from "@/lib/mail";
import type { FormState } from "@/lib/actions/auth";

/** value: +1 / -1 stimmt ab, 0 entfernt die eigene Stimme. */
export async function setVote(songId: number, value: 1 | -1 | 0) {
  const user = await requireUser();
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
  const user = await requireUser();
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
  const user = await requireUser();
  const songId = Number(formData.get("songId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Der Kommentar darf nicht leer sein." };
  if (body.length > 2000) return { error: "Kommentar ist zu lang (max. 2000 Zeichen)." };

  await db.insert(comments).values({ songId, userId: user.id, body });

  const song = await db.query.songs.findFirst({ where: eq(songs.id, songId) });
  if (song) {
    notifyBand({
      subject: `Neuer Kommentar zu „${song.title}"`,
      text: `${user.name} schreibt zu „${song.title}":\n\n${body}\n\nAntworten: ${
        process.env.APP_URL ?? ""
      }/songs/${songId}`,
      excludeUserId: user.id,
    });
  }

  revalidatePath(`/songs/${songId}`);
  return {};
}

export async function deleteComment(commentId: number) {
  const user = await requireUser();
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });
  if (!comment) return;
  // Eigene Kommentare oder als Admin löschen
  if (comment.userId !== user.id && user.role !== "admin") return;
  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/songs/${comment.songId}`);
}
