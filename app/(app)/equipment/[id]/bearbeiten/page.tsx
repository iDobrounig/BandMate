import { eq, or, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentDetail } from "@/lib/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment bearbeiten" };

export default async function EquipmentBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await fetchEquipmentDetail(Number(id));
  if (!data) notFound();

  // Aktive Mitglieder ODER Mitglieder mit bestehender Beteiligung an diesem
  // Gerät — auch wenn sie inzwischen ausgetreten sind. Sonst hat ihre Zeile
  // im Formular keine passende <option>, der Browser setzt sie beim Rendern
  // auf "" zurück, und updateEquipment verwirft die Beteiligung beim nächsten
  // Speichern endgültig (siehe Review-Finding: Datenverlust).
  const contributorIds = data.contributions.map((c) => c.userId);
  const memberRows = await db
    .select({ id: users.id, name: users.name, active: users.active })
    .from(users)
    .where(
      contributorIds.length > 0
        ? or(eq(users.active, true), inArray(users.id, contributorIds))
        : eq(users.active, true)
    )
    .orderBy(users.name);
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
