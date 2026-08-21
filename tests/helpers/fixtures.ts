import { db } from "@/lib/db";
import {
  bands,
  bandMembers,
  invites,
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
  notificationSettings,
  notificationLog,
  notificationRuns,
  equipment,
  equipmentContributions,
  equipmentAttachments,
} from "@/lib/db/schema";

/** Datum relativ zu heute als ISO-Tag — hält Termin-Tests unabhängig vom Kalender. */
export function isoTag(offsetTage: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetTage);
  return d.toISOString().slice(0, 10);
}

/** Leert alle Tabellen. Reihenfolge: Kinder vor Eltern (FKs sind eingeschaltet). */
export async function leeren() {
  // notificationLog/-settings hängen per Cascade an users, notificationRuns
  // aber an nichts — deshalb hier alle drei ausdrücklich leeren, sonst
  // akkumulieren die Läufe über Tests hinweg.
  await db.delete(equipmentAttachments);
  await db.delete(equipmentContributions);
  await db.delete(equipment);
  await db.delete(notificationLog);
  await db.delete(notificationRuns);
  await db.delete(notificationSettings);
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
  await db.delete(invites);
  await db.delete(bandMembers);
  await db.delete(users);
  await db.delete(bands);
}

/**
 * Legt einen überschaubaren, aber vollständigen Bandzustand an und gibt alle
 * IDs zurück. Bewusst asymmetrisch (unterschiedlich viele Votes, ein
 * deaktiviertes Mitglied, ein Song ohne alles), damit Tests echte Unterschiede
 * prüfen können statt symmetrischer Selbstverständlichkeiten.
 */
export async function anlegen() {
  await leeren();

  const [band] = await db
    .insert(bands)
    .values({ name: "Testband", calendarToken: "test-token-1" })
    .returning();

  const [anna] = await db
    .insert(users)
    .values({ name: "Anna Admin", email: "anna@test.at", passwordHash: "x" })
    .returning();
  const [bert] = await db
    .insert(users)
    .values({ name: "Bert Bass", email: "bert@test.at", passwordHash: "x" })
    .returning();
  const [clara] = await db
    .insert(users)
    .values({ name: "Clara Cello", email: "clara@test.at", passwordHash: "x" })
    .returning();
  // Ausgetretenes Mitglied — darf in Übersichten nicht mehr auftauchen.
  const [dora] = await db
    .insert(users)
    .values({ name: "Dora Draussen", email: "dora@test.at", passwordHash: "x", active: false })
    .returning();

  // Rolle + Instrument leben pro Band in band_members. Dora ist bandlokal
  // inaktiv (ausgetreten).
  await db.insert(bandMembers).values([
    { bandId: band.id, userId: anna.id, role: "band_admin", instrument: "Gitarre" },
    { bandId: band.id, userId: bert.id, instrument: "Bass" },
    { bandId: band.id, userId: clara.id, instrument: "Cello" },
    { bandId: band.id, userId: dora.id, active: false },
  ]);

  const [vorschlag] = await db
    .insert(songs)
    .values({
      bandId: band.id,
      title: "Neuer Vorschlag",
      artist: "Testband",
      status: "suggestion",
      suggestedById: bert.id,
      durationSeconds: 200,
    })
    .returning();
  const [inProbe] = await db
    .insert(songs)
    .values({ bandId: band.id, title: "In Probe", status: "rehearsing", tempoBpm: 120, durationSeconds: 180 })
    .returning();
  const [repertoire] = await db
    .insert(songs)
    .values({ bandId: band.id, title: "Sitzt Schon", status: "repertoire", songKey: "Am", durationSeconds: 240 })
    .returning();
  const [archiv] = await db
    .insert(songs)
    .values({ bandId: band.id, title: "Altes Zeug", status: "archived" })
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
    .values({ bandId: band.id, name: "Sommerfest", eventDate: isoTag(20) })
    .returning();
  const [leereSetliste] = await db
    .insert(setlists)
    .values({ bandId: band.id, name: "Noch leer" })
    .returning();

  await db.insert(setlistItems).values([
    { setlistId: setliste.id, songId: repertoire.id, position: 1, note: "Opener" },
    { setlistId: setliste.id, songId: inProbe.id, position: 2 },
  ]);

  const [kommenderGig] = await db
    .insert(events)
    .values({ bandId: band.id, title: "Sommerfest", kind: "gig", date: isoTag(20), startTime: "19:00", location: "Hauptplatz", setlistId: setliste.id, createdById: anna.id })
    .returning();
  const [kommendeProbe] = await db
    .insert(events)
    .values({ bandId: band.id, title: "Bandprobe", kind: "rehearsal", date: isoTag(3), startTime: "19:30", createdById: anna.id })
    .returning();
  const [alteProbe] = await db
    .insert(events)
    .values({ bandId: band.id, title: "Alte Probe", kind: "rehearsal", date: isoTag(-30), createdById: anna.id })
    .returning();

  await db.insert(eventAttendance).values([
    { eventId: kommenderGig.id, userId: anna.id, status: "yes" },
    { eventId: kommenderGig.id, userId: bert.id, status: "yes", comment: "komme später" },
    { eventId: kommenderGig.id, userId: clara.id, status: "maybe" },
  ]);

  await db.insert(eventSongs).values({ eventId: kommendeProbe.id, songId: inProbe.id, position: 1 });

  const [verstaerker] = await db
    .insert(equipment)
    .values({
      bandId: band.id,
      name: "Marshall JCM800",
      category: "amp",
      status: "in_use",
      acquisitionDate: isoTag(-200),
      acquisitionCost: 900,
      location: "Proberaum",
      createdById: anna.id,
    })
    .returning();
  const [mikrofon] = await db
    .insert(equipment)
    .values({ bandId: band.id, name: "Shure SM58", category: "mic", createdById: bert.id })
    .returning();

  await db.insert(equipmentContributions).values([
    { equipmentId: verstaerker.id, userId: anna.id, amount: 500, note: "Vorschuss" },
    { equipmentId: verstaerker.id, userId: bert.id, amount: 400 },
  ]);

  await db.insert(equipmentAttachments).values([
    {
      equipmentId: verstaerker.id,
      kind: "foto",
      storedName: "amp.jpg",
      originalName: "amp-foto.jpg",
      mime: "image/jpeg",
      size: 1000,
      uploadedById: anna.id,
    },
    {
      equipmentId: verstaerker.id,
      kind: "rechnung",
      storedName: "amp.pdf",
      originalName: "rechnung.pdf",
      mime: "application/pdf",
      size: 2000,
      uploadedById: anna.id,
    },
  ]);

  return {
    band,
    bandId: band.id,
    users: { anna, bert, clara, dora },
    songs: { vorschlag, inProbe, repertoire, archiv },
    setlists: { setliste, leereSetliste },
    events: { kommenderGig, kommendeProbe, alteProbe },
    equipment: { verstaerker, mikrofon },
  };
}

/**
 * Zweite Band mit eigenem Mitglied, Song, Setliste, Termin und Equipment —
 * für die Scoping-Tests (Welle 4): jede Lesefunktion darf ausschließlich
 * Inhalte der übergebenen Band liefern.
 */
export async function zweiteBandAnlegen() {
  const [band] = await db
    .insert(bands)
    .values({ name: "Fremdband", calendarToken: "test-token-2" })
    .returning();
  const [egon] = await db
    .insert(users)
    .values({ name: "Egon Fremd", email: "egon@fremd.at", passwordHash: "x" })
    .returning();
  await db
    .insert(bandMembers)
    .values({ bandId: band.id, userId: egon.id, role: "band_admin", instrument: "Keyboard" });

  const [song] = await db
    .insert(songs)
    .values({ bandId: band.id, title: "Fremder Song", status: "repertoire", durationSeconds: 210 })
    .returning();
  const [setliste] = await db
    .insert(setlists)
    .values({ bandId: band.id, name: "Fremdsetliste", eventDate: isoTag(15) })
    .returning();
  await db.insert(setlistItems).values({ setlistId: setliste.id, songId: song.id, position: 1 });
  const [event] = await db
    .insert(events)
    .values({ bandId: band.id, title: "Fremdprobe", kind: "rehearsal", date: isoTag(5), createdById: egon.id })
    .returning();
  const [equip] = await db
    .insert(equipment)
    .values({ bandId: band.id, name: "Fremd-Amp", category: "amp", createdById: egon.id })
    .returning();

  return { band, bandId: band.id, users: { egon }, songs: { song }, setlists: { setliste }, events: { event }, equipment: { equip } };
}
