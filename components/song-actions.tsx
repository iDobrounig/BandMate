"use client";

import { useTransition } from "react";
import { setSongStatus, deleteSong } from "@/lib/actions/songs";
import { SONG_STATUS, STATUS_ORDER } from "@/lib/constants";
import type { SongStatus } from "@/lib/db/schema";

/** Status-Wechsel mit hervorgehobenem "nächsten Schritt" + Song löschen. */
export function SongStatusActions({
  songId,
  status,
  title,
  setlistCount,
  agendaCount,
}: {
  songId: number;
  status: SongStatus;
  title: string;
  setlistCount: number;
  agendaCount: number;
}) {
  const [pending, startTransition] = useTransition();

  const nextStep: Partial<Record<SongStatus, { to: SongStatus; label: string }>> = {
    suggestion: { to: "rehearsing", label: "→ In Probe nehmen" },
    rehearsing: { to: "repertoire", label: "→ Ins Repertoire übernehmen" },
    repertoire: { to: "archived", label: "→ Archivieren" },
  };
  const next = nextStep[status];
  const others = STATUS_ORDER.filter((s) => s !== status && s !== next?.to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <button
          type="button"
          disabled={pending}
          className="btn btn-primary btn-sm"
          onClick={() => startTransition(() => setSongStatus(songId, next.to))}
        >
          {next.label}
        </button>
      )}
      {others.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          className="btn btn-sm"
          onClick={() => startTransition(() => setSongStatus(songId, s))}
        >
          {SONG_STATUS[s].label}
        </button>
      ))}
      <button
        type="button"
        disabled={pending}
        className="btn btn-sm btn-danger"
        onClick={() => {
          // Verweise bleiben beim Soft Delete stehen und werden nur
          // ausgeblendet — die Setliste schrumpft also scheinbar grundlos.
          // Deshalb vorher sagen, was passieren wird.
          const orte = [
            setlistCount > 0 &&
              `${setlistCount} ${setlistCount === 1 ? "Setliste" : "Setlisten"}`,
            agendaCount > 0 &&
              `${agendaCount} ${agendaCount === 1 ? "Probe-Agenda" : "Probe-Agenden"}`,
          ].filter(Boolean);
          const hinweis = orte.length
            ? `\n\nKommt in ${orte.join(" und ")} vor und verschwindet dort.`
            : "";
          if (
            confirm(
              `„${title}" in den Papierkorb legen?${hinweis}\n\nNoten, Aufnahmen und Kommentare bleiben erhalten und kommen bei einer Wiederherstellung mit zurück.`
            )
          )
            startTransition(() => deleteSong(songId));
        }}
      >
        In den Papierkorb
      </button>
    </div>
  );
}
