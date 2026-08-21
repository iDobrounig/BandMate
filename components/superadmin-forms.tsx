"use client";

import { useActionState } from "react";
import { createBand, toggleBandActive, toggleUserGlobalActive } from "@/lib/actions/superadmin";
import { SubmitButton, FormMsg } from "@/components/form";
import type { FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function CreateBandForm() {
  const [state, action] = useActionState(createBand, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="cb-band">Bandname</label>
        <input id="cb-band" className="input" name="bandName" required placeholder="z.B. Die Nachtschwärmer" />
      </div>
      <div className="border-t border-line-soft pt-4">
        <p className="mb-3 text-sm text-mute">Erster Band-Admin (verwaltet die Band selbst):</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cb-name">Name</label>
            <input id="cb-name" className="input" name="adminName" required />
          </div>
          <div>
            <label className="label" htmlFor="cb-email">E-Mail</label>
            <input id="cb-email" className="input" name="adminEmail" type="email" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cb-pw">Startpasswort</label>
            <input
              id="cb-pw"
              className="input"
              name="adminPassword"
              type="text"
              minLength={8}
              required
              placeholder="mind. 8 Zeichen — der Person mitteilen"
            />
          </div>
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton>Band anlegen</SubmitButton>
    </form>
  );
}

export function ToggleBandButton({ bandId, active }: { bandId: number; active: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-danger" : ""}`}
      onClick={() => {
        if (active && !confirm("Band deaktivieren? Sie verschwindet für ihre Mitglieder.")) return;
        void toggleBandActive(bandId);
      }}
    >
      {active ? "Deaktivieren" : "Aktivieren"}
    </button>
  );
}

export function ToggleUserButton({
  userId,
  active,
  isSelf,
}: {
  userId: number;
  active: boolean;
  isSelf: boolean;
}) {
  if (isSelf) return null;
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-danger" : ""}`}
      onClick={() => {
        if (active && !confirm("Konto global sperren? Sperrt die Person aus allen Bands aus.")) return;
        void toggleUserGlobalActive(userId);
      }}
    >
      {active ? "Sperren" : "Entsperren"}
    </button>
  );
}
