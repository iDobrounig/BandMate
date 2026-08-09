"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createSong, updateSong, checkDuplicateTitle, type DuplicateMatch } from "@/lib/actions/songs";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { IconClose } from "@/components/icons";
import { INSTRUMENT_SUGGESTIONS, SONG_STATUS } from "@/lib/constants";
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

  // Dubletten-Warnung: nur beim Anlegen, nicht beim Bearbeiten.
  const [title, setTitle] = useState(song?.title ?? "");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    setConfirmed(false);
    if (title.trim().length < 2) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(() => {
      checkDuplicateTitle(title).then(setDuplicates);
    }, 400);
    return () => clearTimeout(timer);
  }, [title, isEdit]);

  const blockedByDuplicates = !isEdit && duplicates.length > 0 && !confirmed;

  const addRow = () =>
    setLinkRows((rows) => [...rows, { id: Date.now(), url: "", label: "" }]);
  const removeRow = (id: number) =>
    setLinkRows((rows) => rows.filter((r) => r.id !== id));

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="songId" value={song!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sf-title">Titel *</label>
          <input
            id="sf-title"
            className="input text-lg"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus={!isEdit}
          />
          {!isEdit && duplicates.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <p className="mb-2">Gibt&apos;s schon:</p>
              <ul className="mb-3 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/songs/${d.id}`}
                      target="_blank"
                      rel="noopener"
                      className="underline hover:no-underline"
                    >
                      {d.title}
                      {d.artist ? ` – ${d.artist}` : ""}
                    </Link>{" "}
                    <span className="text-xs">({SONG_STATUS[d.status].label})</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="size-4 accent-(--color-accent)"
                />
                Trotzdem anlegen
              </label>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sf-artist">Interpret / Original</label>
          <input
            id="sf-artist"
            className="input"
            name="artist"
            defaultValue={song?.artist ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="sf-tempo">Tempo (BPM)</label>
          <input
            id="sf-tempo"
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
          <label className="label" htmlFor="sf-key">Tonart</label>
          <input
            id="sf-key"
            className="input mono-display"
            name="songKey"
            defaultValue={song?.songKey ?? ""}
            placeholder="z.B. Am, G-Dur"
          />
        </div>
        <div>
          <label className="label" htmlFor="sf-capo">Capo (Bund)</label>
          <input
            id="sf-capo"
            className="input mono-display"
            name="capo"
            type="number"
            min={0}
            max={12}
            defaultValue={song?.capo ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="sf-duration">Dauer (min:sek)</label>
          <input
            id="sf-duration"
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
        <h3 className="label">Links (YouTube, Spotify, Tabs, …)</h3>
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
                    <IconClose className="size-3.5" />
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
            <label className="label" htmlFor="sf-audio">Audio-Datei (optional)</label>
            <input
              id="sf-audio"
              className="input"
              name="audioFile"
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,.flac,audio/*"
            />
            <p className="mt-1 text-xs text-faint">MP3, M4A, WAV … max. 50 MB</p>
          </div>
          <div>
            <label className="label" htmlFor="sf-sheet">Noten (optional)</label>
            <input
              id="sf-sheet"
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
              aria-label="Für welches Instrument?"
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
        <label className="label" htmlFor="sf-lyrics">Lyrics / Akkorde</label>
        <textarea
          id="sf-lyrics"
          className="input mono-display min-h-48 text-sm leading-relaxed"
          name="lyricsChords"
          defaultValue={song?.lyricsChords ?? ""}
          placeholder={"[Verse]\nAm        F         C\nBeispieltext …"}
        />
      </div>

      <div>
        <label className="label" htmlFor="sf-notes">Notizen</label>
        <textarea
          id="sf-notes"
          className="input min-h-20"
          name="notes"
          defaultValue={song?.notes ?? ""}
          placeholder="z.B. Arrangement-Ideen, wer singt, …"
        />
      </div>

      <FormMsg state={state} />
      <div className="flex gap-3">
        <SubmitButton
          pendingText={isEdit ? "Speichern …" : "Anlegen …"}
          disabled={blockedByDuplicates}
        >
          {isEdit ? "Änderungen speichern" : "Song vorschlagen"}
        </SubmitButton>
      </div>
    </form>
  );
}
