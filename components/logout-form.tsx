"use client";

import { logout } from "@/lib/actions/auth";

export function LogoutForm({
  className,
  ariaLabel,
  title,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={logout}
      onSubmit={(e) => {
        if (!confirm("Wirklich abmelden?")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        aria-label={ariaLabel}
        title={title}
        className={className}
      >
        {children}
      </button>
    </form>
  );
}
