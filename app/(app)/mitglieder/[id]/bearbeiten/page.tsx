import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBandAdmin } from "@/lib/auth";
import { fetchBandMemberAdmin } from "@/lib/queries";
import { fetchSettings } from "@/lib/notifications";
import { MemberEditPanel } from "@/components/member-admin";

export const metadata = { title: "Mitglied bearbeiten" };

export default async function MitgliedBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, bandId } = await requireBandAdmin();
  const { id } = await params;
  const member = await fetchBandMemberAdmin(bandId, Number(id));
  if (!member) notFound();

  const settings = await fetchSettings(member.id);

  return (
    <div className="max-w-2xl">
      <Link href="/mitglieder" className="text-sm text-mute hover:text-ink">
        ← Zurück zu den Mitgliedern
      </Link>
      <h1 className="headline mt-2 text-3xl">{member.name}</h1>
      <p className="mt-1 text-sm text-mute">{member.email}</p>

      <div className="mt-6">
        <MemberEditPanel member={member} settings={settings} isSelf={member.id === user.id} />
      </div>
    </div>
  );
}
