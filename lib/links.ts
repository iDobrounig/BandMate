export type LinkKind = "youtube" | "spotify" | "other";

export function detectLinkKind(url: string): LinkKind {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com")
      return "youtube";
    if (host === "open.spotify.com" || host === "spotify.com") return "spotify";
  } catch {
    // ungültige URL → other
  }
  return "other";
}

/** Extrahiert die YouTube-Video-ID und baut die Embed-URL. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") {
      id = u.pathname.slice(1).split("/")[0] || null;
    } else if (host === "youtube.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/"))
        id = u.pathname.split("/")[2] ?? null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

/** Baut die Spotify-Embed-URL für Track/Album/Playlist-Links. */
export function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("spotify.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // optionales Sprach-Präfix wie /intl-de/ überspringen
    if (parts[0]?.startsWith("intl-")) parts.shift();
    const [type, id] = parts;
    if (!type || !id || !["track", "album", "playlist", "artist"].includes(type))
      return null;
    if (!/^[A-Za-z0-9]{10,30}$/.test(id)) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}
