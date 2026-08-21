import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { currentUser, fetchMemberships } from "@/lib/auth";
import { fetchServableAttachment } from "@/lib/queries";
import { attachmentPath } from "@/lib/files";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });

  const { id } = await ctx.params;
  const bandIds = (await fetchMemberships(user.id)).map((m) => m.bandId);
  const attachment = await fetchServableAttachment(Number(id), bandIds);
  if (!attachment) return new Response("Nicht gefunden", { status: 404 });

  const filePath = attachmentPath(attachment.songId, attachment.storedName);
  if (!fs.existsSync(filePath)) {
    return new Response("Datei fehlt auf dem Server", { status: 404 });
  }
  const stat = fs.statSync(filePath);

  const download = req.nextUrl.searchParams.has("download");
  // Aufnahmen tragen als originalName nur die frei vergebene Bezeichnung ohne
  // Endung (anders als Uploads, deren originalName vom Datei-Input kommt) —
  // die tatsächliche Endung liegt im storedName, sonst fehlt sie beim Download.
  const ext = path.extname(attachment.storedName);
  const filename = attachment.originalName.toLowerCase().endsWith(ext.toLowerCase())
    ? attachment.originalName
    : `${attachment.originalName}${ext}`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": attachment.mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
      filename
    )}`,
    "Cache-Control": "private, max-age=3600",
  };

  // Range-Support, damit Audio-Seeking im Browser funktioniert
  const range = req.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2]
      ? Math.min(parseInt(match[2], 10), stat.size - 1)
      : stat.size - 1;
    if (Number.isNaN(start) || start > end || start >= stat.size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(stat.size) },
  });
}
