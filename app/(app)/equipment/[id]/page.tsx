import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentDetail } from "@/lib/queries";
import { EQUIPMENT_CATEGORY, EQUIPMENT_STATUS } from "@/lib/constants";
import { formatDate, formatBytes, formatFee } from "@/lib/format";
import { EquipmentUploadForm, DeleteEquipmentAttachmentButton } from "@/components/equipment-attachments";
import { DeleteEquipmentButton } from "@/components/equipment-actions";
import { IconEdit } from "@/components/icons";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await fetchEquipmentDetail(Number(id));
  if (!data) notFound();

  const { equipment, contributions, attachments, createdByName } = data;
  const categoryMeta = EQUIPMENT_CATEGORY[equipment.category];
  const statusMeta = EQUIPMENT_STATUS[equipment.status];
  const photos = attachments.filter((a) => a.kind === "foto");
  const invoices = attachments.filter((a) => a.kind === "rechnung");
  const contributionTotal = contributions.reduce((acc, c) => acc + c.amount, 0);
  const diff = (equipment.acquisitionCost ?? 0) - contributionTotal - (equipment.treasuryAmount ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/equipment" className="text-sm text-mute hover:text-ink">
          ← Alles Equipment
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl">{equipment.name}</h1>
              <span className={`badge ${categoryMeta.badge}`}>{categoryMeta.label}</span>
              <span className={`badge ${statusMeta.badge}`}>
                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            {createdByName && <p className="mt-1 text-mute">angelegt von {createdByName}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/equipment/${equipment.id}/bearbeiten`} className="btn">
              <IconEdit className="size-4" /> Bearbeiten
            </Link>
            <DeleteEquipmentButton equipmentId={equipment.id} name={equipment.name} />
          </div>
        </div>

        <div className="card mt-4 p-4 sm:px-5 sm:py-3">
          <div className="mono-display flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              <span className="text-faint">STANDORT </span>
              {equipment.location ?? "–"}
            </span>
            <span>
              <span className="text-faint">ANGESCHAFFT </span>
              {formatDate(equipment.acquisitionDate)}
            </span>
            <span>
              <span className="text-faint">KOSTEN </span>
              {equipment.acquisitionCost != null ? formatFee(equipment.acquisitionCost) : "–"}
            </span>
            <span>
              <span className="text-faint">BEITRÄGE </span>
              {formatFee(contributionTotal)}
            </span>
            <span>
              <span className="text-faint">BANDKASSE </span>
              {equipment.treasuryAmount != null ? formatFee(equipment.treasuryAmount) : "–"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <h2 className="headline text-lg">Fotos</h2>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((file) => (
                  <div key={file.id} className="card space-y-2 p-2">
                    <a href={`/api/equipment-files/${file.id}`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/equipment-files/${file.id}`}
                        alt={file.originalName}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </a>
                    <div className="flex items-center justify-between gap-2 px-1 pb-1">
                      <span className="truncate text-xs text-faint">{file.originalName}</span>
                      <DeleteEquipmentAttachmentButton attachmentId={file.id} name={file.originalName} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {photos.length === 0 && <p className="text-sm text-faint">Noch keine Fotos hochgeladen.</p>}
            <EquipmentUploadForm equipmentId={equipment.id} kind="foto" />
          </section>

          <section className="space-y-3">
            <h2 className="headline text-lg">Rechnungen &amp; Belege</h2>
            {invoices.length > 0 && (
              <ul className="space-y-2">
                {invoices.map((file) => (
                  <li key={file.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                    <a
                      className="min-w-0 flex-1 truncate text-accent-hi hover:underline"
                      href={`/api/equipment-files/${file.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      {file.originalName}
                    </a>
                    <span className="shrink-0 text-xs text-faint">{formatBytes(file.size)}</span>
                    <a
                      className="shrink-0 text-xs text-accent-hi hover:underline"
                      href={`/api/equipment-files/${file.id}?download=1`}
                    >
                      Download
                    </a>
                    <DeleteEquipmentAttachmentButton attachmentId={file.id} name={file.originalName} />
                  </li>
                ))}
              </ul>
            )}
            {invoices.length === 0 && <p className="text-sm text-faint">Noch keine Rechnungen hochgeladen.</p>}
            <EquipmentUploadForm equipmentId={equipment.id} kind="rechnung" />
          </section>

          {equipment.notes && (
            <section>
              <h2 className="headline mb-3 text-lg">Notizen</h2>
              <div className="card p-5 text-sm whitespace-pre-wrap">{equipment.notes}</div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-8">
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Beteiligungen</h2>
            {contributions.length === 0 ? (
              <p className="text-sm text-faint">Noch keine Beteiligungen eingetragen.</p>
            ) : (
              <ul className="space-y-2">
                {contributions.map((c) => (
                  <li key={c.userId} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{c.userName}</span>
                      <span className="mono-display shrink-0">{formatFee(c.amount)}</span>
                    </div>
                    {c.note && <p className="text-xs text-faint">{c.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mono-display mt-4 border-t border-line-soft pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-faint">SUMME</span>
                <span>{formatFee(contributionTotal)}</span>
              </div>
              {equipment.treasuryAmount != null && equipment.treasuryAmount > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-faint">BANDKASSE</span>
                  <span>{formatFee(equipment.treasuryAmount)}</span>
                </div>
              )}
              {equipment.acquisitionCost != null && Math.abs(diff) > 0.001 && (
                <div className="mt-1 flex items-center justify-between text-amber-300">
                  <span className="text-faint">{diff > 0 ? "OFFEN" : "MEHR ALS KOSTEN"}</span>
                  <span>{formatFee(Math.abs(diff))}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
