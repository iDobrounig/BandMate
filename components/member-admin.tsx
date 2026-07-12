"use client";

import { useActionState, useState } from "react";
import {
  createUser,
  setUserPassword,
  toggleUserActive,
  setUserRole,
} from "@/lib/actions/users";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { INSTRUMENT_SUGGESTIONS } from "@/lib/constants";
import type { User } from "@/lib/db/schema";

const initial: FormState = {};

export function NewMemberForm() {
  const [state, action] = useActionState(createUser, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" required />
        </div>
        <div>
          <label className="label">E-Mail</label>
          <input className="input" name="email" type="email" required />
        </div>
        <div>
          <label className="label">Startpasswort</label>
          <input
            className="input"
            name="password"
            type="text"
            minLength={8}
            required
            placeholder="mind. 8 Zeichen"
          />
        </div>
        <div>
          <label className="label">Instrument</label>
          <input
            className="input"
            name="instrument"
            list="instruments-admin"
            placeholder="z.B. Bass"
          />
          <datalist id="instruments-admin">
            {INSTRUMENT_SUGGESTIONS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-mute">
        <input type="checkbox" name="role" value="admin" className="size-4 accent-(--color-accent)" />
        Admin-Rechte geben
      </label>
      <FormMsg state={state} />
      <SubmitButton>Mitglied anlegen</SubmitButton>
    </form>
  );
}

function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, action] = useActionState(setUserPassword, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        className="input max-w-48"
        name="password"
        type="text"
        minLength={8}
        placeholder="Neues Passwort"
        required
      />
      <SubmitButton className="btn btn-sm" pendingText="Setze …">
        Passwort setzen
      </SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}

export function MemberRow({
  member,
  isSelf,
}: {
  member: User;
  isSelf: boolean;
}) {
  const [showReset, setShowReset] = useState(false);

  return (
    <div className={`card p-4 ${member.active ? "" : "opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {member.name}
            {member.role === "admin" && (
              <span className="badge ml-2 border-accent/40 bg-accent/10 text-accent-hi">
                Admin
              </span>
            )}
            {!member.active && (
              <span className="badge ml-2 border-line text-faint">
                deaktiviert
              </span>
            )}
          </p>
          <p className="truncate text-sm text-mute">
            {member.email}
            {member.instrument ? ` · ${member.instrument}` : ""}
          </p>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowReset((v) => !v)}
            >
              Passwort
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                setUserRole(member.id, member.role === "admin" ? "member" : "admin")
              }
            >
              {member.role === "admin" ? "Admin entfernen" : "Zum Admin machen"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (
                  member.active &&
                  !confirm(`${member.name} wirklich deaktivieren?`)
                )
                  return;
                void toggleUserActive(member.id);
              }}
            >
              {member.active ? "Deaktivieren" : "Aktivieren"}
            </button>
          </div>
        )}
      </div>
      {showReset && !isSelf && <ResetPasswordForm userId={member.id} />}
    </div>
  );
}
