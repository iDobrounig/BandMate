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
}: {
  songId: number;
  status: SongStatus;
  title: string;
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
          if (confirm(`„${title}" samt allen Dateien und Kommentaren löschen?`))
            startTransition(() => deleteSong(songId));
        }}
      >
        Löschen
      </button>
    </div>
  );
}
