import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchSongList } from "@/lib/queries";
import { SONG_STATUS, STATUS_ORDER } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { SongStatus } from "@/lib/db/schema";

export const metadata = { title: "Songs" };

type Search = { status?: string; q?: string; sort?: string };
type Tab = "all" | SongStatus;

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activeTab: Tab =
    params.status === "all" ||
    STATUS_ORDER.includes(params.status as SongStatus)
      ? (params.status as Tab)
      : "suggestion";
  const q = (params.q ?? "").toLowerCase().trim();
  const sort =
    params.sort ??
    (activeTab === "all"
      ? "status"
      : activeTab === "suggestion"
        ? "votes"
        : "title");

  const all = await fetchSongList(user.id);
  const counts: Record<string, number> = {
    all: all.length,
    ...Object.fromEntries(
      STATUS_ORDER.map((s) => [s, all.filter((song) => song.status === s).length])
    ),
  };

  let list =
    activeTab === "all" ? [...all] : all.filter((song) => song.status === activeTab);
  if (q) {
    list = list.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        (song.artist ?? "").toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => {
    if (sort === "votes") return b.upvotes - b.downvotes - (a.upvotes - a.downvotes);
    if (sort === "neueste") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "status") {
      const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (d !== 0) return d;
    }
    return a.title.localeCompare(b.title, "de");
  });

  const query = (overrides: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { status: activeTab, q: params.q, sort: params.sort, ...overrides };
    if (merged.status) p.set("status", merged.status);
    if (merged.q) p.set("q", merged.q);
    if (merged.sort) p.set("sort", merged.sort);
    return `/songs?${p.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-3xl">Songs</h1>
          <p className="mt-1 text-sm text-mute">
            Vorschläge, Probenmaterial und Repertoire der Band.
          </p>
        </div>
        <Link href="/songs/neu" className="btn btn-primary">
          + Song vorschlagen
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-line-soft pb-px">
        {(["all", ...STATUS_ORDER] as Tab[]).map((tab) => (
          <Link
            key={tab}
            href={query({ status: tab, sort: undefined })}
            className={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === activeTab
                ? "border-accent text-accent-hi"
                : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {tab === "all" ? "Alle" : SONG_STATUS[tab].label}
            <span className="mono-display ml-1.5 text-xs text-faint">
              {counts[tab]}
            </span>
          </Link>
        ))}
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/songs" method="get">
        <input type="hidden" name="status" value={activeTab} />
        <input
          className="input w-full sm:max-w-64"
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Titel oder Interpret suchen …"
        />
        <select className="input w-full sm:max-w-40" name="sort" defaultValue={sort}>
          {activeTab === "all" && <option value="status">Nach Status</option>}
          <option value="votes">Nach Votes</option>
          <option value="title">Nach Titel</option>
          <option value="neueste">Neueste zuerst</option>
        </select>
        <button className="btn w-full sm:w-auto" type="submit">
          Filtern
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <div className="card p-10 text-center text-mute">
            {q
              ? "Nichts gefunden."
              : activeTab === "all"
                ? "Noch keine Songs angelegt."
                : activeTab === "suggestion"
                  ? "Noch keine Vorschläge — mach den ersten!"
                  : `Noch keine Songs im Status „${SONG_STATUS[activeTab].label}".`}
          </div>
        )}
        {list.map((song) => {
          const score = song.upvotes - song.downvotes;
          return (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
            >
              {activeTab === "all" ? (
                <span
                  className={`badge shrink-0 ${SONG_STATUS[song.status].badge}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${SONG_STATUS[song.status].dot}`}
                  />
                  {SONG_STATUS[song.status].label}
                </span>
              ) : activeTab === "suggestion" ? (
                <div
                  className={`mono-display w-12 shrink-0 text-center text-xl font-bold ${
                    score > 0
                      ? "text-emerald-400"
                      : score < 0
                        ? "text-red-400"
                        : "text-faint"
                  }`}
                  title={`${song.upvotes}× dafür, ${song.downvotes}× dagegen`}
                >
                  {score > 0 ? `+${score}` : score}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{song.title}</p>
                <p className="truncate text-sm text-mute flex flex-wrap items-center gap-x-1.5">
                  <span>
                    {song.artist ?? "—"}
                    {song.suggestedByName &&
                    (activeTab === "suggestion" || activeTab === "all")
                      ? ` · Vorschlag von ${song.suggestedByName}`
                      : ""}
                  </span>
                  <span className="sm:hidden text-xs text-faint">
                    {song.tempoBpm && ` · ${song.tempoBpm} BPM`}
                    {song.songKey && ` · ${song.songKey}`}
                    {song.capo && ` (Capo ${song.capo})`}
                  </span>
                </p>
              </div>
              <div className="mono-display hidden shrink-0 gap-4 text-xs text-mute sm:flex">
                {song.tempoBpm && <span title="Tempo">{song.tempoBpm} BPM</span>}
                {song.songKey && <span title="Tonart">{song.songKey}</span>}
                {song.durationSeconds && (
                  <span title="Dauer">{formatDuration(song.durationSeconds)}</span>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-xs text-faint">
                {song.audioCount > 0 && <span title="Audio-Dateien">♫ {song.audioCount}</span>}
                {song.sheetCount > 0 && <span title="Noten">𝄞 {song.sheetCount}</span>}
                {song.commentCount > 0 && <span title="Kommentare">💬 {song.commentCount}</span>}
                {song.readyCount > 0 && (
                  <span title="Mitglieder, die den Song können" className="text-emerald-400">
                    ✓ {song.readyCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
