// Liefert die Build-Kennung des laufenden Servers — Grundlage für den
// Update-Banner. Bewusst dynamisch und ungecacht, damit ein neuer Deploy
// sofort sichtbar wird.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      build: process.env.NEXT_PUBLIC_APP_BUILD ?? "",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
