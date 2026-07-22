"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  resetPassword,
  type FormState,
} from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function RequestResetForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          E-Mail
        </label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingText="Sende …">
        Link anfordern
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token ?? ""} />
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
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="label" htmlFor="repeat">
          Wiederholen
        </label>
        <input
          className="input"
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <FormMsg state={state} />
      {state.success ? (
        <a className="btn btn-primary w-full" href="/login">
          Zur Anmeldung
        </a>
      ) : (
        <SubmitButton className="btn btn-primary w-full" pendingText="Speichern …">
          Passwort setzen
        </SubmitButton>
      )}
    </form>
  );
}
