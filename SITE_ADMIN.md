# Butzcraft Seitenredaktion

Die Landingpage kann unter `/admin` direkt bearbeitet werden. Der Zugang ist serverseitig geschützt und bleibt deaktiviert, solange kein Passwort konfiguriert ist.

Nach der Anmeldung öffnet die Schaltfläche **Statistik** die aggregierten Spielaufrufe der letzten 24 Stunden und 30 Tage. Gezählt werden nur Produktionsaufrufe von `play.butzcraft.de`; IP-Adressen, Header und einzelne Zugriffszeitpunkte werden nicht gespeichert. Die Daten liegen im Verzeichnis aus `STATISTICS_DIR` (produktiv: `/app/statistics`).

## Lokal starten

```powershell
$env:SITE_ADMIN_USER = "admin"
$env:SITE_ADMIN_PASSWORD = "ein-langes-eigenes-passwort"
npm.cmd start
```

Danach `http://127.0.0.1:3000/admin` öffnen. Texte lassen sich direkt anklicken. Ein Klick auf ein markiertes Bild öffnet die Dateiauswahl. Erst **Änderungen speichern** veröffentlicht die aktuelle Text- und Bildauswahl.

## Hosting

In Hostinger müssen `SITE_ADMIN_USER` und `SITE_ADMIN_PASSWORD` als Umgebungsvariablen gesetzt werden. Inhalte und hochgeladene Bilder liegen im persistenten Volume `butzcraft_site_content`.

Das Passwort gehört nicht in Git, `compose.hostinger.yaml` oder eine öffentlich ausgelieferte JavaScript-Datei.

## Kontaktformular

Nachrichten werden serverseitig per SMTP an `CONTACT_TO_EMAIL` versendet. Empfohlen ist ein eigenes Postfach wie `kontakt@butzcraft.de`.

Erforderliche Umgebungsvariablen:

```text
CONTACT_TO_EMAIL=kontakt@butzcraft.de
CONTACT_FROM_EMAIL=kontakt@butzcraft.de
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=kontakt@butzcraft.de
SMTP_PASSWORD=<Passwort oder App-Passwort>
```

Diese Werte entsprechen Hostinger Email mit SSL. In `compose.hostinger.yaml` sind alle nicht geheimen Werte bereits voreingestellt. Auf dem Server muss nur `SMTP_PASSWORD` als geheime Umgebungsvariable gesetzt werden. Zugangsdaten niemals in das Repository eintragen.

## Versionierung

Butzcraft verwendet Versionen im Format `0.MINOR.PATCH`:

- `PATCH` für kleine Fehlerkorrekturen, Texte und geringfügige Anpassungen, zum Beispiel `0.2.1`.
- `MINOR` für neue Spielinhalte oder größere Funktionen, zum Beispiel `0.3.0`.
- `1.0.0` wird erst für die bewusst freigegebene stabile Vollversion verwendet.

Die aktuelle Version steht in `package.json` und `js/version.js`. Beide Werte müssen bei einer neuen Version gemeinsam geändert werden. Ab `v0.2.0` veröffentlicht ein Git-Tag zusätzlich die Container-Tags der jeweiligen Version und `stable`. Normale Pushes auf `stabilization/game-optimization` aktualisieren weiterhin nur den Container-Tag `stabilization`.
