import { getIronSession, type SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";

export type SessionData = {
  userId?: number;
  /** Welche Band der User gerade bedient (Mandantenfähigkeit, Welle 4). */
  activeBandId?: number;
  /** Stand von users.sessionVersion beim Login — siehe currentUser(). */
  sessionVersion?: number;
};

const DEV_SECRET = "unsicheres-dev-geheimnis-bitte-in-env-aendern!!";

const password = process.env.SESSION_SECRET ?? DEV_SECRET;

/**
 * In Produktion ohne echtes SESSION_SECRET NICHT weiterlaufen: Mit dem im Repo
 * stehenden Dev-Geheimnis ließen sich Session-Cookies fälschen (= Login als
 * beliebiger User). Geprüft wird erst beim Session-Zugriff statt beim
 * Modul-Import — `next build` läuft auch mit NODE_ENV=production und braucht
 * kein Secret.
 */
function assertSecret() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEV_SECRET) {
    throw new Error(
      "SESSION_SECRET ist nicht gesetzt — in .env konfigurieren (mind. 32 Zeichen, z.B. `openssl rand -base64 32`)."
    );
  }
  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET ist zu kurz — mindestens 32 Zeichen.");
  }
}

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "bandmate_session",
  ttl: 60 * 60 * 24 * 90, // 90 Tage
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  // cookies() zuerst: Beim Prerender in `next build` steigt Next hier aus
  // (dynamische Seite), bevor die Secret-Prüfung greift.
  const cookieStore = await cookies();
  assertSecret();
  let isSecure = false;

  if (process.env.APP_URL?.startsWith("https://")) {
    isSecure = true;
  } else if (process.env.NODE_ENV === "production") {
    try {
      const headersList = await headers();
      const proto = headersList.get("x-forwarded-proto");
      isSecure = proto === "https";
    } catch {
      isSecure = false;
    }
  }

  const options: SessionOptions = {
    ...sessionOptions,
    cookieOptions: {
      ...sessionOptions.cookieOptions,
      secure: isSecure,
    },
  };

  return getIronSession<SessionData>(cookieStore, options);
}

