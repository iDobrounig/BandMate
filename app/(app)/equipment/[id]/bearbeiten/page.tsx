import { notFound } from "next/navigation";
import { requireBandContext } from "@/lib/auth";
import { fetchEquipmentDetail, fetchBandMembers } from "@/lib/queries";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment bearbeiten" };

export default async function EquipmentBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { bandId } = await requireBandContext();
  const { id } = await params;
  const data = await fetchEquipmentDetail(Number(id), bandId);
  if (!data) notFound();

  // Aktive Mitglieder ODER Mitglieder mit bestehender Beteiligung an diesem
  // Gerät — auch wenn sie inzwischen ausgetreten sind. Sonst hat ihre Zeile
  // im Formular keine passende <option>, der Browser setzt sie beim Rendern
  // auf "" zurück, und updateEquipment verwirft die Beteiligung beim nächsten
  // Speichern endgültig (siehe Review-Finding: Datenverlust).
  const contributorIds = data.contributions.map((c) => c.userId);
  const memberRows = await fetchBandMembers(bandId, { includeUserIds: contributorIds });
  const members = memberRows.map((m) => ({
    id: m.id,
    name: m.active ? m.name : `${m.name} (ausgetreten)`,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät bearbeiten</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm equipment={data.equipment} contributions={data.contributions} members={members} />
      </div>
    </div>
  );
}
