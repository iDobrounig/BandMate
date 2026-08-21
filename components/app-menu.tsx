"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconUser,
  IconHelp,
  IconTrash,
  IconLogout,
  IconRepeat,
  IconSettings,
} from "@/components/icons";
import { LogoutForm } from "@/components/logout-form";

export function AppMenu({
  userName,
  bandName,
  canSwitchBand,
  isAdmin,
}: {
  userName: string;
  bandName: string;
  canSwitchBand: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-mute transition hover:bg-raise hover:text-ink";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Menü"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-xl p-2.5 transition ${
          open ? "bg-accent/15 text-accent-hi" : "text-mute hover:bg-raise hover:text-ink"
        }`}
      >
        <IconUser className="size-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
        >
          <div className="px-3 pt-1.5 pb-1 text-xs text-faint uppercase tracking-wide">
            <span className="truncate">{bandName}</span>
          </div>
          {canSwitchBand && (
            <Link
              role="menuitem"
              href="/band-waehlen"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <IconRepeat className="size-4" />
              Band wechseln
            </Link>
          )}
          <div className="my-1 h-px bg-line-soft" />
          <Link
            role="menuitem"
            href="/profil"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconUser className="size-4" />
            <span className="truncate">{userName}</span>
          </Link>
          <Link
            role="menuitem"
            href="/hilfe"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconHelp className="size-4" />
            Hilfe
          </Link>
          {isAdmin && (
            <Link
              role="menuitem"
              href="/einstellungen"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <IconSettings className="size-4" />
              Einstellungen
            </Link>
          )}
          <Link
            role="menuitem"
            href="/papierkorb"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconTrash className="size-4" />
            Papierkorb
          </Link>
          <div className="my-1 h-px bg-line-soft" />
          <LogoutForm
            ariaLabel="Abmelden"
            title="Abmelden"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-faint transition hover:bg-raise hover:text-ink cursor-pointer"
          >
            <IconLogout className="size-4" />
            Abmelden
          </LogoutForm>
        </div>
      )}
    </div>
  );
}
