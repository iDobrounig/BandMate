import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print-hidden sticky top-0 z-40 border-b border-line-soft bg-bg/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-y-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-x-6 sm:gap-y-0">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link href="/" className="headline text-xl leading-none text-accent">
              BandMate
            </Link>
            <div className="flex items-center gap-2 sm:hidden">
              <Link
                href="/profil"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-mute transition hover:bg-raise hover:text-ink"
              >
                {user.name}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-sm text-faint transition hover:text-ink cursor-pointer"
                  title="Abmelden"
                >
                  Abmelden
                </button>
              </form>
            </div>
          </div>
          <div className="w-full overflow-hidden sm:flex-1">
            <NavLinks isAdmin={user.role === "admin"} />
          </div>
          <div className="hidden ml-auto items-center gap-2 sm:flex">
            <Link
              href="/profil"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-mute transition hover:bg-raise hover:text-ink"
            >
              {user.name}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-sm text-faint transition hover:text-ink cursor-pointer"
                title="Abmelden"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="print-hidden border-t border-line-soft py-4 text-center text-xs text-faint">
        BandMate — internes Band-Dashboard
      </footer>
    </div>
  );
}
