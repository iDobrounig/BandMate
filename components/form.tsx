"use client";

import { useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import type { FormState } from "@/lib/actions/auth";
import { IconCheck } from "@/components/icons";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText = "Speichern …",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMsg({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
        {state.success}
      </p>
    );
  }
  return null;
}

/**
 * Rückmeldung für Onblur-Autospeicher (Notiz-/Kommentarfelder ohne eigenen
 * Speichern-Button). Blendet sich nach kurzer Zeit von selbst wieder aus —
 * siehe F3 in FEATURES.md: bisher speicherten diese Felder still.
 */
export function useSavedHint(): [boolean, () => void] {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = () => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 1500);
  };

  return [visible, trigger];
}

export function SavedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
      <IconCheck className="size-3.5" />
      gespeichert
    </span>
  );
}
