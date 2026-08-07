"use client";

import { useId, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addSongToSetlist,
  addSetlistSection,
  addSetlistBreak,
  removeSetlistItem,
  reorderSetlist,
  updateSetlistItemNote,
  updateSetlistItemLabel,
  updateSetlistBreakSeconds,
} from "@/lib/actions/setlists";
import { summarizeSetlist, compareTarget } from "@/lib/setlist-structure";
import { formatDuration } from "@/lib/format";
import { useSavedHint, SavedHint } from "@/components/form";
import { IconGrip, IconClose } from "@/components/icons";

export type EditorItem = {
  id: number;
  kind: "song" | "section" | "break";
  songId: number | null;
  label: string | null;
  breakSeconds: number | null;
  note: string | null;
  title: string | null;
  artist: string | null;
  songKey: string | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
};

export type SongOption = {
  id: number;
  title: string;
  artist: string | null;
  status: string;
};

function SortableRow({
  item,
  displayNumber,
  summary,
  onRemove,
}: {
  item: EditorItem;
  displayNumber: number;
  summary?: { songCount: number; seconds: number };
  onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [note, setNote] = useState(item.note ?? "");
  const [saved, showSaved] = useSavedHint();

  const grip = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none px-1 text-faint hover:text-ink active:cursor-grabbing shrink-0"
      title="Ziehen zum Umsortieren"
    >
      <IconGrip className="size-4" />
    </button>
  );

  if (item.kind === "section") {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 p-2 ${
          isDragging ? "z-10 shadow-lg" : ""
        }`}
      >
        {grip}
        <input
          defaultValue={item.label ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (item.label ?? "")) {
              void updateSetlistItemLabel(item.id, e.target.value);
              showSaved();
            }
          }}
          placeholder="Set-Name"
          aria-label="Set-Name"
          className="input flex-1 border-none bg-transparent px-1 py-0.5 font-semibold text-accent-hi"
        />
        <SavedHint show={saved} />
        {summary && (
          <span className="mono-display shrink-0 text-xs text-mute">
            {summary.songCount} {summary.songCount === 1 ? "Song" : "Songs"} ·{" "}
            {formatDuration(summary.seconds)}
          </span>
        )}
        <button
          type="button"
          className="link-danger px-2 shrink-0"
          onClick={() => onRemove(item.id)}
          title="Set-Überschrift entfernen"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    );
  }

  if (item.kind === "break") {
    const minutes = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 rounded-lg border border-dashed border-line p-2 text-sm ${
          isDragging ? "z-10 shadow-lg" : ""
        }`}
      >
        {grip}
        <span className="shrink-0 text-mute">Pause</span>
        <input
          type="number"
          min="0"
          defaultValue={minutes}
          onBlur={(e) => {
            const m = Number(e.target.value);
            if (m * 60 !== (item.breakSeconds ?? 0)) {
              void updateSetlistBreakSeconds(item.id, (Number.isFinite(m) ? m : 0) * 60);
              showSaved();
            }
          }}
          aria-label="Pausendauer (Minuten)"
          className="input w-16 py-1 text-center text-xs"
        />
        <span className="shrink-0 text-faint">min</span>
        <input
          defaultValue={item.label ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (item.label ?? "")) {
              void updateSetlistItemLabel(item.id, e.target.value);
              showSaved();
            }
          }}
          placeholder="Label (optional, z.B. Umbau)"
          aria-label="Pausen-Label"
          className="input flex-1 py-1 text-xs"
        />
        <SavedHint show={saved} />
        <button
          type="button"
          className="link-danger px-2 shrink-0"
          onClick={() => onRemove(item.id)}
          title="Pause entfernen"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 ${
        isDragging ? "z-10 border-accent/60 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
        {grip}
        <span className="mono-display w-6 shrink-0 text-right text-sm text-faint">
          {displayNumber}.
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`/songs/${item.songId}`}
            className="block truncate font-semibold hover:text-accent-hi"
          >
            {item.title ?? ""}
          </a>
          <p className="mono-display truncate text-xs text-mute">
            {[
              item.artist,
              item.songKey,
              item.tempoBpm ? `${item.tempoBpm} BPM` : null,
              item.durationSeconds ? formatDuration(item.durationSeconds) : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <button
          type="button"
          className="link-danger px-2 sm:hidden shrink-0"
          onClick={() => onRemove(item.id)}
          title="Aus Setliste entfernen"
        >
          <IconClose className="size-4" />
        </button>
      </div>
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto shrink-0">
        <input
          className="input flex-1 sm:max-w-44 py-1 text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (item.note ?? "")) {
              void updateSetlistItemNote(item.id, note);
              showSaved();
            }
          }}
          placeholder="Notiz (z.B. Solo verlängern)"
        />
        <SavedHint show={saved} />
        <button
          type="button"
          className="link-danger hidden px-1 sm:block"
          onClick={() => onRemove(item.id)}
          title="Aus Setliste entfernen"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SetlistEditor({
  setlistId,
  items: serverItems,
  songOptions,
  targetSeconds,
}: {
  setlistId: number;
  items: EditorItem[];
  songOptions: SongOption[];
  targetSeconds?: number | null;
}) {
  const [items, setItems] = useState(serverItems);
  const [, startTransition] = useTransition();
  const [selectedSong, setSelectedSong] = useState("");
  // Stabile ID für den DndContext: sonst erzeugt dnd-kit die aria-describedby-IDs
  // der Drag-Griffe über einen globalen Zähler, der zwischen Server- und
  // Client-Render divergiert → Hydration-Mismatch.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(() =>
      reorderSetlist(
        setlistId,
        next.map((i) => i.id)
      )
    );
  };

  const remove = (itemId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    startTransition(() => removeSetlistItem(itemId));
  };

  const structure = summarizeSetlist(
    items.map((i) => ({
      kind: i.kind,
      label: i.label,
      durationSeconds: i.durationSeconds,
      breakSeconds: i.breakSeconds,
    }))
  );
  const cmp = compareTarget(structure.totalSeconds, targetSeconds ?? null);

  // Song-Nummer je Set (Reset bei jeder Überschrift) + Zwischensumme je section-Zeile.
  const songNumbers = new Map<number, number>();
  const sectionSummaries = new Map<number, { songCount: number; seconds: number }>();
  {
    let n = 0;
    let curSongCount = 0;
    let curSeconds = 0;
    let curSectionId: number | null = null;
    const flush = () => {
      if (curSectionId != null)
        sectionSummaries.set(curSectionId, { songCount: curSongCount, seconds: curSeconds });
    };
    for (const it of items) {
      if (it.kind === "section") {
        flush();
        curSectionId = it.id;
        curSongCount = 0;
        curSeconds = 0;
        n = 0;
      } else if (it.kind === "song") {
        n += 1;
        songNumbers.set(it.id, n);
        curSongCount += 1;
        curSeconds += it.durationSeconds ?? 0;
      }
    }
    flush();
  }

  const songCount = items.filter((i) => i.kind === "song").length;
  const missingDuration = items.filter(
    (i) => i.kind === "song" && !i.durationSeconds
  ).length;

  const availableSongs = songOptions.filter(
    (s) => !items.some((i) => i.songId === s.id)
  );

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:flex-wrap">
        <select
          className="input w-full min-w-0 sm:max-w-xs sm:flex-1"
          value={selectedSong}
          onChange={(e) => setSelectedSong(e.target.value)}
        >
          <option value="">Song hinzufügen …</option>
          {availableSongs.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}
              {song.artist ? ` – ${song.artist}` : ""}
              {song.status !== "repertoire" ? " (nicht im Repertoire)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn w-full sm:w-auto"
          disabled={!selectedSong}
          onClick={() => {
            const songId = Number(selectedSong);
            setSelectedSong("");
            startTransition(() => addSongToSetlist(setlistId, songId));
          }}
        >
          + Hinzufügen
        </button>
        <button
          type="button"
          className="btn w-full sm:w-auto"
          onClick={() => startTransition(() => addSetlistSection(setlistId))}
        >
          + Set-Überschrift
        </button>
        <button
          type="button"
          className="btn w-full sm:w-auto"
          onClick={() => startTransition(() => addSetlistBreak(setlistId))}
        >
          + Pause
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-mute">
          Noch keine Songs — füge oben welche aus dem Repertoire hinzu.
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  displayNumber={songNumbers.get(item.id) ?? 0}
                  summary={sectionSummaries.get(item.id)}
                  onRemove={remove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mono-display space-y-1 text-sm text-mute">
        <p>
          {songCount} {songCount === 1 ? "Song" : "Songs"} · Musik{" "}
          {formatDuration(structure.musicSeconds)}
          {structure.breakSeconds > 0 &&
            ` · Pausen ${formatDuration(structure.breakSeconds)} · Gesamt ${formatDuration(structure.totalSeconds)}`}
          {missingDuration > 0 && ` (${missingDuration} ohne Zeitangabe)`}
        </p>
        {cmp && (
          <p className={cmp.over ? "text-red-400" : "text-emerald-400"}>
            Ziel {formatDuration(targetSeconds!)} → {formatDuration(cmp.diffSeconds)}{" "}
            {cmp.over ? "über" : "unter"}
          </p>
        )}
      </div>
    </div>
  );
}
