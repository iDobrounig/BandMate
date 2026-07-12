"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function LoginForm() {
  const [state, action] = useActionState(login, initial);
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
      <div>
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-primary w-full" pendingText="Anmelden …">
        Anmelden
      </SubmitButton>
    </form>
  );
}
