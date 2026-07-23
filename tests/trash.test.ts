import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { db, uploadsDir } from "@/lib/db";
import { songs, events, attachments, setlists } from "@/lib/db/schema";
import {
  fetchTrash,
  fetchTrashLabel,
  parseUndo,
  restore,
  purge,
  purgeExpired,
} from "@/lib/trash";
import { fetchSongList, fetchEvents, fetchSongReferences } from "@/lib/queries";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const loeschen = (id: number, wann = new Date()) =>
  db.update(songs).set({ deletedAt: wann, deletedById: f.users.anna.id }).where(eq(songs.id, id));

/** Zeitpunkt, der garantiert außerhalb der Aufbewahrungsfrist liegt. */
const langeHer = () =>
  new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);

describe("Papierkorb-Liste", () => {
  it("ist leer, solange nichts gelöscht wurde", async () => {
    expect(await fetchTrash()).toHaveLength(0);
  });

  it("nennt Bezeichnung, Löschenden und Restlaufzeit", async () => {
    await loeschen(f.songs.vorschlag.id);
    const [eintrag] = await fetchTrash();
    expect(eintrag.kind).toBe("song");
    expect(eintrag.label).toBe("Neuer Vorschlag");
    expect(eintrag.deletedByName).toBe("Anna Admin");
    expect(eintrag.restTage).toBe(TRASH_RETENTION_DAYS);
    expect(eintrag.count).toBe(1);
  });

  it("sortiert das zuletzt Gelöschte nach oben", async () => {
    await loeschen(f.songs.vorschlag.id, new Date(Date.now() - 60_000));
    await loeschen(f.songs.archiv.id, new Date());
    const liste = await fetchTrash();
    expect(liste.map((e) => e.label)).toEqual(["Altes Zeug", "Neuer Vorschlag"]);
  });
});

describe("Terminserien im Papierkorb", () => {
  async function serieAnlegen() {
    const rows = await db
      .insert(events)
      .values(
        [4, 11, 18].map((tag) => ({
          title: "Wochenprobe",
          kind: "rehearsal" as const,
          date: isoTag(tag),
          seriesId: "serie-1",
          createdById: f.users.anna.id,
        }))
      )
      .returning();
    return rows;
  }

  it("fasst eine gesammelt gelöschte Serie zu einem Eintrag zusammen", async () => {
    const serie = await serieAnlegen();
    const wann = new Date();
    await db
      .update(events)
      .set({ deletedAt: wann, deletedById: f.users.anna.id })
      .where(eq(events.seriesId, "serie-1"));

    const liste = await fetchTrash();
    expect(liste).toHaveLength(1);
    expect(liste[0].label).toBe("Serie: Wochenprobe");
    expect(liste[0].count).toBe(3);
    expect(liste[0].sublabel).toContain("3 Termine");
    expect(serie).toHaveLength(3);
  });

  it("lässt einen einzeln gelöschten Serientermin für sich stehen", async () => {
    const serie = await serieAnlegen();
    await db
      .update(events)
      .set({ deletedAt: new Date(), deletedById: f.users.anna.id })
      .where(eq(events.id, serie[1].id));

    const liste = await fetchTrash();
    expect(liste).toHaveLength(1);
    expect(liste[0].label).toBe("Wochenprobe"); // ohne "Serie:"
    expect(liste[0].count).toBe(1);
  });

  it("hält zwei Löschvorgänge derselben Serie auseinander", async () => {
    const serie = await serieAnlegen();
    // Drizzle speichert timestamp in SEKUNDEN — die beiden Zeitpunkte müssen
    // sich um mindestens eine Sekunde unterscheiden, sonst verschmelzen sie.
    const frueher = new Date(Date.now() - 5_000);
    const spaeter = new Date();

    await db
      .update(events)
      .set({ deletedAt: frueher, deletedById: f.users.anna.id })
      .where(eq(events.id, serie[0].id));
    await db
      .update(events)
      .set({ deletedAt: frueher, deletedById: f.users.anna.id })
      .where(eq(events.id, serie[1].id));
    await db
      .update(events)
      .set({ deletedAt: spaeter, deletedById: f.users.anna.id })
      .where(eq(events.id, serie[2].id));

    const liste = await fetchTrash();
    expect(liste).toHaveLength(2);
    // Neuester Eintrag zuerst: der einzeln gelöschte dritte Termin
    expect(liste.map((e) => e.count)).toEqual([1, 2]);

    // Wiederherstellen holt nur die eigene Gruppe zurück
    expect(await restore("event", serie[0].id)).toBe(2);
    const rest = await fetchTrash();
    expect(rest).toHaveLength(1);
    expect(rest[0].count).toBe(1);
  });

  it("holt eine ganze Serie gemeinsam zurück", async () => {
    const serie = await serieAnlegen();
    await db
      .update(events)
      .set({ deletedAt: new Date(), deletedById: f.users.anna.id })
      .where(eq(events.seriesId, "serie-1"));

    expect(await restore("event", serie[0].id)).toBe(3);
    const kommend = await fetchEvents(f.users.anna.id);
    expect(kommend.filter((e) => e.title === "Wochenprobe")).toHaveLength(3);
  });
});

describe("wiederherstellen", () => {
  it("bringt den Song zurück in die Liste", async () => {
    await loeschen(f.songs.vorschlag.id);
    expect(await restore("song", f.songs.vorschlag.id)).toBe(1);
    const liste = await fetchSongList(f.users.anna.id);
    expect(liste.map((s) => s.id)).toContain(f.songs.vorschlag.id);
    expect(await fetchTrash()).toHaveLength(0);
  });

  it("tut nichts bei einem gar nicht gelöschten Eintrag", async () => {
    expect(await restore("song", f.songs.vorschlag.id)).toBe(0);
  });
});

describe("endgültig löschen", () => {
  it("entfernt den Song samt Dateien von der Platte", async () => {
    // Echte Datei anlegen, damit das Aufräumen der Platte prüfbar ist
    const [datei] = await db.select().from(attachments).where(eq(attachments.songId, f.songs.inProbe.id)).limit(1);
    const ordner = `${uploadsDir}/${f.songs.inProbe.id}`;
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(`${ordner}/${datei.storedName}`, "inhalt");
    expect(fs.existsSync(`${ordner}/${datei.storedName}`)).toBe(true);

    await loeschen(f.songs.inProbe.id);
    expect(await purge("song", f.songs.inProbe.id)).toBe(1);

    expect(fs.existsSync(`${ordner}/${datei.storedName}`)).toBe(false);
    const rest = await db.select().from(songs).where(eq(songs.id, f.songs.inProbe.id));
    expect(rest).toHaveLength(0);
    // Anhang-Zeilen sind per Cascade mitgegangen
    const anhaenge = await db.select().from(attachments).where(eq(attachments.songId, f.songs.inProbe.id));
    expect(anhaenge).toHaveLength(0);
  });

  it("weigert sich bei einem Eintrag, der nicht im Papierkorb liegt", async () => {
    expect(await purge("song", f.songs.inProbe.id)).toBe(0);
    const rest = await db.select().from(songs).where(eq(songs.id, f.songs.inProbe.id));
    expect(rest).toHaveLength(1);
  });
});

describe("automatisches Aufräumen", () => {
  it("räumt nur Abgelaufenes weg und lässt Frisches liegen", async () => {
    await loeschen(f.songs.vorschlag.id, langeHer());
    // Bewusst gestern statt jetzt: bei "jetzt" wäre der Zeitstempel gleich der
    // Vergleichsgrenze, und der Test liefe auch dann grün, wenn die Frist gar
    // nicht beachtet würde (Drizzle speichert timestamp sekundengenau).
    await loeschen(f.songs.archiv.id, new Date(Date.now() - 24 * 60 * 60 * 1000));

    const bericht = await purgeExpired();
    expect(bericht.song).toBe(1);

    const liste = await fetchTrash();
    expect(liste.map((e) => e.label)).toEqual(["Altes Zeug"]);
  });

  it("räumt einen abgelaufenen Einzel-Anhang weg, ohne den Song zu berühren", async () => {
    const [datei] = await db.select().from(attachments).where(eq(attachments.songId, f.songs.inProbe.id)).limit(1);
    await db
      .update(attachments)
      .set({ deletedAt: langeHer(), deletedById: f.users.anna.id })
      .where(eq(attachments.id, datei.id));

    const bericht = await purgeExpired();
    expect(bericht.attachment).toBe(1);
    expect(bericht.song).toBe(0);

    const song = await db.select().from(songs).where(eq(songs.id, f.songs.inProbe.id));
    expect(song).toHaveLength(1);
  });

  it("räumt eine abgelaufene Serie in einem Rutsch weg", async () => {
    await db.insert(events).values(
      [4, 11].map((tag) => ({
        title: "Alte Serie",
        kind: "rehearsal" as const,
        date: isoTag(tag),
        seriesId: "serie-alt",
        deletedAt: langeHer(),
        deletedById: f.users.anna.id,
      }))
    );

    const bericht = await purgeExpired();
    expect(bericht.event).toBe(2);
    const rest = await db.select().from(events).where(eq(events.seriesId, "serie-alt"));
    expect(rest).toHaveLength(0);
  });
});

describe("Rückgängig-Band", () => {
  it("liest gültige Parameter und weist Unsinn ab", () => {
    expect(parseUndo("song:42")).toEqual({ kind: "song", id: 42 });
    expect(parseUndo("event:7")).toEqual({ kind: "event", id: 7 });
    expect(parseUndo(undefined)).toBeNull();
    expect(parseUndo("quatsch:1")).toBeNull();
    expect(parseUndo("song:abc")).toBeNull();
    expect(parseUndo("song:-1")).toBeNull();
    expect(parseUndo("song")).toBeNull();
  });

  it("liefert die Bezeichnung nur, solange der Eintrag wirklich im Papierkorb liegt", async () => {
    expect(await fetchTrashLabel("song", f.songs.vorschlag.id)).toBeNull();
    await loeschen(f.songs.vorschlag.id);
    expect(await fetchTrashLabel("song", f.songs.vorschlag.id)).toBe("Neuer Vorschlag");
    await restore("song", f.songs.vorschlag.id);
    expect(await fetchTrashLabel("song", f.songs.vorschlag.id)).toBeNull();
  });
});

describe("Verweise für den Löschdialog", () => {
  it("zählt Setlisten und Probe-Agenden, in denen der Song vorkommt", async () => {
    expect(await fetchSongReferences(f.songs.inProbe.id)).toEqual({
      setlistCount: 1,
      agendaCount: 1,
    });
    expect(await fetchSongReferences(f.songs.repertoire.id)).toEqual({
      setlistCount: 1,
      agendaCount: 0,
    });
    expect(await fetchSongReferences(f.songs.archiv.id)).toEqual({
      setlistCount: 0,
      agendaCount: 0,
    });
  });

  it("zählt Verweise aus gelöschten Setlisten nicht mit", async () => {
    await db
      .update(setlists)
      .set({ deletedAt: new Date(), deletedById: f.users.anna.id })
      .where(eq(setlists.id, f.setlists.setliste.id));
    expect((await fetchSongReferences(f.songs.repertoire.id)).setlistCount).toBe(0);
  });
});
