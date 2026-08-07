"use client";

import { useActionState, useTransition } from "react";
import {
  createSetlist,
  updateSetlist,
  deleteSetlist,
} from "@/lib/actions/setlists";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import type { Setlist } from "@/lib/db/schema";

const initial: FormState = {};

export function SetlistForm({ setlist }: { setlist?: Setlist }) {
  const isEdit = Boolean(setlist);
  const [state, action] = useActionState(
    isEdit ? updateSetlist : createSetlist,
    initial
  );

  return (
    <form action={action} className="space-y-4">
      {isEdit && <input type="hidden" name="setlistId" value={setlist!.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sl-name">Name</label>
          <input
            id="sl-name"
            className="input"
            name="name"
            defaultValue={setlist?.name ?? ""}
            placeholder="z.B. Sommerfest 2026"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="sl-eventDate">Datum (optional)</label>
          <input
            id="sl-eventDate"
            className="input"
            name="eventDate"
            type="date"
            defaultValue={setlist?.eventDate ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sl-notes">Notizen</label>
        <textarea
          id="sl-notes"
          className="input min-h-16"
          name="notes"
          defaultValue={setlist?.notes ?? ""}
          placeholder="z.B. Location, Anspielzeit, Besetzung …"
        />
      </div>
      <div>
        <label className="label" htmlFor="sl-target">Zielzeit (Minuten, optional)</label>
        <input
          id="sl-target"
          className="input"
          name="targetMinutes"
          type="number"
          inputMode="numeric"
          min="0"
          defaultValue={setlist?.targetSeconds ? Math.round(setlist.targetSeconds / 60) : ""}
          placeholder="z.B. 90"
        />
        <p className="mt-1 text-xs text-faint">
          Gebuchte Spielzeit für den Abgleich.
        </p>
      </div>
      <FormMsg state={state} />
      <SubmitButton>{isEdit ? "Speichern" : "Setliste anlegen"}</SubmitButton>
    </form>
  );
}

export function DeleteSetlistButton({
  setlistId,
  name,
}: {
  setlistId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-sm btn-danger"
      onClick={() => {
        if (
          confirm(
            `Setliste „${name}" in den Papierkorb legen?\n\nDie Songs selbst bleiben unberührt.`
          )
        )
          startTransition(() => deleteSetlist(setlistId));
      }}
    >
      In den Papierkorb
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      🖨 Drucken / PDF
    </button>
  );
}
