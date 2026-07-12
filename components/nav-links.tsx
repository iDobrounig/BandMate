"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const base =
  "rounded-lg px-3 py-1.5 text-sm font-semibold transition whitespace-nowrap";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/songs", label: "Songs" },
    { href: "/setlisten", label: "Setlisten" },
    ...(isAdmin ? [{ href: "/mitglieder", label: "Mitglieder" }] : []),
  ];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${base} ${
              active
                ? "bg-accent/15 text-accent-hi"
                : "text-mute hover:bg-raise hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
