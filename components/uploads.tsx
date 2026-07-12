"use client";

import { useActionState, useTransition } from "react";
import { uploadAttachment, deleteAttachment } from "@/lib/actions/attachments";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { INSTRUMENT_SUGGESTIONS } from "@/lib/constants";

const initial: FormState = {};

export function UploadForm({
  songId,
  kind,
}: {
  songId: number;
  kind: "audio" | "sheet";
}) {
  const [state, action] = useActionState(uploadAttachment, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="songId" value={songId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          type="file"
          name="file"
          required
          accept={
            kind === "audio"
              ? ".mp3,.m4a,.wav,.ogg,.flac,audio/*"
              : ".pdf,.png,.jpg,.jpeg,.webp"
          }
        />
        {kind === "sheet" && (
          <>
            <input
              className="input max-w-48"
              name="instrument"
              list={`instruments-upload-${songId}`}
              placeholder="Instrument *"
              required
            />
            <datalist id={`instruments-upload-${songId}`}>
              {INSTRUMENT_SUGGESTIONS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </>
        )}
        <SubmitButton className="btn" pendingText="Lädt hoch …">
          Hochladen
        </SubmitButton>
      </div>
      <p className="text-xs text-faint">
        {kind === "audio"
          ? "MP3, M4A, WAV, OGG, FLAC — max. 50 MB"
          : "PDF oder Bild — max. 20 MB"}
      </p>
      <FormMsg state={state} />
    </form>
  );
}

export function DeleteAttachmentButton({
  attachmentId,
  name,
}: {
  attachmentId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-faint transition hover:text-red-400 cursor-pointer"
      onClick={() => {
        if (confirm(`„${name}" wirklich löschen?`))
          startTransition(() => deleteAttachment(attachmentId));
      }}
    >
      löschen
    </button>
  );
}
