import { youtubeEmbedUrl, spotifyEmbedUrl } from "@/lib/links";
import type { SongLink } from "@/lib/db/schema";

export function LinkEmbed({ link }: { link: SongLink }) {
  if (link.kind === "youtube") {
    const src = youtubeEmbedUrl(link.url);
    if (src) {
      return (
        <div className="overflow-hidden rounded-xl border border-line-soft">
          <iframe
            src={src}
            title={link.label ?? "YouTube"}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }
  }
  if (link.kind === "spotify") {
    const src = spotifyEmbedUrl(link.url);
    if (src) {
      return (
        <div className="overflow-hidden rounded-xl">
          <iframe
            src={src}
            title={link.label ?? "Spotify"}
            className="h-[152px] w-full"
            allow="encrypted-media"
            loading="lazy"
          />
        </div>
      );
    }
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card block truncate px-4 py-3 text-sm text-accent-hi transition hover:border-accent/40"
    >
      ↗ {link.label || link.url}
    </a>
  );
}
