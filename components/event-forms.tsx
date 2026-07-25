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
        <label className="label" htmlFor="ev-title">Titel</label>
        <input
          id="ev-title"
          className="input"
          name="title"
          defaultValue={event?.title ?? ""}
          placeholder={kind === "gig" ? "z.B. Stadtfest Hauptbühne" : "z.B. Bandprobe"}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-date">Datum</label>
          <input
            id="ev-date"
            className="input"
            name="date"
            type="date"
            defaultValue={event?.date ?? ""}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ev-startTime">
            {kind === "gig" ? "Load-in (optional)" : "Uhrzeit (optional)"}
          </label>
          <input
            id="ev-startTime"
            className="input"
            name="startTime"
            type="time"
            defaultValue={event?.startTime ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ev-location">Ort (optional)</label>
        <input
          id="ev-location"
          className="input"
          name="location"
          defaultValue={event?.location ?? ""}
          placeholder="z.B. Proberaum"
        />
      </div>
      <div>
        <label className="label" htmlFor="ev-setlistId">Setliste (optional)</label>
        <select
          id="ev-setlistId"
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
        <label className="label" htmlFor="ev-notes">Notizen</label>
        <textarea
          id="ev-notes"
          className="input min-h-16"
          name="notes"
          defaultValue={event?.notes ?? ""}
        />
      </div>

      {kind === "gig" && (
        <div className="space-y-4 rounded-lg border border-line-soft p-3">
          <p className="label !mb-0">Gig-Logistik</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-soundcheck">Soundcheck</label>
              <input
                id="ev-soundcheck"
                className="input"
                name="soundcheckTime"
                type="time"
                defaultValue={event?.soundcheckTime ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-stage">Auftritt</label>
              <input
                id="ev-stage"
                className="input"
                name="stageTime"
                type="time"
                defaultValue={event?.stageTime ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-contactName">Ansprechpartner</label>
              <input
                id="ev-contactName"
                className="input"
                name="contactName"
                defaultValue={event?.contactName ?? ""}
                placeholder="z.B. Max Huber"
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-contactPhone">Telefon</label>
              <input
                id="ev-contactPhone"
                className="input"
                name="contactPhone"
                type="tel"
                defaultValue={event?.contactPhone ?? ""}
                placeholder="z.B. 0664 1234567"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-fee">Gage (€)</label>
              <input
                id="ev-fee"
                className="input"
                name="fee"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={event?.fee ?? ""}
                placeholder="z.B. 400"
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-feeExtras">Verpflegung &amp; Extras</label>
              <input
                id="ev-feeExtras"
                className="input"
                name="feeExtras"
                defaultValue={event?.feeExtras ?? ""}
                placeholder="z.B. warmes Essen, 2 Kisten Bier"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ev-travel">Anfahrt &amp; Parken</label>
            <textarea
              id="ev-travel"
              className="input min-h-16"
              name="travelNotes"
              defaultValue={event?.travelNotes ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-backline">Backline &amp; Technik</label>
            <textarea
              id="ev-backline"
              className="input min-h-16"
              name="backlineNotes"
              defaultValue={event?.backlineNotes ?? ""}
            />
          </div>
        </div>
      )}

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

      <label className="flex items-center gap-2 text-sm text-mute">
        <input
          type="checkbox"
          name="sendMail"
          // Beim Anlegen vorausgewählt; beim Bearbeiten ebenfalls, aber die
          // Mail geht nur raus, wenn sich wirklich Datum, Uhrzeit oder Ort
          // geändert hat (siehe updateEvent).
          defaultChecked
          className="size-4 accent-(--color-accent)"
        />
        {isEdit
          ? "Band bei Änderung von Datum/Uhrzeit/Ort benachrichtigen"
          : "Band per E-Mail benachrichtigen"}
      </label>

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
          if (confirm("Diesen Termin in den Papierkorb legen?"))
            startTransition(() => deleteEvent(eventId, "single"));
        }}
      >
        {isSeries ? "Nur diesen Termin" : "In den Papierkorb"}
      </button>
      {isSeries && (
        <button
          type="button"
          disabled={pending}
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (
            confirm(
              "Die GANZE Serie in den Papierkorb legen?\n\nAlle Termine der Serie landen als ein Eintrag dort und lassen sich gemeinsam zurückholen."
            )
          )
              startTransition(() => deleteEvent(eventId, "series"));
          }}
        >
          Ganze Serie
        </button>
      )}
    </div>
  );
}
