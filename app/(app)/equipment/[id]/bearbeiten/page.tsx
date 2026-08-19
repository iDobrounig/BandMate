import { eq } from "drizzle-orm";
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
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.name);

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät bearbeiten</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm equipment={data.equipment} contributions={data.contributions} members={members} />
      </div>
    </div>
  );
}
