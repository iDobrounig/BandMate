"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconSongs,
  IconSetlists,
  IconCalendar,
  IconMembers,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links: NavItem[] = [
    { href: "/", label: "Dashboard", Icon: IconDashboard },
    { href: "/songs", label: "Songs", Icon: IconSongs },
    { href: "/setlisten", label: "Setlisten", Icon: IconSetlists },
    { href: "/termine", label: "Termine", Icon: IconCalendar },
    ...(isAdmin
      ? [{ href: "/mitglieder", label: "Mitglieder", Icon: IconMembers }]
      : []),
  ];

  return (
    <nav className="flex items-stretch justify-between gap-1 overflow-x-auto sm:justify-start">
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-none transition sm:flex-none lg:flex-row lg:gap-0 lg:px-3 lg:text-sm ${
              active
                ? "text-accent-hi lg:bg-accent/15"
                : "text-mute hover:bg-raise hover:text-ink"
            }`}
          >
            <Icon className="size-5 lg:hidden" />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
