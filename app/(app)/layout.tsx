import { requireBandContext, fetchMemberships } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { AppMenu } from "@/components/app-menu";
import { VersionWatcher } from "@/components/version-watcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireBandContext();
  const memberships = await fetchMemberships(ctx.user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28">
        <VersionWatcher />
        {children}
      </main>

      <div className="print-hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-[0_0_14px_rgb(255_255_255/0.1)]">
          <div className="flex min-w-0 items-center overflow-x-auto">
            <NavLinks />
          </div>
          <div className="h-8 w-px shrink-0 bg-line-soft" aria-hidden />
          <AppMenu
            userName={ctx.user.name}
            bandName={ctx.bandName}
            canSwitchBand={memberships.length > 1}
          />
        </div>
      </div>
    </div>
  );
}
