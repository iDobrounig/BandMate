import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// lib/db liest DATA_DIR beim Import und legt ein prozessweites Singleton an.
// Das hier läuft als setupFile VOR dem Modulcode der Testdatei — nur deshalb
// landet die Test-DB im Temp-Verzeichnis und nicht in data/.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bandmate-test-"));
process.env.DATA_DIR = dir;
process.env.SESSION_SECRET = "nur-fuer-tests-mindestens-32-zeichen-lang";
delete process.env.SMTP_HOST; // kein Mailversand aus Tests

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
