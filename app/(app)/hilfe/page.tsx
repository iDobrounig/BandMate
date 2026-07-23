export const metadata = { title: "Hilfe" };

function HilfeSection({
  id,
  title,
  intro,
  bullets,
  images,
}: {
  id: string;
  title: string;
  intro: string;
  bullets: string[];
  images?: { src: string; alt: string }[];
}) {
  return (
    <section id={id} className="card scroll-mt-20 p-5 sm:p-6">
      <h2 className="headline text-xl">{title}</h2>
      <p className="mt-1 text-sm text-mute">{intro}</p>

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div className="mt-5 space-y-4">
        {(images ?? []).map((img) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="w-full rounded-lg border border-line-soft"
          />
        ))}
      </div>
    </section>
  );
}

export default function HilfePage() {
  return (
    <div className="max-w-3xl">
      <h1 className="headline text-3xl">Hilfe</h1>
      <p className="mt-1 text-sm text-mute">
        Kurzanleitung zu den wichtigsten Funktionen von BandMate.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href="#songs" className="btn btn-sm">
          Songs
        </a>
        <a href="#setlisten" className="btn btn-sm">
          Setlisten
        </a>
        <a href="#termine" className="btn btn-sm">
          Termine
        </a>
        <a href="#profil" className="btn btn-sm">
          Profil
        </a>
        <a href="#papierkorb" className="btn btn-sm">
          Papierkorb
        </a>
      </nav>

      <div className="mt-8 space-y-8">
        <HilfeSection
          id="songs"
          title="Songs"
          intro="Hier sammelt ihr alle Songs der Band — von der ersten Idee bis zum fixen Repertoire-Stück."
          bullets={[
            "Song vorschlagen mit Titel, Interpret, YouTube-/Spotify-Link",
            "Status-Workflow: Vorschlag → In Probe → Repertoire → Archiv",
            "Abstimmen (👍/👎), ob ihr den Song spielen wollt",
            "Eigenen Übe-Status setzen (Noch nicht angeschaut / Übe noch / Kann ich) — für alle sichtbar",
            "Kommentare im Bandchat direkt beim Song",
            "Noten (PDF/Bild) und Audio-Aufnahmen hochladen und abspielen",
            "Lyrics & Akkorde mit Transponier-Funktion (±Halbton, auch für Capo)",
            "Eingebautes Metronom mit Tap-Tempo",
          ]}
          images={[
            { src: "/hilfe/songs-liste.png", alt: "Songliste mit Status-Übersicht" },
            {
              src: "/hilfe/song-detail.png",
              alt: "Song-Detailseite mit Akkorden, Transponieren, Übe-Status und Bandchat",
            },
            {
              src: "/hilfe/song-voting.png",
              alt: "Abstimmung, ob ein vorgeschlagener Song gespielt werden soll",
            },
          ]}
        />

        <HilfeSection
          id="setlisten"
          title="Setlisten"
          intro="Setlisten fassen Songs für einen Gig oder eine Probe zusammen — in der Reihenfolge, in der ihr sie spielt."
          bullets={[
            "Beliebig viele Setlisten anlegen, Songs per Drag & Drop sortieren",
            "Notiz pro Song, z.B. „Opener\" oder „Pause danach\"",
            "Gesamtdauer wird automatisch berechnet",
            "Druckansicht für Bühne oder Backstage",
            "Setliste duplizieren, z.B. als Vorlage für den nächsten Gig",
          ]}
          images={[
            { src: "/hilfe/setlisten-liste.png", alt: "Übersicht aller Setlisten" },
            {
              src: "/hilfe/setlisten-detail.png",
              alt: "Setliste bearbeiten mit Reihenfolge, Notizen und Aktionen",
            },
          ]}
        />

        <HilfeSection
          id="termine"
          title="Termine"
          intro="Alle Proben und Gigs auf einen Blick — mit Zu- und Absagen der ganzen Band."
          bullets={[
            "Probe oder Gig anlegen, wöchentliche Probe-Serie möglich",
            "Zusagen, Vielleicht oder Absagen — mit optionalem Kommentar",
            "Probe-Agenda: welche Songs bei dieser Probe drankommen",
            "Setliste mit einem Termin verknüpfen",
            "Kalender abonnieren (ICS-Feed) — Termine erscheinen automatisch im eigenen Kalender (iPhone, Google Kalender, …)",
          ]}
          images={[
            { src: "/hilfe/termine-liste.png", alt: "Terminübersicht mit Zu-/Absagen" },
            {
              src: "/hilfe/termin-detail.png",
              alt: "Termin-Detailseite mit Rückmeldungen und Probe-Agenda",
            },
            {
              src: "/hilfe/termine-abo.png",
              alt: "Kalender-Abo-URL zum Einbinden in die eigene Kalender-App",
            },
          ]}
        />

        <HilfeSection
          id="profil"
          title="Profil"
          intro="Eure eigenen Zugangsdaten und Benachrichtigungen."
          bullets={[
            "Name, E-Mail-Adresse und Instrument selbst ändern",
            "Eigenes Passwort ändern",
            "E-Mail-Benachrichtigungen (neue Vorschläge, Kommentare, Termine) an- oder abschalten",
            "Passwort vergessen? Auf der Anmeldeseite „Passwort vergessen?\" — der Link kommt per E-Mail und gilt eine Stunde",
          ]}
          images={[
            { src: "/hilfe/profil.png", alt: "Profilseite mit Stammdaten und Passwort ändern" },
          ]}
        />
        <HilfeSection
          id="papierkorb"
          title="Papierkorb"
          intro="Nichts ist sofort weg: Gelöschtes lässt sich 30 Tage lang zurückholen."
          bullets={[
            "Songs, Setlisten, Termine und hochgeladene Dateien landen beim Löschen im Papierkorb — erreichbar über den Link ganz unten auf jeder Seite",
            "Direkt nach dem Löschen erscheint oben auf der Liste ein „Rückgängig\" — der schnellste Weg, wenn du danebengetippt hast",
            "Wiederherstellen darf jedes Mitglied; endgültig löschen nur ein Admin",
            "Ein gelöschter Song verschwindet aus Setlisten und Probe-Agenden — beim Wiederherstellen steht er wieder an genau derselben Stelle",
            "Nach 30 Tagen wird endgültig gelöscht, auch die Noten und Aufnahmen",
            "Der Papierkorb ist kein Backup: er schützt gegen versehentliches Löschen, nicht gegen einen Serverausfall",
          ]}
        />
      </div>
    </div>
  );
}
