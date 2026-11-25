"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateProfile,
  changePassword,
  type FormState,
} from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { INSTRUMENT_SUGGESTIONS } from "@/lib/constants";
import { NotifyMatrix } from "@/components/notify-matrix";
import type { SettingsMap } from "@/lib/notifications";
import type { User, NotifyChannel } from "@/lib/db/schema";
import { currentSubscription } from "@/lib/push-client";

const initial: FormState = {};

export function ProfileForm({
  user,
  instrument,
  settings,
  channel,
  deviceCount,
}: {
  user: User;
  /** Instrument in der aktiven Band (aus band_members). */
  instrument: string | null;
  settings: SettingsMap;
  /** Kanalwahl; undefined, wenn Push am Server aus ist. */
  channel?: NotifyChannel;
  deviceCount?: number;
}) {
  const [state, action] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="space-y-6">
      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Stammdaten</h2>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              className="input"
              id="name"
              name="name"
              defaultValue={user.name}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              E-Mail
            </label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              required
            />
            <p className="mt-1 text-xs text-faint">
              Diese Adresse dient auch zum Anmelden.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="instrument">
              Instrument
            </label>
            <input
              className="input"
              id="instrument"
              name="instrument"
              defaultValue={instrument ?? ""}
              list="instruments"
              placeholder="z.B. Gitarre"
            />
            <datalist id="instruments">
              {INSTRUMENT_SUGGESTIONS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="headline mb-4 text-lg">Benachrichtigungen</h2>
        <NotifyMatrix
          settings={settings}
          digestEnabled={user.digestEnabled}
          channel={channel}
          deviceCount={deviceCount}
        />
      </section>

      <FormMsg state={state} />
      <SubmitButton>Profil speichern</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  // Push-Abo DIESES Geräts mitschicken: Beim Passwortwechsel werden die Abos
  // der anderen (abgemeldeten) Geräte entfernt, dieses bleibt.
  const [pushEndpoint, setPushEndpoint] = useState("");
  useEffect(() => {
    currentSubscription()
      .then((sub) => setPushEndpoint(sub?.endpoint ?? ""))
      .catch(() => {});
  }, []);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pushEndpoint" value={pushEndpoint} />
      <div>
        <label className="label" htmlFor="current">
          Aktuelles Passwort
        </label>
        <input
          className="input"
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="next">
          Neues Passwort
        </label>
        <input
          className="input"
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="repeat">
          Neues Passwort wiederholen
        </label>
        <input
          className="input"
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <FormMsg state={state} />
      <SubmitButton>Passwort ändern</SubmitButton>
    </form>
  );
}
