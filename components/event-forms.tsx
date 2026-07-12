"use client";

import { useActionState, useState, useTransition } from "react";
import { createEvent, updateEvent, deleteEvent } from "@/lib/actions/events";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import type { BandEvent, EventKind } from "@/lib/db/schema";

const initial: FormState = {};

export function EventForm({
  event,
  setlistOptions,
}: {
  event?: BandEvent;
  setlistOptions: { id: number; name: string }[];
}) {
  const isEdit = Boolean(event);
  const [state, action] = useActionState(isEdit ? updateEvent : createEvent, initial);
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "rehearsal");
  const [repeat, setRepeat] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="eventId" value={event!.id} />}

      <div className="flex gap-2">
        {(
          [
            ["rehearsal", "Probe"],
            ["gig", "Gig"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`btn btn-sm cursor-pointer ${
              kind === value
                ? value === "gig"
                  ? "border-accent bg-accent/15 text-accent-hi"
                  : "border-sky-500/60 bg-sky-500/15 text-sky-300"
                : ""
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>

      <div>
        <label className="label">Titel</label>
        <input
          className="input"
          name="title"
          defaultValue={event?.title ?? ""}
          placeholder={kind === "gig" ? "z.B. Stadtfest Hauptbühne" : "z.B. Bandprobe"}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Datum</label>
          <input
            className="input"
            name="date"
            type="date"
            defaultValue={event?.date ?? ""}
            required
          />
        </div>
        <div>
          <label className="label">Uhrzeit (optional)</label>
          <input
            className="input"
            name="startTime"
            type="time"
            defaultValue={event?.startTime ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label">Ort (optional)</label>
        <input
          className="input"
          name="location"
          defaultValue={event?.location ?? ""}
          placeholder="z.B. Proberaum"
        />
      </div>
      <div>
        <label className="label">Setliste (optional)</label>
        <select
          className="input"
          name="setlistId"
          defaultValue={event?.setlistId ?? ""}
        >
          <option value="">— keine —</option>
          {setlistOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Notizen</label>
        <textarea
          className="input min-h-16"
          name="notes"
          defaultValue={event?.notes ?? ""}
        />
      </div>

      {!isEdit && (
        <div className="space-y-2 rounded-lg border border-line-soft p-3">
          <label className="flex items-center gap-2 text-sm text-mute">
            <input
              type="checkbox"
              name="repeatWeekly"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="size-4 accent-(--color-accent)"
            />
            Wöchentlich wiederholen
          </label>
          {repeat && (
            <div>
              <label className="label">Wiederholen bis</label>
              <input className="input" name="repeatUntil" type="date" required />
              <p className="mt-1 text-xs text-faint">
                Erzeugt einzelne Termine (max. 30), die auch einzeln absagbar sind.
              </p>
            </div>
          )}
        </div>
      )}

      {!isEdit && (
        <label className="flex items-center gap-2 text-sm text-mute">
          <input
            type="checkbox"
            name="sendMail"
            className="size-4 accent-(--color-accent)"
          />
          Band per E-Mail benachrichtigen
        </label>
      )}

      <FormMsg state={state} />
      <SubmitButton>{isEdit ? "Speichern" : "Termin anlegen"}</SubmitButton>
    </form>
  );
}

export function DeleteEventButtons({
  eventId,
  isSeries,
}: {
  eventId: number;
  isSeries: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn btn-sm btn-danger"
        onClick={() => {
          if (confirm("Diesen Termin löschen?"))
            startTransition(() => deleteEvent(eventId, "single"));
        }}
      >
        {isSeries ? "Nur diesen Termin löschen" : "Termin löschen"}
      </button>
      {isSeries && (
        <button
          type="button"
          disabled={pending}
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm("Wirklich die GANZE Serie löschen?"))
              startTransition(() => deleteEvent(eventId, "series"));
          }}
        >
          Ganze Serie löschen
        </button>
      )}
    </div>
  );
}
