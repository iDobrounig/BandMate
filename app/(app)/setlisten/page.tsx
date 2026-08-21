import Link from "next/link";
import { requireBandContext } from "@/lib/auth";
import { fetchSetlists } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { UndoBanner } from "@/components/undo-banner";

export const metadata = { title: "Setlisten" };

type Search = { undo?: string; q?: string; sort?: string; vergangene?: string };
type Sort = "datum" | "name" | "songs";

const SORT_LABEL: Record<Sort, string> = {
  datum: "Datum",
  name: "Name",
  songs: "Songs",
};

export default async function SetlistenPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { bandId } = await requireBandContext();

  const [lists, params] = await Promise.all([fetchSetlists(bandId), searchParams]);

  const q = (params.q ?? "").trim();
  const sort: Sort =
    params.sort === "name" || params.sort === "songs" ? params.sort : "datum";
  const showPast = params.vergangene === "1";
  const today = new Date().toISOString().slice(0, 10);

  const byName = (a: (typeof lists)[number], b: (typeof lists)[number]) =>
    a.name.localeCompare(b.name, "de");

  const filtered = q
    ? lists.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    : lists;

  const isPast = (s: (typeof lists)[number]) =>
    s.eventDate != null && s.eventDate < today;
  const upcoming = filtered.filter((s) => !isPast(s));
  const past = filtered.filter(isPast);

  upcoming.sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "songs") return b.songCount - a.songCount || byName(a, b);
    // datum: datierte aufsteigend (nächste zuerst), undatierte ans Ende
    if (!a.eventDate && !b.eventDate) return byName(a, b);
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    return a.eventDate.localeCompare(b.eventDate);
  });
  past.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));

  const buildQuery = (overrides: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged: Partial<Search> = {
      q: q || undefined,
      sort: sort === "datum" ? undefined : sort,
      vergangene: showPast ? "1" : undefined,
      ...overrides,
    };
    if (merged.q) p.set("q", merged.q);
    if (merged.sort) p.set("sort", merged.sort);
    if (merged.vergangene) p.set("vergangene", merged.vergangene);
    const qs = p.toString();
    return qs ? `/setlisten?${qs}` : "/setlisten";
  };

  const card = (setlist: (typeof lists)[number]) => (
    <Link
      key={setlist.id}
      href={`/setlisten/${setlist.id}`}
      className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{setlist.name}</p>
        <p className="text-sm text-mute">
          {setlist.eventDate ? formatDate(setlist.eventDate) : "ohne Datum"}
        </p>
      </div>
      <div className="mono-display shrink-0 text-right text-sm text-mute">
        <p>
          {setlist.songCount} {setlist.songCount === 1 ? "Song" : "Songs"}
        </p>
        <p className="text-xs text-faint">{formatDuration(setlist.totalSeconds)}</p>
      </div>
    </Link>
  );

  return (
    <div>
      <UndoBanner undo={params.undo} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-3xl">Setlisten</h1>
          <p className="mt-1 text-sm text-mute">
            Programme für Gigs und Proben — zusammengestellt aus dem Repertoire.
          </p>
        </div>
        <Link href="/setlisten/neu" className="btn btn-primary">
          + Neue Setliste
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-mute">
          Noch keine Setlisten — oben auf „+ Neue Setliste".
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form method="get" className="min-w-48 flex-1">
              {sort !== "datum" && <input type="hidden" name="sort" value={sort} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Setliste suchen …"
                className="input"
                aria-label="Setliste suchen"
              />
            </form>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-faint">Sortieren:</span>
              {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
                <Link
                  key={key}
                  href={buildQuery({ sort: key === "datum" ? undefined : key })}
                  className={`rounded-lg px-2 py-1 transition ${
                    sort === key
                      ? "bg-accent/15 text-accent-hi"
                      : "text-mute hover:bg-raise hover:text-ink"
                  }`}
                >
                  {SORT_LABEL[key]}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {upcoming.length === 0 && (
              <div className="card p-8 text-center text-mute">
                {q ? "Keine Setliste gefunden." : "Alle Setlisten sind vergangen."}
              </div>
            )}
            {upcoming.map(card)}

            {(past.length > 0 || showPast) && (
              <div className="pt-2">
                {showPast ? (
                  <>
                    <h2 className="headline mb-3 text-lg text-mute">
                      Vergangene Setlisten
                    </h2>
                    <div className="space-y-2 opacity-70">
                      {past.map(card)}
                      {past.length === 0 && (
                        <p className="text-sm text-faint">
                          Keine vergangenen Setlisten.
                        </p>
                      )}
                    </div>
                    <Link
                      href={buildQuery({ vergangene: undefined })}
                      className="mt-3 inline-block text-sm text-mute hover:text-ink"
                    >
                      ← Vergangene ausblenden
                    </Link>
                  </>
                ) : (
                  <Link
                    href={buildQuery({ vergangene: "1" })}
                    className="text-sm text-mute hover:text-ink"
                  >
                    Vergangene Setlisten anzeigen ({past.length}) →
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
