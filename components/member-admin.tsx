"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createUser,
  updateUser,
  setUserPassword,
  toggleUserActive,
  setUserRole,
} from "@/lib/actions/users";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { INSTRUMENT_SUGGESTIONS } from "@/lib/constants";
import { NotifyMatrix } from "@/components/notify-matrix";
import type { SettingsMap } from "@/lib/notifications";
import type { BandMemberAdminRow } from "@/lib/queries";

const initial: FormState = {};

export function NewMemberForm() {
  const [state, action] = useActionState(createUser, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ma-name">Name</label>
          <input id="ma-name" className="input" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="ma-email">E-Mail</label>
          <input id="ma-email" className="input" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="ma-password">Startpasswort</label>
          <input
            id="ma-password"
            className="input"
            name="password"
            type="text"
            minLength={8}
            required
            placeholder="mind. 8 Zeichen"
          />
        </div>
        <div>
          <label className="label" htmlFor="ma-instrument">Instrument</label>
          <input
            id="ma-instrument"
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
        Band-Admin-Rechte geben
      </label>
      <FormMsg state={state} />
      <SubmitButton>Mitglied anlegen</SubmitButton>
    </form>
  );
}

/** Stammdaten + Benachrichtigungen eines Mitglieds bearbeiten. */
function MemberDataForm({
  member,
  settings,
}: {
  member: BandMemberAdminRow;
  settings: SettingsMap;
}) {
  const [state, action] = useActionState(updateUser, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={member.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="me-name">Name</label>
          <input id="me-name" className="input" name="name" defaultValue={member.name} required />
        </div>
        <div>
          <label className="label" htmlFor="me-email">E-Mail</label>
          <input
            id="me-email"
            className="input"
            name="email"
            type="email"
            defaultValue={member.email}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="me-instrument">Instrument</label>
          <input
            id="me-instrument"
            className="input"
            name="instrument"
            defaultValue={member.instrument ?? ""}
            list="instruments-edit"
            placeholder="z.B. Bass"
          />
          <datalist id="instruments-edit">
            {INSTRUMENT_SUGGESTIONS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="border-t border-line-soft pt-4">
        <h3 className="label">Benachrichtigungen</h3>
        <NotifyMatrix settings={settings} digestEnabled={member.digestEnabled} />
      </div>
      <FormMsg state={state} />
      <SubmitButton>Speichern</SubmitButton>
    </form>
  );
}

/** Passwort eines Mitglieds neu setzen. */
function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, action] = useActionState(setUserPassword, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        className="input max-w-48"
        name="password"
        type="text"
        minLength={8}
        placeholder="Neues Passwort"
        required
      />
      <SubmitButton className="btn" pendingText="Setze …">
        Passwort setzen
      </SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}

/**
 * Vollständiges Admin-Panel für ein Mitglied (Bearbeiten-Seite). Bündelt
 * Stammdaten, Passwort, Rolle und Bandzugehörigkeit. Für das eigene Konto
 * (`isSelf`) entfallen Rollen- und Entfernen-Aktionen.
 */
export function MemberEditPanel({
  member,
  settings,
  isSelf,
}: {
  member: BandMemberAdminRow;
  settings: SettingsMap;
  isSelf: boolean;
}) {
  const router = useRouter();
  const isAdmin = member.role === "band_admin";

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Stammdaten</h2>
        <MemberDataForm member={member} settings={settings} />
      </section>

      <section className="card p-5">
        <h2 className="headline mb-1 text-lg">Passwort setzen</h2>
        <p className="mb-4 text-sm text-mute">
          Setzt ein neues Passwort für {member.name}. Die Person wird nicht
          automatisch benachrichtigt — teile es ihr selbst mit.
        </p>
        <ResetPasswordForm userId={member.id} />
      </section>

      {!isSelf && (
        <section className="card p-5">
          <h2 className="headline mb-1 text-lg">Rolle &amp; Bandzugehörigkeit</h2>
          <p className="mb-4 text-sm text-mute">
            {isAdmin
              ? "Band-Admins können Mitglieder verwalten und Einstellungen ändern."
              : "Gib Band-Admin-Rechte oder entferne die Person aus der Band."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => {
                // Nur das Vergeben ist die zerstörende Richtung (voller Zugriff
                // auf Mitgliederverwaltung) — Entziehen läuft ohne Rückfrage.
                if (!isAdmin && !confirm(`${member.name} Band-Admin-Rechte geben?`)) return;
                void setUserRole(member.id, isAdmin ? "member" : "band_admin");
              }}
            >
              {isAdmin ? "Admin-Rechte entziehen" : "Band-Admin-Rechte geben"}
            </button>
            <button
              type="button"
              // Nur das Entfernen aus der Band ist die zerstörende Richtung.
              className={`btn ${member.active ? "btn-danger" : ""}`}
              onClick={async () => {
                if (member.active && !confirm(`${member.name} aus der Band entfernen?`)) return;
                await toggleUserActive(member.id);
                if (member.active) router.push("/mitglieder");
              }}
            >
              {member.active ? "Aus Band entfernen" : "Wieder aufnehmen"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
