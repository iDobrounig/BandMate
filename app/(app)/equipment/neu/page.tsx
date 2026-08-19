import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment anlegen" };

export default async function NeuesEquipmentPage() {
  await requireUser();
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.name);

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät anlegen</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm members={members} />
      </div>
    </div>
  );
}
