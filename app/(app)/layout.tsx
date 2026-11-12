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
        <div className="glass-edge pointer-events-auto relative flex max-w-full items-center gap-1 rounded-3xl bg-linear-to-b from-[rgb(255_214_150/0.16)] to-accent/6 p-1.5 shadow-[inset_0_1px_1px_rgb(255_230_190/0.3),0_0_22px_rgb(242_165_28/0.12),0_10px_30px_rgb(0_0_0/0.55)] backdrop-blur-lg backdrop-saturate-[1.8]">
          <div className="flex min-w-0 items-center overflow-x-auto">
            <NavLinks />
          </div>
          <div className="h-6 w-px shrink-0 bg-[rgb(255_220_170/0.2)]" aria-hidden />
          <AppMenu
            userName={ctx.user.name}
            bandName={ctx.bandName}
            canSwitchBand={memberships.length > 1}
            isAdmin={ctx.role === "band_admin"}
          />
        </div>
      </div>
    </div>
  );
}
