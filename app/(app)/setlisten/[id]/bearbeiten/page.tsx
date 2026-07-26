import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists } from "@/lib/db/schema";
import { setlistAktiv } from "@/lib/db/filters";
import { SetlistForm } from "@/components/setlist-forms";

export const metadata = { title: "Setliste bearbeiten" };

export default async function SetlistBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const setlistId = Number(id);

  const setlist = await db.query.setlists.findFirst({
    where: and(eq(setlists.id, setlistId), setlistAktiv),
  });
  if (!setlist) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href={`/setlisten/${setlist.id}`}
        className="text-sm text-mute hover:text-ink"
      >
        ← Zurück zur Setliste
      </Link>
      <h1 className="headline mt-3 text-3xl">„{setlist.name}" bearbeiten</h1>
      <div className="card mt-8 p-6">
        <SetlistForm setlist={setlist} />
      </div>
    </div>
  );
}
