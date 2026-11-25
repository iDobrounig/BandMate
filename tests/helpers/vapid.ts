/**
 * Gültig geformtes VAPID-Schlüsselpaar NUR für Tests (nirgends sonst verwendet).
 * lib/push.ts prüft das Format der Schlüssel — Platzhalter wie "pub" gelten
 * dort als Fehlkonfiguration.
 */
export const TEST_VAPID = {
  VAPID_PUBLIC_KEY: "BPBfOp42goI4hr9qtCPEKxmsZlNKVOgSUKfNSUJJljjMwfksRpVA4YfnSzbxv462f_bcczMmlgd1tofkrNOb-Tg",
  VAPID_PRIVATE_KEY: "rZz2Plfp_yy0kcba3hEtD5IC0iixbjkJr-I5-f_2V_s",
  VAPID_SUBJECT: "mailto:test@example.com",
};
