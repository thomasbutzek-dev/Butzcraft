# Butzcraft Seitenredaktion

Die Landingpage kann unter `/admin` direkt bearbeitet werden. Der Zugang ist serverseitig geschützt und bleibt deaktiviert, solange kein Passwort konfiguriert ist.

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
