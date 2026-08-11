import Link from "next/link";
import type { TodoData } from "@/lib/todo";
import type { ProgramEntry } from "@/lib/queries";
import { formatDate } from "@/lib/format";

/** Songliste (Agenda) bzw. verknüpfte Setliste als kurzer Textzusatz. */
function programSongsLabel(entry: ProgramEntry): string {
  if (entry.agendaSongs.length > 0) {
    const shown = entry.agendaSongs.slice(0, 4).map((s) => s.title);
    return shown.join(", ") + (entry.agendaSongs.length > 4 ? ` +${entry.agendaSongs.length - 4}` : "");
  }
  if (entry.setlist) {
    return `Setliste: ${entry.setlist.name} (${entry.setlist.songCount} ${
      entry.setlist.songCount === 1 ? "Song" : "Songs"
    })`;
  }
  return "noch nichts geplant";
}

/**
 * „Was muss ich tun?" — persönliche Aufgabenliste ganz oben auf dem Dashboard.
 * Zeigt zusätzlich (unabhängig vom eigenen Übe-Status) die nächste Probe und
 * den nächsten Gig — deshalb ist der Block fast immer sichtbar; der Aufrufer
 * prüft trotzdem, ob überhaupt Probe/Gig/Todo vorhanden ist, damit er bei
 * einer wirklich leeren Band (keine Termine, keine Vorschläge) ganz wegbleibt.
 */
export function TodoBlock({
  todo,
  programs,
}: {
  todo: TodoData;
  programs: { probe: ProgramEntry | null; gig: ProgramEntry | null };
}) {
  return (
    <section className="card border-accent/30 bg-accent/5 p-5">
      <h2 className="headline mb-3 text-lg text-accent-hi">Was für dich ansteht</h2>
      <ul className="space-y-2.5 text-sm">
        {programs.probe && (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              Nächste Probe:{" "}
              <Link
                href={`/termine/${programs.probe.event.id}`}
                className="font-semibold hover:text-accent-hi"
              >
                {programs.probe.event.title}
              </Link>{" "}
              am {formatDate(programs.probe.event.date)}
              {programs.probe.event.startTime ? `, ${programs.probe.event.startTime} Uhr` : ""}{" "}
              — {programSongsLabel(programs.probe)}
            </span>
          </li>
        )}
        {programs.gig && (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              Nächster Gig:{" "}
              <Link
                href={`/termine/${programs.gig.event.id}`}
                className="font-semibold hover:text-accent-hi"
              >
                {programs.gig.event.title}
              </Link>{" "}
              am {formatDate(programs.gig.event.date)}
              {programs.gig.event.startTime ? `, ${programs.gig.event.startTime} Uhr` : ""}{" "}
              — {programSongsLabel(programs.gig)}
            </span>
          </li>
        )}
        {todo.offeneTermine.map((t) => (
          <li key={`e${t.id}`} className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              <Link href={`/termine/${t.id}`} className="font-semibold hover:text-accent-hi">
                {t.title}
              </Link>{" "}
              am {formatDate(t.date)}
              {t.startTime ? `, ${t.startTime} Uhr` : ""} — noch nicht zu-/abgesagt
            </span>
          </li>
        ))}

        {todo.offeneVorschlaege.length > 0 && (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              {todo.offeneVorschlaege.length === 1 ? (
                <>
                  Noch nicht abgestimmt:{" "}
                  <Link
                    href={`/songs/${todo.offeneVorschlaege[0].id}`}
                    className="font-semibold hover:text-accent-hi"
                  >
                    {todo.offeneVorschlaege[0].title}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/songs?status=suggestion" className="font-semibold hover:text-accent-hi">
                    {todo.offeneVorschlaege.length} Vorschläge
                  </Link>{" "}
                  warten auf deine Stimme
                </>
              )}
            </span>
          </li>
        )}

        {todo.ungeuebteAgenda.map((a) => (
          <li key={`a${a.eventId}`} className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              Für{" "}
              <Link href={`/termine/${a.eventId}`} className="font-semibold hover:text-accent-hi">
                {a.eventTitle}
              </Link>{" "}
              am {formatDate(a.date)}:{" "}
              {a.songs.length === 1
                ? "1 Agenda-Song, den du noch nicht kannst"
                : `${a.songs.length} Agenda-Songs, die du noch nicht kannst`}{" "}
              (
              {a.songs.slice(0, 3).map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/songs/${s.id}`} className="hover:text-accent-hi">
                    {s.title}
                  </Link>
                </span>
              ))}
              {a.songs.length > 3 ? " …" : ""})
            </span>
          </li>
        ))}

        {todo.neueKommentare > 0 && (
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">▸</span>
            <span>
              {todo.neueKommentare === 1
                ? "1 neuer Kommentar"
                : `${todo.neueKommentare} neue Kommentare`}{" "}
              seit deinem letzten Besuch
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
