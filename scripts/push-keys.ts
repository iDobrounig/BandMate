/**
 * Erzeugt ein VAPID-Schlüsselpaar für Web Push.
 *
 *   npm run push:keys
 *
 * Die drei Zeilen in die .env übernehmen (VAPID_SUBJECT anpassen: eine
 * Kontaktadresse als mailto: oder https://-URL) und die App neu starten
 * (pm2 restart ecosystem.config.js --update-env).
 *
 * ACHTUNG: Ein NEUES Schlüsselpaar macht alle bestehenden Push-Abos ungültig —
 * alle Mitglieder müssen Push dann auf ihren Geräten neu aktivieren. Nur einmal
 * pro Installation erzeugen.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:admin@example.com

# Hinweis: Ein neues Schlüsselpaar macht alle bestehenden Push-Abos ungültig.`);
