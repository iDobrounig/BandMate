import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fetchSongDetail } from "@/lib/queries";
import { SONG_STATUS, PRACTICE_STATUS } from "@/lib/constants";
import { formatDuration, formatDateTime, formatBytes } from "@/lib/format";
import { VoteButtons } from "@/components/vote-buttons";
import { PracticePicker } from "@/components/practice";
import { CommentForm, DeleteCommentButton } from "@/components/comments";
import { UploadForm, DeleteAttachmentButton } from "@/components/uploads";
import { LinkEmbed } from "@/components/embeds";
import { Metronome } from "@/components/metronome";
import { SongStatusActions } from "@/components/song-actions";
import type { PracticeState } from "@/lib/db/schema";

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await fetchSongDetail(Number(id));
  if (!data) notFound();

  const { song, links, files, comments, votes, practice, allUsers, suggestedByName } =
    data;
  const statusMeta = SONG_STATUS[song.status];
  const myVote = votes.find((v) => v.userId === user.id)?.value ?? 0;
  const upvoters = votes.filter((v) => v.value > 0).map((v) => v.userName);
  const downvoters = votes.filter((v) => v.value < 0).map((v) => v.userName);
  const myPractice: PracticeState =
    practice.find((p) => p.userId === user.id)?.status ?? "not_started";
  const audioFiles = files.filter((f) => f.kind === "audio");
  const sheetFiles = files.filter((f) => f.kind === "sheet");

  const sheetsByInstrument = new Map<string, typeof sheetFiles>();
  for (const file of sheetFiles) {
    const key = file.instrument || "Sonstige";
    sheetsByInstrument.set(key, [...(sheetsByInstrument.get(key) ?? []), file]);
  }

  return (
    <div className="space-y-8">
      {/* Kopf */}
      <div>
        <Link href="/songs" className="text-sm text-mute hover:text-ink">
          ← Alle Songs
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl">{song.title}</h1>
              <span className={`badge ${statusMeta.badge}`}>
                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-1 text-mute">
              {song.artist ?? "Interpret unbekannt"}
              {suggestedByName ? ` · vorgeschlagen von ${suggestedByName}` : ""}
            </p>
          </div>
          <Link href={`/songs/${song.id}/bearbeiten`} className="btn">
            ✎ Bearbeiten
          </Link>
        </div>

        {/* Tuner-Zeile: Tempo / Tonart / Capo / Dauer */}
        <div className="card mono-display mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3 text-sm">
          <span>
            <span className="text-faint">TEMPO </span>
            {song.tempoBpm ? `${song.tempoBpm} BPM` : "–"}
          </span>
          <span>
            <span className="text-faint">TONART </span>
            {song.songKey ?? "–"}
          </span>
          <span>
            <span className="text-faint">CAPO </span>
            {song.capo ?? "–"}
          </span>
          <span>
            <span className="text-faint">DAUER </span>
            {formatDuration(song.durationSeconds)}
          </span>
          <div className="ml-auto">
            <Metronome initialBpm={song.tempoBpm} />
          </div>
        </div>

        <div className="mt-4">
          <SongStatusActions songId={song.id} status={song.status} title={song.title} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Hauptspalte */}
        <div className="min-w-0 space-y-8">
          {/* Voting */}
          {song.status === "suggestion" && (
            <section className="card p-5">
              <h2 className="headline mb-3 text-lg">Wollen wir den spielen?</h2>
              <VoteButtons
                songId={song.id}
                myVote={myVote}
                upvoters={upvoters}
                downvoters={downvoters}
              />
            </section>
          )}

          {/* Links / Embeds */}
          {links.length > 0 && (
            <section className="space-y-3">
              <h2 className="headline text-lg">Anhören</h2>
              {links.map((link) => (
                <LinkEmbed key={link.id} link={link} />
              ))}
            </section>
          )}

          {/* Audio-Dateien */}
          <section className="space-y-3">
            <h2 className="headline text-lg">Aufnahmen &amp; Audio</h2>
            {audioFiles.map((file) => (
              <div key={file.id} className="card p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold">
                    {file.originalName}
                    <span className="ml-2 font-normal text-faint">
                      {formatBytes(file.size)}
                    </span>
                  </p>
                  <div className="flex shrink-0 gap-3 text-xs">
                    <a
                      className="text-accent-hi hover:underline"
                      href={`/api/files/${file.id}?download=1`}
                    >
                      Download
                    </a>
                    <DeleteAttachmentButton
                      attachmentId={file.id}
                      name={file.originalName}
                    />
                  </div>
                </div>
                <audio
                  controls
                  preload="none"
                  className="w-full"
                  src={`/api/files/${file.id}`}
                />
              </div>
            ))}
            <UploadForm songId={song.id} kind="audio" />
          </section>

          {/* Lyrics / Akkorde */}
          {song.lyricsChords && (
            <section>
              <h2 className="headline mb-3 text-lg">Lyrics &amp; Akkorde</h2>
              <pre className="card mono-display overflow-x-auto p-5 text-sm leading-relaxed whitespace-pre-wrap">
                {song.lyricsChords}
              </pre>
            </section>
          )}

          {/* Notizen */}
          {song.notes && (
            <section>
              <h2 className="headline mb-3 text-lg">Notizen</h2>
              <div className="card p-5 text-sm whitespace-pre-wrap">{song.notes}</div>
            </section>
          )}

          {/* Kommentare */}
          <section>
            <h2 className="headline mb-3 text-lg">
              Bandchat
              <span className="mono-display ml-2 text-sm text-faint">
                {comments.length}
              </span>
            </h2>
            <div className="space-y-3">
              {comments.map(({ comment, userName }) => (
                <div key={comment.id} className="card p-4">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-accent-hi">{userName}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-faint">
                        {formatDateTime(comment.createdAt)}
                      </span>
                      {(comment.userId === user.id || user.role === "admin") && (
                        <DeleteCommentButton commentId={comment.id} />
                      )}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-faint">Noch keine Kommentare.</p>
              )}
              <CommentForm songId={song.id} />
            </div>
          </section>
        </div>

        {/* Seitenspalte */}
        <div className="space-y-8">
          {/* Übe-Status */}
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Mein Übe-Status</h2>
            <PracticePicker songId={song.id} mine={myPractice} />
            <h3 className="label mt-5">Band-Übersicht</h3>
            <ul className="space-y-1.5">
              {allUsers.map((member) => {
                const st: PracticeState =
                  practice.find((p) => p.userId === member.id)?.status ??
                  "not_started";
                const meta = PRACTICE_STATUS[st];
                return (
                  <li key={member.id} className="flex items-center gap-2 text-sm">
                    <span className={`size-2 shrink-0 rounded-full ${meta.color}`} />
                    <span className="min-w-0 truncate">
                      {member.name}
                      {member.instrument && (
                        <span className="text-faint"> · {member.instrument}</span>
                      )}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-mute">
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Noten */}
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Noten</h2>
            {sheetsByInstrument.size === 0 && (
              <p className="mb-3 text-sm text-faint">Noch keine Noten hochgeladen.</p>
            )}
            <div className="space-y-4">
              {[...sheetsByInstrument.entries()].map(([instrument, instrumentFiles]) => (
                <div key={instrument}>
                  <h3 className="label">{instrument}</h3>
                  <ul className="space-y-1.5">
                    {instrumentFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <a
                          className="min-w-0 truncate text-accent-hi hover:underline"
                          href={`/api/files/${file.id}`}
                          target="_blank"
                          rel="noopener"
                        >
                          𝄞 {file.originalName}
                        </a>
                        <DeleteAttachmentButton
                          attachmentId={file.id}
                          name={file.originalName}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-line-soft pt-4">
              <UploadForm songId={song.id} kind="sheet" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
