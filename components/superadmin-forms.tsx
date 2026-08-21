"use client";

import { useActionState } from "react";
import {
  createBand,
  toggleBandActive,
  toggleUserGlobalActive,
  updateOwnAccount,
  changeOwnPassword,
  renameBand,
  saSetMembershipRole,
  saRemoveMembership,
  saAddMembership,
  saAddMemberByEmail,
  createUserGlobal,
  updateUserGlobal,
  setUserGlobalPassword,
} from "@/lib/actions/superadmin";
import { SubmitButton, FormMsg } from "@/components/form";
import type { BandRole } from "@/lib/db/schema";
import type { FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function CreateBandForm() {
  const [state, action] = useActionState(createBand, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="cb-band">Bandname</label>
        <input id="cb-band" className="input" name="bandName" required placeholder="z.B. Die Nachtschwärmer" />
      </div>
      <div className="border-t border-line-soft pt-4">
        <p className="mb-3 text-sm text-mute">Erster Band-Admin (verwaltet die Band selbst):</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cb-name">Name</label>
            <input id="cb-name" className="input" name="adminName" required />
          </div>
          <div>
            <label className="label" htmlFor="cb-email">E-Mail</label>
            <input id="cb-email" className="input" name="adminEmail" type="email" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cb-pw">Startpasswort</label>
            <input
              id="cb-pw"
              className="input"
              name="adminPassword"
              type="text"
              minLength={8}
              required
              placeholder="mind. 8 Zeichen — der Person mitteilen"
            />
          </div>
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton>Band anlegen</SubmitButton>
    </form>
  );
}

export function ToggleBandButton({ bandId, active }: { bandId: number; active: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-danger" : ""}`}
      onClick={() => {
        if (active && !confirm("Band deaktivieren? Sie verschwindet für ihre Mitglieder.")) return;
        void toggleBandActive(bandId);
      }}
    >
      {active ? "Deaktivieren" : "Aktivieren"}
    </button>
  );
}

export function ToggleUserButton({
  userId,
  active,
  isSelf,
}: {
  userId: number;
  active: boolean;
  isSelf: boolean;
}) {
  if (isSelf) return null;
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-danger" : ""}`}
      onClick={() => {
        if (active && !confirm("Konto global sperren? Sperrt die Person aus allen Bands aus.")) return;
        void toggleUserGlobalActive(userId);
      }}
    >
      {active ? "Sperren" : "Entsperren"}
    </button>
  );
}

// ---- Eigenes Konto --------------------------------------------------------

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateOwnAccount, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="acc-name">Name</label>
          <input id="acc-name" className="input" name="name" defaultValue={name} required />
        </div>
        <div>
          <label className="label" htmlFor="acc-email">E-Mail</label>
          <input id="acc-email" className="input" name="email" type="email" defaultValue={email} required />
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-sm">Speichern</SubmitButton>
    </form>
  );
}

export function OwnPasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="op-current">Aktuelles Passwort</label>
          <input id="op-current" className="input" name="current" type="password" required />
        </div>
        <div>
          <label className="label" htmlFor="op-next">Neues Passwort</label>
          <input id="op-next" className="input" name="next" type="password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="op-repeat">Wiederholen</label>
          <input id="op-repeat" className="input" name="repeat" type="password" minLength={8} required />
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-sm">Passwort ändern</SubmitButton>
    </form>
  );
}

// ---- Band-Detail ----------------------------------------------------------

export function RenameBandForm({ bandId, name }: { bandId: number; name: string }) {
  const [state, action] = useActionState(renameBand, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="bandId" value={bandId} />
      <div className="min-w-56 flex-1">
        <label className="label" htmlFor="rb-name">Bandname</label>
        <input id="rb-name" className="input" name="name" defaultValue={name} required />
      </div>
      <SubmitButton className="btn btn-sm">Speichern</SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}

export function MemberRoleSelect({
  bandId,
  userId,
  role,
}: {
  bandId: number;
  userId: number;
  role: BandRole;
}) {
  return (
    <select
      className="input max-w-40"
      defaultValue={role}
      onChange={(e) => saSetMembershipRole(bandId, userId, e.target.value as BandRole)}
    >
      <option value="member">Mitglied</option>
      <option value="band_admin">Band-Admin</option>
    </select>
  );
}

export function MembershipRemoveButton({
  bandId,
  userId,
  active,
  role,
}: {
  bandId: number;
  userId: number;
  active: boolean;
  role: BandRole;
}) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? "btn-danger" : ""}`}
      onClick={() => {
        if (active) {
          if (!confirm("Aus der Band entfernen?")) return;
          void saRemoveMembership(bandId, userId);
        } else {
          void saAddMembership(bandId, userId, role);
        }
      }}
    >
      {active ? "Entfernen" : "Aufnehmen"}
    </button>
  );
}

export function AddMemberByEmailForm({ bandId }: { bandId: number }) {
  const [state, action] = useActionState(saAddMemberByEmail, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bandId" value={bandId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className="input" name="email" type="email" required placeholder="E-Mail der Person" />
        <label className="flex items-center gap-2 text-sm text-mute">
          <input type="checkbox" name="role" value="admin" className="size-4 accent-(--color-accent)" />
          als Band-Admin
        </label>
      </div>
      <SubmitButton className="btn btn-sm">Aufnehmen</SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}

// ---- Nutzer-Detail & Anlage ----------------------------------------------

type BandOption = { id: number; name: string };

export function CreateUserGlobalForm({ bands }: { bands: BandOption[] }) {
  const [state, action] = useActionState(createUserGlobal, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cu-name">Name</label>
          <input id="cu-name" className="input" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="cu-email">E-Mail</label>
          <input id="cu-email" className="input" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="cu-pw">Startpasswort</label>
          <input id="cu-pw" className="input" name="password" type="text" minLength={8} required placeholder="mind. 8 Zeichen" />
        </div>
        <div>
          <label className="label" htmlFor="cu-band">Direkt in Band (optional)</label>
          <div className="flex gap-2">
            <select id="cu-band" className="input" name="bandId" defaultValue="">
              <option value="">— keine —</option>
              {bands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select className="input max-w-36" name="role" defaultValue="member">
              <option value="member">Mitglied</option>
              <option value="band_admin">Band-Admin</option>
            </select>
          </div>
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton>Konto anlegen</SubmitButton>
    </form>
  );
}

export function UserEditForm({ userId, name, email }: { userId: number; name: string; email: string }) {
  const [state, action] = useActionState(updateUserGlobal, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ue-name">Name</label>
          <input id="ue-name" className="input" name="name" defaultValue={name} required />
        </div>
        <div>
          <label className="label" htmlFor="ue-email">E-Mail</label>
          <input id="ue-email" className="input" name="email" type="email" defaultValue={email} required />
        </div>
      </div>
      <FormMsg state={state} />
      <SubmitButton className="btn btn-sm">Speichern</SubmitButton>
    </form>
  );
}

export function UserPasswordForm({ userId }: { userId: number }) {
  const [state, action] = useActionState(setUserGlobalPassword, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input className="input max-w-48" name="password" type="text" minLength={8} placeholder="Neues Passwort" required />
      <SubmitButton className="btn btn-sm">Passwort setzen</SubmitButton>
      <FormMsg state={state} />
    </form>
  );
}

/** Nutzer-Detail: einer Band zuweisen (bandId aus Dropdown, Rolle wählbar). */
export function AssignToBandControl({ userId, bands }: { userId: number; bands: BandOption[] }) {
  if (bands.length === 0) {
    return <p className="text-sm text-faint">Der Nutzer ist bereits in allen Bands.</p>;
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      action={(fd) => {
        const bandId = Number(fd.get("bandId"));
        const role = (fd.get("role") as BandRole) ?? "member";
        if (bandId) void saAddMembership(bandId, userId, role);
      }}
    >
      <select className="input" name="bandId" required defaultValue="">
        <option value="" disabled>Band wählen …</option>
        {bands.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <select className="input max-w-36" name="role" defaultValue="member">
        <option value="member">Mitglied</option>
        <option value="band_admin">Band-Admin</option>
      </select>
      <SubmitButton className="btn btn-sm">Zuweisen</SubmitButton>
    </form>
  );
}
