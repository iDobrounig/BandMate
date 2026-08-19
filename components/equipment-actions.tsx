"use client";

import { useTransition } from "react";
import { deleteEquipment } from "@/lib/actions/equipment";

/** Gerät löschen (Papierkorb), an derselben Stelle wie bei Song/Setliste/Termin. */
export function DeleteEquipmentButton({
  equipmentId,
  name,
}: {
  equipmentId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-sm btn-danger"
      onClick={() => {
        if (
          confirm(
            `„${name}" in den Papierkorb legen?\n\nFotos, Rechnungen und Beteiligungen bleiben erhalten und kommen bei einer Wiederherstellung mit zurück.`
          )
        )
          startTransition(() => deleteEquipment(equipmentId));
      }}
    >
      In den Papierkorb
    </button>
  );
}
