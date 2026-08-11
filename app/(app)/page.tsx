import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { songs, comments, users } from "@/lib/db/schema";
import { fetchSongList, fetchEvents, fetchSetlists, fetchUpcomingPrograms } from "@/lib/queries";
import { fetchReminderStatus } from "@/lib/notifications";
import { fetchTodo, touchLastSeen } from "@/lib/todo";
import { songAktiv } from "@/lib/db/filters";
import { SONG_STATUS, EVENT_KIND, ATTENDANCE_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReminderStatusLine } from "@/components/reminder-status";
import { TodoBlock } from "@/components/todo-block";

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  // lastSeenAt VOR dem Todo lesen und sofort fortschreiben — so nutzt „neu seit
  // letztem Besuch" den vorigen Wert, und rasche Reloads verlieren ihn nicht.
  const lastSeen = await touchLastSeen(user.id);

  const [allSongs, recentComments, upcomingEvents, allSetlists, reminderStatus, todo, programs] =
    await Promise.all([
      fetchSongList(user.id),
      db
        .select({ comment: comments, userName: users.name, songTitle: songs.title })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .innerJoin(songs, eq(comments.songId, songs.id))
        .where(songAktiv)
        .orderBy(desc(comments.createdAt))
        .limit(6),
      fetchEvents(user.id, { limit: 4 }),
      fetchSetlists(),
      // Nur Admins sehen die Statuszeile — für alle anderen gar nicht erst laden.
      isAdmin ? fetchReminderStatus() : Promise.resolve(null),
      fetchTodo(user.id, lastSeen),
      fetchUpcomingPrograms(),
    ]);

  const suggestions = allSongs.filter((s) => s.status === "suggestion");
  const topSuggestions = [...suggestions]
    .sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
    .slice(0, 5);
  const rehearsing = allSongs.filter((s) => s.status === "rehearsing");
  const repertoireCount = allSongs.filter((s) => s.status === "repertoire").length;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingSetlists = allSetlists
    .filter((s) => s.eventDate == null || s.eventDate >= today)
    .sort((a, b) => {
      if (!a.eventDate && !b.eventDate) return a.name.localeCompare(b.name, "de");
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return a.eventDate.localeCompare(b.eventDate);
    })
    .slice(0, 4);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-display text-xs uppercase tracking-[0.3em] text-accent">
            ● BandMate
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

      {reminderStatus && <ReminderStatusLine status={reminderStatus} />}
      {(todo.gesamt > 0 || programs.probe || programs.gig) && (
        <TodoBlock todo={todo} programs={programs} />
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8 min-w-0">
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
                        <span className="badge shrink-0 border-accent/40 bg-accent/10 text-accent-hi">
                          <span className="sm:hidden">offen</span>
                          <span className="hidden sm:inline">
                            noch nicht abgestimmt
                          </span>
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
                      {`✓ ${song.readyCount} können's`}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Seitenspalte */}
        <div className="space-y-8 min-w-0">
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="headline text-lg">Setlisten</h2>
              <Link href="/setlisten" className="text-sm text-mute hover:text-accent-hi">
                alle →
              </Link>
            </div>
            {upcomingSetlists.length === 0 ? (
              <div className="card p-8 text-center text-mute">
                Keine anstehenden Setlisten.{" "}
                <Link href="/setlisten/neu" className="text-accent-hi hover:underline">
                  Anlegen →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingSetlists.map((setlist) => (
                  <Link
                    key={setlist.id}
                    href={`/setlisten/${setlist.id}`}
                    className="card flex items-center gap-2 p-4 transition hover:border-accent/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {setlist.name}
                      </span>
                      <span className="mono-display block text-xs text-mute">
                        {setlist.eventDate ? formatDate(setlist.eventDate) : "ohne Datum"}
                      </span>
                    </span>
                    <span className="mono-display shrink-0 text-xs text-faint">
                      {setlist.songCount} {setlist.songCount === 1 ? "Song" : "Songs"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="headline text-lg">Nächste Termine</h2>
              <Link href="/termine" className="text-sm text-mute hover:text-accent-hi">
                alle →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="card p-8 text-center text-mute">
                Keine anstehenden Termine.{" "}
                <Link href="/termine" className="text-accent-hi hover:underline">
                  Anlegen →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/termine/${event.id}`}
                    className="card flex items-center gap-2 p-4 transition hover:border-accent/40"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${EVENT_KIND[event.kind].bar}`}
                      title={EVENT_KIND[event.kind].label}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {event.title}
                      </span>
                      <span className="mono-display block text-xs text-mute">
                        {formatDate(event.date)}
                        {event.startTime ? ` · ${event.startTime}` : ""}
                      </span>
                    </span>
                    <span
                      className={`mono-display shrink-0 text-xs ${
                        event.myStatus
                          ? ATTENDANCE_STATUS[event.myStatus].color
                          : "text-faint"
                      }`}
                    >
                      {event.myStatus
                        ? ATTENDANCE_STATUS[event.myStatus].symbol
                        : "offen"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="headline mb-3 text-lg">Zuletzt im Bandchat</h2>
            {recentComments.length === 0 ? (
              <div className="card p-8 text-center text-mute">Noch keine Kommentare.</div>
            ) : (
              <div className="space-y-2">
                {recentComments.map(({ comment, userName, songTitle }) => (
                  <Link
                    key={comment.id}
                    href={`/songs/${comment.songId}`}
                    className="card group block p-4 text-sm transition hover:border-accent/40"
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
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
