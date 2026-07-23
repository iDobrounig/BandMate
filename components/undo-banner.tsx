import Link from "next/link";
import { fetchTrashLabel, parseUndo } from "@/lib/trash";
import { RestoreButton } from "@/components/trash";
import { IconTrash } from "@/components/icons";

/**
 * „Rückgängig" direkt nach dem Löschen (Entwurf E4). Der häufigste Fehlerfall
 * ist der Fehltipp, und der fällt in derselben Sekunde auf — dafür ist ein
 * Papierkorb, den man nicht kennt, nutzlos.
 *
 * Rendert nichts, wenn der Eintrag inzwischen wiederhergestellt oder endgültig
 * gelöscht wurde: dann ist das Band gegenstandslos (z.B. nach Reload).
 */
export async function UndoBanner({ undo }: { undo: string | undefined }) {
  const ziel = parseUndo(undo);
  if (!ziel) return null;

  const label = await fetchTrashLabel(ziel.kind, ziel.id);
  if (!label) return null;

  return (
    <div className="card mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 border-accent/40 bg-accent/5 p-4">
      <IconTrash className="size-5 shrink-0 text-accent" />
      {/* basis-full: am Handy gehören die Buttons unter den Text. Ohne das
          schrumpft der Titel auf eine Spalte von zwei Wörtern Breite. */}
      <p className="min-w-0 flex-1 basis-[calc(100%-2rem)] text-sm sm:basis-auto">
        <span className="font-semibold">„{label}"</span> liegt jetzt im
        Papierkorb.
      </p>
      <div className="flex shrink-0 gap-2">
        <RestoreButton
          kind={ziel.kind}
          id={ziel.id}
          className="btn btn-primary btn-sm"
        >
          Rückgängig
        </RestoreButton>
        <Link href="/papierkorb" className="btn btn-sm">
          Papierkorb
        </Link>
      </div>
    </div>
  );
}
