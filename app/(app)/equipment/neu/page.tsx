import { requireBandContext } from "@/lib/auth";
import { fetchBandMembers } from "@/lib/queries";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment anlegen" };

export default async function NeuesEquipmentPage() {
  const { bandId } = await requireBandContext();
  const members = (await fetchBandMembers(bandId)).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät anlegen</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm members={members} />
      </div>
    </div>
  );
}
