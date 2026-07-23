"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addSongToEvent, removeEventSong } from "@/lib/actions/events";

export type AgendaItem = {
  id: number;
  songId: number;
  title: string;
  artist: string | null;
  songKey: string | null;
  tempoBpm: number | null;
  readyCount: number;
};

export type AgendaSongOption = {
  id: number;
  title: string;
  artist: string | null;
};

export function EventAgenda({
  eventId,
  items,
  songOptions,
  memberCount,
}: {
  eventId: number;
  items: AgendaItem[];
  songOptions: AgendaSongOption[];
  memberCount: number;
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  const available = songOptions.filter(
    (s) => !items.some((i) => i.songId === s.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="input max-w-md flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Song für diese Probe auswählen …</option>
          {available.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}
              {song.artist ? ` – ${song.artist}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={!selected || pending}
          onClick={() => {
            const songId = Number(selected);
            setSelected("");
            startTransition(() => addSongToEvent(eventId, songId));
          }}
        >
          + Auf die Agenda
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-faint">
          Noch keine Songs geplant — was probt ihr an diesem Termin?
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="card flex items-center gap-3 p-3">
              <span className="mono-display w-6 shrink-0 text-right text-sm text-faint">
                {index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/songs/${item.songId}`}
                  className="block truncate font-semibold hover:text-accent-hi"
                >
                  {item.title}
                </Link>
                <p className="mono-display truncate text-xs text-mute">
                  {[
                    item.artist,
                    item.songKey,
                    item.tempoBpm ? `${item.tempoBpm} BPM` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <span
                className="mono-display shrink-0 text-xs"
                title="Mitglieder, die den Song schon können"
              >
                <span className={item.readyCount >= memberCount ? "text-emerald-400" : "text-mute"}>
                  ✓ {item.readyCount}/{memberCount}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                className="link-danger px-1"
                onClick={() => startTransition(() => removeEventSong(item.id))}
                title="Von der Agenda nehmen"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
