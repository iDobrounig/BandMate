"use client";

import { useActionState } from "react";
import { sendTestEmail } from "@/lib/actions/users";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function SmtpTestForm({ adminEmail }: { adminEmail: string }) {
  const [state, action] = useActionState(sendTestEmail, initial);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-mute">
        Prüft die SMTP-Verbindung und verschickt eine echte Test-Mail — praktisch,
        um neue SMTP-Zugangsdaten in der <code>.env</code> zu überprüfen, ohne die
        Server-Logs öffnen zu müssen.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs flex-1"
          name="to"
          type="email"
          defaultValue={adminEmail}
          required
        />
        <SubmitButton className="btn" pendingText="Sende …">
          Test-Mail senden
        </SubmitButton>
      </div>
      <FormMsg state={state} />
    </form>
  );
}
