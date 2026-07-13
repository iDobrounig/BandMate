import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: number;
};

const password =
  process.env.SESSION_SECRET ??
  "unsicheres-dev-geheimnis-bitte-in-env-aendern!!";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn(
    "WARNUNG: SESSION_SECRET ist nicht gesetzt — bitte in .env konfigurieren!"
  );
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
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
