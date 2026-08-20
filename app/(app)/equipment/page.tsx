import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentList } from "@/lib/queries";
import {
  EQUIPMENT_CATEGORY,
  EQUIPMENT_CATEGORY_ORDER,
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUS_ORDER,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EquipmentCategory, EquipmentStatus } from "@/lib/db/schema";
import { UndoBanner } from "@/components/undo-banner";
import {
  IconEquipment,
  IconMic,
  IconSpeaker,
  IconLightbulb,
  IconCable,
  IconBox,
} from "@/components/icons";

const CATEGORY_ICON: Record<EquipmentCategory, (p: { className?: string }) => React.ReactNode> = {
  amp: IconEquipment,
  mic: IconMic,
  pa_speaker: IconSpeaker,
  light: IconLightbulb,
  cable_accessory: IconCable,
  other: IconBox,
};

export const metadata = { title: "Equipment" };

type Search = { category?: string; status?: string; q?: string; undo?: string };

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireUser();
  const params = await searchParams;
  const category =
    params.category && EQUIPMENT_CATEGORY_ORDER.includes(params.category as EquipmentCategory)
      ? (params.category as EquipmentCategory)
      : undefined;
  const status =
    params.status && EQUIPMENT_STATUS_ORDER.includes(params.status as EquipmentStatus)
      ? (params.status as EquipmentStatus)
      : undefined;
  const q = (params.q ?? "").toLowerCase().trim();

  const all = await fetchEquipmentList();
  let list = category ? all.filter((e) => e.category === category) : all;
  if (status) list = list.filter((e) => e.status === status);
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));

  return (
    <div>
      <UndoBanner undo={params.undo} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-3xl">Equipment</h1>
          <p className="mt-1 text-sm text-mute">
            Gemeinsam angeschafftes Band-Equipment mit Kostenbeteiligungen.
          </p>
        </div>
        <Link href="/equipment/neu" className="btn btn-primary">
          + Gerät anlegen
        </Link>
      </div>

      <form className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/equipment" method="get">
        <input
          className="input w-full sm:max-w-64"
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Gerät suchen …"
        />
        <select className="input w-full sm:max-w-48" name="category" defaultValue={category ?? ""}>
          <option value="">Alle Kategorien</option>
          {EQUIPMENT_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{EQUIPMENT_CATEGORY[c].label}</option>
          ))}
        </select>
        <select className="input w-full sm:max-w-48" name="status" defaultValue={status ?? ""}>
          <option value="">Alle Zustände</option>
          {EQUIPMENT_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{EQUIPMENT_STATUS[s].label}</option>
          ))}
        </select>
        <button className="btn w-full sm:w-auto" type="submit">Filtern</button>
      </form>

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <div className="card p-10 text-center text-mute">
            {q || category || status ? "Nichts gefunden." : "Noch kein Equipment angelegt."}
          </div>
        )}
        {list.map((item) => {
          const categoryMeta = EQUIPMENT_CATEGORY[item.category];
          const statusMeta = EQUIPMENT_STATUS[item.status];
          const CategoryIcon = CATEGORY_ICON[item.category];
          return (
            <Link
              key={item.id}
              href={`/equipment/${item.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
            >
              <span
                className={`badge shrink-0 ${categoryMeta.badge}`}
                title={categoryMeta.label}
                aria-label={categoryMeta.label}
              >
                <CategoryIcon className="size-4 sm:hidden" />
                <span className="hidden sm:inline">{categoryMeta.label}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="truncate text-sm text-mute">
                  {item.location ?? "—"}
                  {item.acquisitionDate ? ` · angeschafft ${formatDate(item.acquisitionDate)}` : ""}
                </p>
              </div>
              <span className={`badge hidden shrink-0 sm:inline-flex ${statusMeta.badge}`}>
                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              <div className="mono-display hidden shrink-0 text-right text-xs text-mute sm:block">
                {item.acquisitionCost != null && <p>{item.acquisitionCost.toFixed(2)} €</p>}
                {item.contributionTotal > 0 && (
                  <p className="text-faint">{item.contributionTotal.toFixed(2)} € beigetragen</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
