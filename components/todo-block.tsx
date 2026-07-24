import Link from "next/link";
import type { TodoData } from "@/lib/todo";
import { formatDate } from "@/lib/format";

/**
 * „Was muss ich tun?" — persönliche Aufgabenliste ganz oben auf dem Dashboard.
 * Rendert nichts, wenn nichts offen ist (der Aufrufer prüft `gesamt`), damit der
 * Block nicht zur Tapete wird.
 */
export function TodoBlock({ todo }: { todo: TodoData }) {
  return (
    <section className="card border-accent/30 bg-accent/5 p-5">
      <h2 className="headline mb-3 text-lg text-accent-hi">Was für dich ansteht</h2>
      <ul className="space-y-2.5 text-sm">
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
