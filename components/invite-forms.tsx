"use client";

import { useActionState } from "react";
import { acceptInviteAsUser, acceptInviteNew } from "@/lib/actions/invites";
import { createInvite } from "@/lib/actions/invites";
import { SubmitButton, FormMsg } from "@/components/form";
import type { FormState } from "@/lib/actions/auth";

const initial: FormState = {};

/** Eingeloggt: ein Klick tritt der Band bei. */
export function JoinBandButton({ token }: { token: string }) {
  return (
    <form
      action={async () => {
        await acceptInviteAsUser(token);
      }}
    >
      <SubmitButton className="btn btn-primary w-full">Der Band beitreten</SubmitButton>
    </form>
  );
}

/** Neuer Nutzer: Name + Passwort setzen, Konto + Mitgliedschaft anlegen. */
export function NewAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInviteNew, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="inv-email">E-Mail</label>
        <input id="inv-email" className="input" value={email} disabled readOnly />
      </div>
      <div>
        <label className="label" htmlFor="inv-name">Dein Name</label>
        <input id="inv-name" className="input" name="name" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="inv-password">Passwort</label>
        <input
          id="inv-password"
          className="input"
          name="password"
          type="password"
          minLength={8}
          required
          placeholder="mind. 8 Zeichen"
        />
      </div>
      <div>
        <label className="label" htmlFor="inv-repeat">Passwort wiederholen</label>
        <input id="inv-repeat" className="input" name="repeat" type="password" minLength={8} required />
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-primary w-full">Konto anlegen &amp; beitreten</SubmitButton>
    </form>
  );
}

/** Band-Admin erzeugt einen Einladungslink. */
export function InviteForm() {
  const [state, action] = useActionState(createInvite, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="input"
          name="email"
          type="email"
          required
          placeholder="E-Mail der einzuladenden Person"
        />
        <label className="flex items-center gap-2 text-sm text-mute">
          <input type="checkbox" name="role" value="admin" className="size-4 accent-(--color-accent)" />
          als Band-Admin
        </label>
      </div>
      <SubmitButton className="btn btn-sm">Einladungslink erzeugen</SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}
