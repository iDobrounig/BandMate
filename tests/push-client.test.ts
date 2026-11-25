import { describe, expect, it } from "vitest";
import { passtZumSchluessel } from "@/lib/push-client";

/** Ein Abo, wie der Browser es liefert — nur der für den Vergleich nötige Teil. */
const abo = (schluessel: string | null) =>
  ({
    options: {
      applicationServerKey: schluessel
        ? new Uint8Array(Buffer.from(schluessel, "base64url")).buffer
        : null,
    },
  }) as unknown as PushSubscription;

const KEY_A =
  "BK7Gsftp1cmlkfTBg3s73C1iP30ikHsW2LHr-oG2E1aQj0VCGcs6rdLYKG2d4oCUet7MYf3cNrURRG-qqbAAR74";
const KEY_B =
  "BPED8IfgcdPWse5EnRFN3I5wD_ftcJ8A7olpvKNT7QDricaYwFeuddzHGm3KDMYk8VCeMkYZbAc0GUB0risFKsY";

describe("passtZumSchluessel", () => {
  it("erkennt ein Abo zum aktuellen Server-Schlüssel", () => {
    expect(passtZumSchluessel(abo(KEY_A), KEY_A)).toBe(true);
  });

  it("erkennt ein Abo zu einem alten Schlüssel (nach Schlüsselwechsel)", () => {
    expect(passtZumSchluessel(abo(KEY_A), KEY_B)).toBe(false);
  });

  it("ohne Schlüssel im Abo: passt nicht", () => {
    expect(passtZumSchluessel(abo(null), KEY_A)).toBe(false);
  });
});
