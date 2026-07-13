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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="headline text-xl leading-none text-accent">
            BandMate
          </Link>
          <NavLinks isAdmin={user.role === "admin"} />
          <div className="ml-auto flex items-center gap-2">
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
