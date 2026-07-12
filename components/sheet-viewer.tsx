"use client";

import { useState } from "react";

/**
 * Klappt eine Noten-Datei inline auf: PDFs über den nativen Browser-Viewer
 * (<object>), Bilder als <img>. Fallback-Link für Browser ohne
 * Inline-PDF (z.B. iOS Safari).
 */
export function SheetViewer({
  fileId,
  mime,
  name,
}: {
  fileId: number;
  mime: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const url = `/api/files/${fileId}`;

  return (
    <div>
      <button
        type="button"
        className="text-xs text-mute transition hover:text-accent-hi cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾ zuklappen" : "▸ ansehen"}
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-line">
          {mime === "application/pdf" ? (
            <object
              data={url}
              type="application/pdf"
              className="h-[75vh] w-full bg-white"
              aria-label={name}
            >
              <p className="p-4 text-sm text-mute">
                Dein Browser zeigt PDFs nicht inline an.{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener"
                  className="text-accent-hi hover:underline"
                >
                  PDF in neuem Tab öffnen
                </a>
              </p>
            </object>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="w-full bg-white" />
          )}
        </div>
      )}
    </div>
  );
}
