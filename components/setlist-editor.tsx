"use client";

import { useState, useTransition } from "react";
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
  removeSetlistItem,
  reorderSetlist,
  updateSetlistItemNote,
} from "@/lib/actions/setlists";
import { formatDuration } from "@/lib/format";

export type EditorItem = {
  id: number;
  songId: number;
  note: string | null;
  title: string;
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
  index,
  onRemove,
}: {
  item: EditorItem;
  index: number;
  onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-center gap-3 p-3 ${
        isDragging ? "z-10 border-accent/60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-1 text-lg text-faint hover:text-ink active:cursor-grabbing"
        title="Ziehen zum Umsortieren"
      >
        ⠿
      </button>
      <span className="mono-display w-6 shrink-0 text-right text-sm text-faint">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={`/songs/${item.songId}`}
          className="block truncate font-semibold hover:text-accent-hi"
        >
          {item.title}
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
      <input
        className="input hidden max-w-44 py-1 text-xs sm:block"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (note !== (item.note ?? ""))
            void updateSetlistItemNote(item.id, note);
        }}
        placeholder="Notiz (z.B. Pause danach)"
      />
      <button
        type="button"
        className="px-1 text-faint transition hover:text-red-400 cursor-pointer"
        onClick={() => onRemove(item.id)}
        title="Aus Setliste entfernen"
      >
        ✕
      </button>
    </div>
  );
}

export function SetlistEditor({
  setlistId,
  items: serverItems,
  songOptions,
}: {
  setlistId: number;
  items: EditorItem[];
  songOptions: SongOption[];
}) {
  const [items, setItems] = useState(serverItems);
  const [, startTransition] = useTransition();
  const [selectedSong, setSelectedSong] = useState("");

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

  const totalSeconds = items.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0);
  const withDuration = items.filter((i) => i.durationSeconds).length;

  const availableSongs = songOptions.filter(
    (s) => !items.some((i) => i.songId === s.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input max-w-md flex-1"
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
          className="btn"
          disabled={!selectedSong}
          onClick={() => {
            const songId = Number(selectedSong);
            setSelectedSong("");
            startTransition(() => addSongToSetlist(setlistId, songId));
          }}
        >
          + Hinzufügen
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-mute">
          Noch keine Songs — füge oben welche aus dem Repertoire hinzu.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  index={index}
                  onRemove={remove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <p className="mono-display text-sm text-mute">
        {items.length} Songs · Gesamtdauer {formatDuration(totalSeconds)}
        {withDuration < items.length &&
          ` (${items.length - withDuration} ohne Zeitangabe)`}
      </p>
    </div>
  );
}
