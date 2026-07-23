import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchTrash, purgeExpired, TRASH_LABEL } from "@/lib/trash";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { RestoreButton, PurgeButton } from "@/components/trash";
import { IconTrash } from "@/components/icons";

export const metadata = { title: "Papierkorb" };

export default async function PapierkorbPage() {
  const user = await requireUser();

  // Opportunistisch aufräumen: so bleibt der Papierkorb auch dann korrekt,
  // wenn der Cron-Job (npm run trash:purge) nicht eingerichtet ist.
  await purgeExpired();

  const eintraege = await fetchTrash();

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <IconTrash className="size-7 text-mute" />
        <h1 className="headline text-3xl">Papierkorb</h1>
      </div>
      <p className="mt-2 text-sm text-mute">
        Gelöschtes bleibt {TRASH_RETENTION_DAYS} Tage hier liegen und lässt sich
        bis dahin zurückholen. Danach wird es endgültig entfernt — auch die
        zugehörigen Dateien.
      </p>

      {eintraege.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-mute">
          Der Papierkorb ist leer.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {eintraege.map((eintrag) => (
            <li
              key={`${eintrag.kind}-${eintrag.id}`}
              className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="badge border-line text-faint">
                    {TRASH_LABEL[eintrag.kind]}
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {eintrag.label}
                  </span>
                </p>
                {/* Bewusst kein `truncate`: sonst fällt auf schmalen Schirmen
                    ausgerechnet das „von wem" hinten weg. */}
                <p className="mt-1 text-sm text-mute">
                  {eintrag.sublabel ? `${eintrag.sublabel} · ` : ""}
                  gelöscht {formatDateTime(eintrag.deletedAt)}
                  {eintrag.deletedByName ? ` von ${eintrag.deletedByName}` : ""}
                </p>
              </div>

              <span
                className={`mono-display shrink-0 text-xs ${
                  eintrag.restTage <= 3 ? "text-amber-400" : "text-faint"
                }`}
                title={`Wird in ${eintrag.restTage} Tagen endgültig gelöscht`}
              >
                noch {eintrag.restTage} {eintrag.restTage === 1 ? "Tag" : "Tage"}
              </span>

              <div className="flex shrink-0 flex-wrap gap-2">
                <RestoreButton
                  kind={eintrag.kind}
                  id={eintrag.id}
                  label={eintrag.label}
                />
                {user.role === "admin" && (
                  <PurgeButton
                    kind={eintrag.kind}
                    id={eintrag.id}
                    label={eintrag.label}
                    count={eintrag.count}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {user.role !== "admin" && eintraege.length > 0 && (
        <p className="mt-6 text-xs text-faint">
          Endgültig löschen kann nur ein Admin — das ist die einzige Aktion, die
          sich nicht mehr rückgängig machen lässt.
        </p>
      )}

      <p className="mt-8 text-xs text-faint">
        Der Papierkorb ist kein Backup. Er greift {TRASH_RETENTION_DAYS} Tage
        lang gegen versehentliches Löschen — gegen Platten- oder Serverausfälle
        hilft nur die Datensicherung.{" "}
        <Link href="/hilfe#papierkorb" className="underline hover:text-mute">
          Mehr dazu in der Hilfe
        </Link>
      </p>
    </div>
  );
}
