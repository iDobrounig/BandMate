import Link from "next/link";
import { desc, eq, gte, sql, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { songs, comments, users, setlists } from "@/lib/db/schema";
import { fetchSongList } from "@/lib/queries";
import { SONG_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();

  const [allSongs, recentComments, upcomingSetlists] = await Promise.all([
    fetchSongList(user.id),
    db
      .select({ comment: comments, userName: users.name, songTitle: songs.title })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(songs, eq(comments.songId, songs.id))
      .orderBy(desc(comments.createdAt))
      .limit(6),
    db
      .select()
      .from(setlists)
      .where(gte(setlists.eventDate, new Date().toISOString().slice(0, 10)))
      .orderBy(asc(setlists.eventDate))
      .limit(4),
  ]);

  const suggestions = allSongs.filter((s) => s.status === "suggestion");
  const topSuggestions = [...suggestions]
    .sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
    .slice(0, 5);
  const rehearsing = allSongs.filter((s) => s.status === "rehearsing");
  const repertoireCount = allSongs.filter((s) => s.status === "repertoire").length;

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-display text-xs uppercase tracking-[0.3em] text-accent">
            ● Bandraum
          </p>
          <h1 className="headline mt-1 text-4xl">Servus, {firstName}!</h1>
          <p className="mt-2 text-sm text-mute">
            {suggestions.length} offene Vorschläge · {rehearsing.length} in Probe ·{" "}
            {repertoireCount} im Repertoire
          </p>
        </div>
        <Link href="/songs/neu" className="btn btn-primary">
          + Song vorschlagen
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* Top-Vorschläge */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="headline text-xl">Heiße Vorschläge</h2>
              <Link
                href="/songs?status=suggestion"
                className="text-sm text-mute hover:text-accent-hi"
              >
                alle →
              </Link>
            </div>
            {topSuggestions.length === 0 ? (
              <div className="card p-8 text-center text-mute">
                Keine offenen Vorschläge — Zeit für neue Ideen!
              </div>
            ) : (
              <div className="space-y-2">
                {topSuggestions.map((song) => {
                  const score = song.upvotes - song.downvotes;
                  return (
                    <Link
                      key={song.id}
                      href={`/songs/${song.id}`}
                      className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
                    >
                      <span
                        className={`mono-display w-10 shrink-0 text-center text-lg font-bold ${
                          score > 0
                            ? "text-emerald-400"
                            : score < 0
                              ? "text-red-400"
                              : "text-faint"
                        }`}
                      >
                        {score > 0 ? `+${score}` : score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{song.title}</p>
                        <p className="truncate text-sm text-mute">
                          {song.artist ?? "—"}
                          {song.suggestedByName
                            ? ` · von ${song.suggestedByName}`
                            : ""}
                        </p>
                      </div>
                      {song.myVote === 0 && (
                        <span className="badge border-accent/40 bg-accent/10 text-accent-hi">
                          noch nicht abgestimmt
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* In Probe */}
          {rehearsing.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="headline text-xl">Gerade in Probe</h2>
                <Link
                  href="/songs?status=rehearsing"
                  className="text-sm text-mute hover:text-accent-hi"
                >
                  alle →
                </Link>
              </div>
              <div className="space-y-2">
                {rehearsing.slice(0, 5).map((song) => (
                  <Link
                    key={song.id}
                    href={`/songs/${song.id}`}
                    className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${SONG_STATUS.rehearsing.dot}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{song.title}</p>
                      <p className="truncate text-sm text-mute">{song.artist ?? "—"}</p>
                    </div>
                    <span className="mono-display shrink-0 text-xs text-mute">
                      ✓ {song.readyCount} können&rsquo;s
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Seitenspalte */}
        <div className="space-y-8">
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Nächste Termine</h2>
            {upcomingSetlists.length === 0 ? (
              <p className="text-sm text-faint">
                Keine anstehenden Setlisten.{" "}
                <Link href="/setlisten" className="text-accent-hi hover:underline">
                  Anlegen →
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingSetlists.map((setlist) => (
                  <li key={setlist.id}>
                    <Link
                      href={`/setlisten/${setlist.id}`}
                      className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-raise"
                    >
                      <span className="min-w-0 truncate font-semibold">
                        {setlist.name}
                      </span>
                      <span className="mono-display shrink-0 text-xs text-mute">
                        {formatDate(setlist.eventDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Zuletzt im Bandchat</h2>
            {recentComments.length === 0 ? (
              <p className="text-sm text-faint">Noch keine Kommentare.</p>
            ) : (
              <ul className="space-y-3">
                {recentComments.map(({ comment, userName, songTitle }) => (
                  <li key={comment.id} className="text-sm">
                    <Link
                      href={`/songs/${comment.songId}`}
                      className="group block rounded-lg px-2 py-1.5 transition hover:bg-raise"
                    >
                      <p className="text-xs text-mute">
                        <span className="font-semibold text-accent-hi">
                          {userName}
                        </span>{" "}
                        zu{" "}
                        <span className="font-semibold group-hover:text-accent-hi">
                          {songTitle}
                        </span>{" "}
                        · {formatDateTime(comment.createdAt)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-ink/90">
                        {comment.body}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
