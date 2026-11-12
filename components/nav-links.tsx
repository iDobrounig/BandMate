"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconSongs,
  IconSetlists,
  IconCalendar,
  IconMembers,
  IconEquipment,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

export function NavLinks() {
  const pathname = usePathname();

  const links: NavItem[] = [
    { href: "/", label: "Dashboard", Icon: IconDashboard },
    { href: "/songs", label: "Songs", Icon: IconSongs },
    { href: "/setlisten", label: "Setlisten", Icon: IconSetlists },
    { href: "/termine", label: "Termine", Icon: IconCalendar },
    { href: "/mitglieder", label: "Mitglieder", Icon: IconMembers },
    { href: "/equipment", label: "Equipment", Icon: IconEquipment },
  ];

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className={`flex items-center justify-center gap-2 rounded-full px-2.5 py-2 text-sm font-semibold leading-none transition ${
              active
                ? "bg-accent/30 text-[#ffe2a8] shadow-[inset_0_1px_0_rgb(255_230_190/0.35)]"
                : "text-[rgb(255_236_205/0.85)] hover:bg-white/10 hover:text-ink"
            }`}
          >
            <Icon className="size-5" />
            <span className="hidden whitespace-nowrap lg:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
