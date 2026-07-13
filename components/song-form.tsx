"use client";

import { useActionState, useState } from "react";
import { createSong, updateSong } from "@/lib/actions/songs";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { INSTRUMENT_SUGGESTIONS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { Song, SongLink } from "@/lib/db/schema";

const initial: FormState = {};

type LinkRow = { id: number; url: string; label: string };

export function SongForm({
  song,
  links,
}: {
  song?: Song;
  links?: SongLink[];
}) {
  const isEdit = Boolean(song);
  const [state, action] = useActionState(isEdit ? updateSong : createSong, initial);
  const [linkRows, setLinkRows] = useState<LinkRow[]>(() =>
    links && links.length > 0
      ? links.map((l, i) => ({ id: i, url: l.url, label: l.label ?? "" }))
      : [{ id: 0, url: "", label: "" }]
  );

  const addRow = () =>
    setLinkRows((rows) => [...rows, { id: Date.now(), url: "", label: "" }]);
  const removeRow = (id: number) =>
    setLinkRows((rows) => rows.filter((r) => r.id !== id));

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="songId" value={song!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titel *</label>
          <input
            className="input text-lg"
            name="title"
            defaultValue={song?.title ?? ""}
            required
            autoFocus={!isEdit}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Interpret / Original</label>
          <input className="input" name="artist" defaultValue={song?.artist ?? ""} />
        </div>
        <div>
          <label className="label">Tempo (BPM)</label>
          <input
            className="input mono-display"
            name="tempoBpm"
            type="number"
            min={20}
            max={300}
            defaultValue={song?.tempoBpm ?? ""}
            placeholder="120"
          />
        </div>
        <div>
          <label className="label">Tonart</label>
          <input
            className="input mono-display"
            name="songKey"
            defaultValue={song?.songKey ?? ""}
            placeholder="z.B. Am, G-Dur"
          />
        </div>
        <div>
          <label className="label">Capo (Bund)</label>
          <input
            className="input mono-display"
            name="capo"
            type="number"
            min={0}
            max={12}
            defaultValue={song?.capo ?? ""}
          />
        </div>
        <div>
          <label className="label">Dauer (min:sek)</label>
          <input
            className="input mono-display"
            name="duration"
            defaultValue={
              song?.durationSeconds ? formatDuration(song.durationSeconds) : ""
            }
            placeholder="3:45"
            pattern="^\d+:[0-5]?\d$|^\d+$"
          />
        </div>
      </div>

      <div>
        <label className="label">Links (YouTube, Spotify, Tabs, …)</label>
        <div className="space-y-3">
          {linkRows.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 border-b border-line-soft/40 pb-3 sm:flex-row sm:border-0 sm:pb-0">
              <input
                className="input sm:flex-[2]"
                name="linkUrl"
                type="url"
                defaultValue={row.url}
                placeholder="https://…"
              />
              <div className="flex gap-2 w-full sm:flex-1">
                <input
                  className="input flex-1"
                  name="linkLabel"
                  defaultValue={row.label}
                  placeholder="Bezeichnung (optional)"
                />
                {linkRows.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger self-center px-3"
                    onClick={() => removeRow(row.id)}
                    title="Link entfernen"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm mt-2" onClick={addRow}>
          + weiterer Link
        </button>
      </div>

      {!isEdit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Audio-Datei (optional)</label>
            <input
              className="input"
              name="audioFile"
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,.flac,audio/*"
            />
            <p className="mt-1 text-xs text-faint">MP3, M4A, WAV … max. 50 MB</p>
          </div>
          <div>
            <label className="label">Noten (optional)</label>
            <input
              className="input"
              name="sheetFile"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
            />
            <input
              className="input mt-2"
              name="sheetInstrument"
              list="instruments-song"
              placeholder="Für welches Instrument?"
            />
            <datalist id="instruments-song">
              {INSTRUMENT_SUGGESTIONS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <div>
        <label className="label">Lyrics / Akkorde</label>
        <textarea
          className="input mono-display min-h-48 text-sm leading-relaxed"
          name="lyricsChords"
          defaultValue={song?.lyricsChords ?? ""}
          placeholder={"[Verse]\nAm        F         C\nBeispieltext …"}
        />
      </div>

      <div>
        <label className="label">Notizen</label>
        <textarea
          className="input min-h-20"
          name="notes"
          defaultValue={song?.notes ?? ""}
          placeholder="z.B. Arrangement-Ideen, wer singt, …"
        />
      </div>

      <FormMsg state={state} />
      <div className="flex gap-3">
        <SubmitButton pendingText={isEdit ? "Speichern …" : "Anlegen …"}>
          {isEdit ? "Änderungen speichern" : "Song vorschlagen"}
        </SubmitButton>
      </div>
    </form>
  );
}
