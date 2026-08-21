import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { LogoutForm } from "@/components/logout-form";
import { IconLogout } from "@/components/icons";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="headline text-lg text-accent">BandMate</span>
          <span className="badge border-accent/40 bg-accent/10 text-accent-hi">Verwaltung</span>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/verwaltung" className="rounded-lg px-3 py-1.5 text-mute hover:bg-raise hover:text-ink">
              Bands
            </Link>
            <Link href="/verwaltung/nutzer" className="rounded-lg px-3 py-1.5 text-mute hover:bg-raise hover:text-ink">
              Nutzer
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-mute">
            <Link href="/verwaltung/konto" className="hidden rounded-lg px-3 py-1.5 hover:bg-raise hover:text-ink sm:inline">
              {admin.name}
            </Link>
            <LogoutForm
              ariaLabel="Abmelden"
              title="Abmelden"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-faint transition hover:bg-raise hover:text-ink cursor-pointer"
            >
              <IconLogout className="size-4" />
              Abmelden
            </LogoutForm>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
