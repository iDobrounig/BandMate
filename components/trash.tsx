"use client";

import { useTransition } from "react";
import { restoreItem, purgeItem } from "@/lib/actions/trash";
import type { TrashKind } from "@/lib/trash";

export function RestoreButton({
  kind,
  id,
  label,
  className = "btn btn-sm",
  children = "Wiederherstellen",
}: {
  kind: TrashKind;
  id: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      title={label ? `„${label}" wiederherstellen` : undefined}
      onClick={() => startTransition(() => restoreItem(kind, id))}
    >
      {pending ? "Einen Moment …" : children}
    </button>
  );
}

export function PurgeButton({
  kind,
  id,
  label,
  count,
}: {
  kind: TrashKind;
  id: number;
  label: string;
  count: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-sm btn-danger"
      onClick={() => {
        const was = count > 1 ? `${count} Termine („${label}")` : `„${label}"`;
        if (
          confirm(
            `${was} endgültig löschen?\n\nDas lässt sich nicht mehr rückgängig machen — auch nicht über den Papierkorb.`
          )
        )
          startTransition(() => purgeItem(kind, id));
      }}
    >
      {pending ? "Lösche …" : "Endgültig löschen"}
    </button>
  );
}
