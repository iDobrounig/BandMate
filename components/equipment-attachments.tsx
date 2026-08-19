"use client";

import { useActionState, useState, useTransition } from "react";
import { uploadEquipmentAttachment, deleteEquipmentAttachment } from "@/lib/actions/equipment-attachments";
import { restoreItem } from "@/lib/actions/trash";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function EquipmentUploadForm({
  equipmentId,
  kind,
}: {
  equipmentId: number;
  kind: "foto" | "rechnung";
}) {
  const [state, action] = useActionState(uploadEquipmentAttachment, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          type="file"
          name="file"
          required
          accept={kind === "foto" ? "image/*" : ".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"}
          capture={kind === "foto" ? "environment" : undefined}
        />
        <SubmitButton className="btn" pendingText="Lädt hoch …">
          Hochladen
        </SubmitButton>
      </div>
      <p className="text-xs text-faint">
        {kind === "foto"
          ? "Bild, auch direkt mit der Kamera aufgenommen — max. 20 MB"
          : "PDF oder Bild — max. 20 MB"}
      </p>
      <FormMsg state={state} />
    </form>
  );
}

/**
 * Löschen legt die Datei in den Papierkorb. Kein Redirect zum Anhängen des
 * „Rückgängig" — die Komponente merkt sich den Zustand selbst, wie bei Songs.
 */
export function DeleteEquipmentAttachmentButton({
  attachmentId,
  name,
}: {
  attachmentId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [geloescht, setGeloescht] = useState(false);

  if (geloescht) {
    return (
      <span className="flex items-center gap-2 text-xs text-faint">
        im Papierkorb
        <button
          type="button"
          disabled={pending}
          className="text-accent-hi underline cursor-pointer disabled:opacity-50"
          onClick={() =>
            startTransition(async () => {
              await restoreItem("equipmentAttachment", attachmentId);
              setGeloescht(false);
            })
          }
        >
          Rückgängig
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className="link-danger text-xs"
      onClick={() => {
        if (confirm(`„${name}" in den Papierkorb legen?`))
          startTransition(async () => {
            await deleteEquipmentAttachment(attachmentId);
            setGeloescht(true);
          });
      }}
    >
      löschen
    </button>
  );
}
