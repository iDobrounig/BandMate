"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import { addComment, deleteComment } from "@/lib/actions/interactions";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function CommentForm({ songId }: { songId: number }) {
  const [state, action] = useActionState(addComment, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Nach erfolgreichem Absenden Feld leeren
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="songId" value={songId} />
      <textarea
        className="input min-h-20"
        name="body"
        placeholder="Kommentar schreiben … (z.B. „Intro lieber halbes Tempo?“)"
        required
        maxLength={2000}
      />
      <FormMsg state={state} />
      <SubmitButton className="btn" pendingText="Senden …">
        Absenden
      </SubmitButton>
    </form>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="link-danger text-xs"
      onClick={() => {
        if (confirm("Kommentar löschen?"))
          startTransition(() => deleteComment(commentId));
      }}
    >
      löschen
    </button>
  );
}
