import { db } from "@/lib/db";
import {
  users,
  songs,
  songLinks,
  attachments,
  comments,
  votes,
  practiceStatus,
  setlists,
  setlistItems,
  events,
  eventAttendance,
  eventSongs,
} from "@/lib/db/schema";

/** Datum relativ zu heute als ISO-Tag — hält Termin-Tests unabhängig vom Kalender. */
export function isoTag(offsetTage: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetTage);
  return d.toISOString().slice(0, 10);
}

/** Leert alle Tabellen. Reihenfolge: Kinder vor Eltern (FKs sind eingeschaltet). */
export async function leeren() {
  await db.delete(eventSongs);
  await db.delete(eventAttendance);
  await db.delete(events);
  await db.delete(setlistItems);
  await db.delete(setlists);
  await db.delete(practiceStatus);
  await db.delete(votes);
  await db.delete(comments);
  await db.delete(attachments);
  await db.delete(songLinks);
  await db.delete(songs);
  await db.delete(users);
}

/**
 * Legt einen überschaubaren, aber vollständigen Bandzustand an und gibt alle
 * IDs zurück. Bewusst asymmetrisch (unterschiedlich viele Votes, ein
 * deaktiviertes Mitglied, ein Song ohne alles), damit Tests echte Unterschiede
 * prüfen können statt symmetrischer Selbstverständlichkeiten.
 */
export async function anlegen() {
  await leeren();

  const [anna] = await db
    .insert(users)
    .values({ name: "Anna Admin", email: "anna@test.at", passwordHash: "x", role: "admin", instrument: "Gitarre" })
    .returning();
  const [bert] = await db
    .insert(users)
    .values({ name: "Bert Bass", email: "bert@test.at", passwordHash: "x", instrument: "Bass" })
    .returning();
  const [clara] = await db
    .insert(users)
    .values({ name: "Clara Cello", email: "clara@test.at", passwordHash: "x", instrument: "Cello" })
    .returning();
  // Ausgetretenes Mitglied — darf in Übersichten nicht mehr auftauchen.
  const [dora] = await db
    .insert(users)
    .values({ name: "Dora Draussen", email: "dora@test.at", passwordHash: "x", active: false })
    .returning();

  const [vorschlag] = await db
    .insert(songs)
    .values({
      title: "Neuer Vorschlag",
      artist: "Testband",
      status: "suggestion",
      suggestedById: bert.id,
      durationSeconds: 200,
    })
    .returning();
  const [inProbe] = await db
    .insert(songs)
    .values({ title: "In Probe", status: "rehearsing", tempoBpm: 120, durationSeconds: 180 })
    .returning();
  const [repertoire] = await db
    .insert(songs)
    .values({ title: "Sitzt Schon", status: "repertoire", songKey: "Am", durationSeconds: 240 })
    .returning();
  const [archiv] = await db
    .insert(songs)
    .values({ title: "Altes Zeug", status: "archived" })
    .returning();

  // Vorschlag: 2 dafür (Anna, Bert), 1 dagegen (Clara) -> Score +1
  await db.insert(votes).values([
    { songId: vorschlag.id, userId: anna.id, value: 1 },
    { songId: vorschlag.id, userId: bert.id, value: 1 },
    { songId: vorschlag.id, userId: clara.id, value: -1 },
  ]);

  await db.insert(comments).values([
    { songId: vorschlag.id, userId: anna.id, body: "Guter Vorschlag!" },
    { songId: vorschlag.id, userId: clara.id, body: "Eher nicht." },
  ]);

  await db.insert(attachments).values([
    { songId: inProbe.id, kind: "audio", storedName: "a.mp3", originalName: "probe.mp3", mime: "audio/mpeg", size: 100, uploadedById: anna.id },
    { songId: inProbe.id, kind: "sheet", instrument: "Bass", storedName: "b.pdf", originalName: "bass.pdf", mime: "application/pdf", size: 200, uploadedById: bert.id },
    { songId: inProbe.id, kind: "sheet", instrument: "Gitarre", storedName: "c.pdf", originalName: "gitarre.pdf", mime: "application/pdf", size: 300, uploadedById: anna.id },
  ]);

  await db.insert(songLinks).values({ songId: vorschlag.id, url: "https://youtu.be/x", kind: "youtube" });

  // Zwei können "In Probe", einer übt noch
  await db.insert(practiceStatus).values([
    { songId: inProbe.id, userId: anna.id, status: "ready" },
    { songId: inProbe.id, userId: bert.id, status: "ready" },
    { songId: inProbe.id, userId: clara.id, status: "practicing" },
  ]);

  const [setliste] = await db
    .insert(setlists)
    .values({ name: "Sommerfest", eventDate: isoTag(20) })
    .returning();
  const [leereSetliste] = await db
    .insert(setlists)
    .values({ name: "Noch leer" })
    .returning();

  await db.insert(setlistItems).values([
    { setlistId: setliste.id, songId: repertoire.id, position: 1, note: "Opener" },
    { setlistId: setliste.id, songId: inProbe.id, position: 2 },
  ]);

  const [kommenderGig] = await db
    .insert(events)
    .values({ title: "Sommerfest", kind: "gig", date: isoTag(20), startTime: "19:00", location: "Hauptplatz", setlistId: setliste.id, createdById: anna.id })
    .returning();
  const [kommendeProbe] = await db
    .insert(events)
    .values({ title: "Bandprobe", kind: "rehearsal", date: isoTag(3), startTime: "19:30", createdById: anna.id })
    .returning();
  const [alteProbe] = await db
    .insert(events)
    .values({ title: "Alte Probe", kind: "rehearsal", date: isoTag(-30), createdById: anna.id })
    .returning();

  await db.insert(eventAttendance).values([
    { eventId: kommenderGig.id, userId: anna.id, status: "yes" },
    { eventId: kommenderGig.id, userId: bert.id, status: "yes", comment: "komme später" },
    { eventId: kommenderGig.id, userId: clara.id, status: "maybe" },
  ]);

  await db.insert(eventSongs).values({ eventId: kommendeProbe.id, songId: inProbe.id, position: 1 });

  return {
    users: { anna, bert, clara, dora },
    songs: { vorschlag, inProbe, repertoire, archiv },
    setlists: { setliste, leereSetliste },
    events: { kommenderGig, kommendeProbe, alteProbe },
  };
}
