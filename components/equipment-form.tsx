"use client";

import { useActionState, useState } from "react";
import { createEquipment, updateEquipment } from "@/lib/actions/equipment";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { IconClose } from "@/components/icons";
import {
  EQUIPMENT_CATEGORY_ORDER,
  EQUIPMENT_CATEGORY,
  EQUIPMENT_STATUS_ORDER,
  EQUIPMENT_STATUS,
} from "@/lib/constants";
import type { Equipment } from "@/lib/db/schema";

const initial: FormState = {};

type ContributionRow = { id: number; userId: string; amount: string; note: string };

export function EquipmentForm({
  equipment,
  contributions,
  members,
}: {
  equipment?: Equipment;
  contributions?: { userId: number; amount: number; note: string | null }[];
  members: { id: number; name: string }[];
}) {
  const isEdit = Boolean(equipment);
  const [state, action] = useActionState(isEdit ? updateEquipment : createEquipment, initial);
  const [rows, setRows] = useState<ContributionRow[]>(() =>
    contributions && contributions.length > 0
      ? contributions.map((c, i) => ({
          id: i,
          userId: String(c.userId),
          amount: String(c.amount),
          note: c.note ?? "",
        }))
      : [{ id: 0, userId: "", amount: "", note: "" }]
  );
  const [cost, setCost] = useState(
    equipment?.acquisitionCost != null ? String(equipment.acquisitionCost) : ""
  );

  const addRow = () => setRows((r) => [...r, { id: Date.now(), userId: "", amount: "", note: "" }]);
  const removeRow = (id: number) => setRows((r) => r.filter((row) => row.id !== id));
  const updateRow = (id: number, patch: Partial<ContributionRow>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const costNum = Number(cost) || 0;
  const diff = costNum - sum;

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="equipmentId" value={equipment!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-name">Name *</label>
          <input
            id="ef-name"
            className="input text-lg"
            name="name"
            defaultValue={equipment?.name ?? ""}
            required
            autoFocus={!isEdit}
          />
        </div>
        <div>
          <label className="label" htmlFor="ef-category">Kategorie</label>
          <select id="ef-category" className="input" name="category" defaultValue={equipment?.category ?? "other"}>
            {EQUIPMENT_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{EQUIPMENT_CATEGORY[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ef-status">Zustand</label>
          <select id="ef-status" className="input" name="status" defaultValue={equipment?.status ?? "in_use"}>
            {EQUIPMENT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{EQUIPMENT_STATUS[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ef-date">Anschaffungsdatum</label>
          <input
            id="ef-date"
            className="input mono-display"
            name="acquisitionDate"
            type="date"
            defaultValue={equipment?.acquisitionDate ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="ef-cost">Anschaffungskosten (€)</label>
          <input
            id="ef-cost"
            className="input mono-display"
            name="acquisitionCost"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-location">Standort/Lagerort</label>
          <input
            id="ef-location"
            className="input"
            name="location"
            defaultValue={equipment?.location ?? ""}
            placeholder="z.B. Proberaum"
          />
        </div>
      </div>

      <div>
        <h3 className="label">Kostenbeteiligung der Mitglieder</h3>
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 border-b border-line-soft/40 pb-3 sm:flex-row sm:border-0 sm:pb-0"
            >
              <select
                className="input sm:w-48"
                name="contribUserId"
                value={row.userId}
                onChange={(e) => updateRow(row.id, { userId: e.target.value })}
              >
                <option value="">Mitglied wählen …</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                className="input mono-display sm:w-32"
                name="contribAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Betrag €"
                value={row.amount}
                onChange={(e) => updateRow(row.id, { amount: e.target.value })}
              />
              <div className="flex w-full gap-2 sm:flex-1">
                <input
                  className="input flex-1"
                  name="contribNote"
                  placeholder="Vermerk (optional)"
                  value={row.note}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger self-center px-3"
                    onClick={() => removeRow(row.id)}
                    title="Zeile entfernen"
                  >
                    <IconClose className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm mt-2" onClick={addRow}>
          + weitere Beteiligung
        </button>
        <p className="mono-display mt-2 text-sm text-mute">
          Summe der Beteiligungen: {sum.toFixed(2)} €
        </p>
        {cost.trim() !== "" && Math.abs(diff) > 0.001 && (
          <p className="mt-1 text-xs text-amber-300">
            {diff > 0
              ? `${diff.toFixed(2)} € der Anschaffungskosten sind noch keinem Mitglied zugeordnet.`
              : `${Math.abs(diff).toFixed(2)} € mehr eingetragen als die Anschaffungskosten.`}
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="ef-notes">Notizen</label>
        <textarea
          id="ef-notes"
          className="input min-h-20"
          name="notes"
          defaultValue={equipment?.notes ?? ""}
          placeholder="z.B. Seriennummer, Garantie, Kaufort, …"
        />
      </div>

      <FormMsg state={state} />
      <div className="flex gap-3">
        <SubmitButton pendingText={isEdit ? "Speichern …" : "Anlegen …"}>
          {isEdit ? "Änderungen speichern" : "Gerät anlegen"}
        </SubmitButton>
      </div>
    </form>
  );
}
