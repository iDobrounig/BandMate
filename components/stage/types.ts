/** Ein Noten-Anhang eines Songs, wie ihn der Bühnenmodus braucht. */
export type StageSheet = {
  id: number;
  instrument: string | null;
  mime: string;
  originalName: string;
};

/** Ein Element der Setliste als Bühnen-Seite. Song-Felder sind bei
 *  section/break null. */
export type StagePage = {
  id: number;
  kind: "song" | "section" | "break";
  label: string | null; // Set-Name (section) bzw. Pausentext (break)
  breakSeconds: number | null;
  note: string | null; // Setlisten-Notiz am Element
  title: string | null;
  artist: string | null;
  songKey: string | null;
  capo: number | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
  lyricsChords: string | null;
  sheets: StageSheet[];
};
