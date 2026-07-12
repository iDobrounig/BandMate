"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/actions/auth";

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
