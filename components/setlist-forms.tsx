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
          <label className="label">Name</label>
          <input
            className="input"
            name="name"
            defaultValue={setlist?.name ?? ""}
            placeholder="z.B. Sommerfest 2026"
            required
          />
        </div>
        <div>
          <label className="label">Datum (optional)</label>
          <input
            className="input"
            name="eventDate"
            type="date"
            defaultValue={setlist?.eventDate ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label">Notizen</label>
        <textarea
          className="input min-h-16"
          name="notes"
          defaultValue={setlist?.notes ?? ""}
          placeholder="z.B. Location, Anspielzeit, Besetzung …"
        />
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
