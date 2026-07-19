# Implementierungsplan: Charaktereditor, Animationen und Third-Person-Kamera

## Ausgangslage

Das Feature beginnt nicht bei null. Editor, Profilmodell, Third-Person-Umschaltung und Kamerakollision existieren bereits. Die Arbeit besteht hauptsächlich aus sauberer Persistenz, einem animierbaren Rig und einer echten Orbit-Steuerung.

## Vereinbarter Umfang

- Das Charakterprofil wird pro Spielstand gespeichert.
- Der Editor ist beim Erstellen eines Spielstands und im Pausenmenü verfügbar.
- „Übernehmen“ speichert Änderungen; „Abbrechen“ verwirft sie.
- Alte Spielstände werden automatisch migriert.
- Das vorhandene Blockmodell erhält ein prozedurales Gelenk-Rig ohne externe Animationsdateien.
- Animationszustände: Idle, Gehen, Sprinten, Springen, Fallen, Ducken, Schwimmen, Nahkampf und Bogenschießen.
- Zustandsübergänge werden weich überblendet; Bewegungen sind stilisiert und geschwindigkeitsabhängig.
- Cape, Schal und Pferdeschwanz erhalten einfache Sekundärbewegungen.
- Die Third-Person-Kamera kann frei um den Charakter rotieren.
- Die Bewegung bleibt kamerarelativ; der Charakter dreht sich weich in Bewegungsrichtung.
- Der Kameraabstand ist ungefähr zwischen 2 und 6 Blöcken einstellbar und wird pro Spielstand gespeichert.
- Die Kamera besitzt eine vertikale Begrenzung und Kollisionsschutz.
- Kampf und Interaktion verwenden eine Schulterkamera und folgen dem Fadenkreuz.
- Desktop- und Touch-Steuerung werden unterstützt.
- Der Umfang betrifft zunächst nur den lokalen Spieler; die Schnittstelle bleibt für spätere Multiplayer-Avatare wiederverwendbar.
- NPCs und Tiere sind nicht Bestandteil dieses Features.

## 1. Datenmodell und Spielstandmigration

Das Profil und der Kameraabstand werden Bestandteil des Spielstands:

```js
{
  characterProfile: { /* normalisiertes Profil */ },
  thirdPersonCamera: {
    distance: 4.2
  }
}
```

### Änderungen

- Save-Version in `js/saveMigrations.js` erhöhen.
- Migration ergänzt bei alten Spielständen zunächst ein fehlendes Profil.
- Beim Laden übernimmt `js/GameMain.js` einmalig das bisherige lokale Profil, sonst den Standardcharakter.
- Beim nächsten Speichern landet das normalisierte Profil dauerhaft im Spielstand.
- `localStorage` danach nicht mehr als aktive Profilquelle verwenden.

### Verifikation

- Migration alter Spielstände funktioniert.
- Export und Import enthalten Profil und Kameraabstand.
- Zwei Spielstände können unterschiedliche Charaktere besitzen.
- Tests in `tests/saveMigrations.test.js` und `tests/characterProfile.test.js`.

## 2. Editor auf transaktionale Bearbeitung umstellen

Der Editor darf nicht mehr unmittelbar den globalen `localStorage`-Stand verändern.

### Änderungen

- `js/characterEditor.js` erhält beim Öffnen eine Kopie des aktuellen Spielstandprofils.
- Kommunikation zwischen Spiel und Editor über eine kleine Nachrichten-Schnittstelle:
  - `load-profile`
  - `apply-profile`
  - `cancel`
- „Übernehmen“ validiert das Profil und aktualisiert den aktiven Spieler.
- „Abbrechen“ verwirft den Entwurf vollständig.
- Der Editor wird in `index.html` sowohl beim Erstellen eines Spielstands als auch im Pausenmenü angeboten.
- Das vorhandene Editor-Overlay und die Vorschau werden weiterverwendet.

### Verifikation

- Abbrechen verändert weder Modell noch Spielstand.
- Übernehmen aktualisiert das sichtbare Modell sofort.
- Speichern und erneutes Laden stellt exakt dasselbe Profil wieder her.
- Der Editor funktioniert mit Maus, Tastatur und Touch.

## 3. Charaktermodell in ein Gelenk-Rig umbauen

Das statische Modell in `js/characterModel.js` wird hierarchisch aufgebaut.

```text
characterRoot
└─ bodyRoot
   ├─ torso
   │  ├─ headPivot
   │  ├─ leftArmPivot
   │  ├─ rightArmPivot
   │  └─ accessoryAnchors
   ├─ leftLegPivot
   └─ rightLegPivot
```

### Änderungen

- Arme und Beine drehen um Schulter beziehungsweise Hüfte, nicht um ihre Mitte.
- Kopf, Rumpf und Zubehör erhalten stabile benannte Anker.
- Cape, Schal und Pferdeschwanz bekommen eigene Pivots.
- `createCharacterModel()` liefert neben der Root-Gruppe kontrollierte Rig-Referenzen zurück.
- Farben, Körperformen und Editoroptionen bleiben unverändert.
- Outlines bewegen sich zusammen mit dem jeweiligen Körperteil.

### Verifikation

- Jede Editorvariante lässt sich mit neutraler Pose erzeugen.
- Kein Körperteil springt beim Wechsel von Profil oder Pose.
- Ressourcen werden beim Profilwechsel weiterhin vollständig freigegeben.
- Bestehende Profiltests bleiben grün; zusätzliche Rig-Strukturtests kommen hinzu.

## 4. Animationssteuerung implementieren

Eine eigene kleine Animationssteuerung kapselt Zustandswahl, Überblendung und Pose. Sinnvoll ist ein neues Modul `js/characterAnimator.js`.

### Animationszustände

- `idle`
- `walk`
- `sprint`
- `jump`
- `fall`
- `crouch`
- `swim`
- `melee`
- `bow`

### Technik

- Zustände werden aus Geschwindigkeit, Bodenkontakt, Wasserstatus, Ducken und Kampfereignissen ermittelt.
- Laufzyklen richten sich nach der tatsächlichen Geschwindigkeit, um Fußrutschen zu reduzieren.
- Posen werden pro Frame weich interpoliert.
- Angriffsanimationen überlagern die laufende Bewegungsanimation.
- Cape, Schal und Pferdeschwanz reagieren verzögert auf Beschleunigung, Sprung und Drehung.
- Es wird keine Physik- oder Stoffsimulation eingeführt.

### Verifikation

- Pure Tests für die Zustandsauswahl.
- Übergänge erzeugen keine abrupten Rotationssprünge.
- Angriffe kehren zuverlässig in den vorherigen Bewegungszustand zurück.
- Nach Profilwechsel startet das Rig in einer gültigen neutralen Pose.

## 5. Third-Person-Kamera entkoppeln

Die aktuelle Kamera wird direkt aus der Blickrichtung abgeleitet. Für freie Rotation braucht sie eigenen Zustand:

- Orbit-Yaw
- Orbit-Pitch
- Entfernung
- aktuelle Schulterverschiebung
- geglättete Kameraposition

### Änderungen in `js/Player.js`

- Kamera kann horizontal vollständig um den Charakter rotieren.
- Vertikaler Winkel wird sinnvoll begrenzt.
- Mausrad zoomt ungefähr zwischen 2 und 6 Blöcken.
- Vorhandene Blockkollision bleibt erhalten und wird auf beliebige Orbit-Winkel erweitert.
- Nach einem Hindernis fährt die Kamera weich auf den gewählten Abstand zurück.
- Der Charakter dreht sich im Stillstand nicht mit der Kamera.
- Kameraabstand wird im aktiven Spielstand gespeichert.

### Verifikation

- Vollständige 360-Grad-Rotation im Stillstand.
- Keine Kamera innerhalb solider Blöcke.
- Kein starkes Springen beim Passieren enger Räume.
- First Person verhält sich weiterhin wie bisher.
- Mathematische Kamerafunktionen werden unabhängig vom Renderer getestet.

## 6. Bewegung und Charakterausrichtung anpassen

Momentan richtet sich das Modell nach der Kamerarichtung. Künftig wird zwischen Kamera-, Bewegungs- und Zielrichtung unterschieden.

### Änderungen

- `WASD` bleibt kamerarelativ.
- Aus der tatsächlich ausgeführten Bewegung wird die Zielrotation des Charakters berechnet.
- Der Charakter dreht weich zur Bewegungsrichtung.
- Rückwärts- und Seitwärtsbewegung verwenden denselben Laufzyklus zunächst gespiegelt beziehungsweise richtungsabhängig; es entstehen keine zusätzlichen Strafing-Clips.
- Während Kampf und Interaktion darf die Zielrichtung die Bewegungsrichtung übersteuern.

### Verifikation

- Kamera kann hinter, vor und neben dem Charakter stehen.
- `W` bewegt immer von der Kamera aus nach vorn.
- Charakter und Laufanimation zeigen zur tatsächlichen Bewegungsrichtung.
- Kollision und Bewegungsgeschwindigkeit bleiben unverändert.

## 7. Schulterkamera und Interaktionsstrahl verbinden

Rendering und Trefferberechnung müssen dieselbe sichtbare Zielrichtung verwenden.

### Änderungen

- Bei Abbau, Nahkampf und Bogen blendet die Kamera seitlich über die rechte Schulter.
- Fadenkreuzstrahl bestimmt weiterhin das Ziel.
- Abbau, Treffer und Pfeile werden aus einem gemeinsamen Zielstrahl abgeleitet.
- Der Charakter richtet Oberkörper, Kopf und Arme auf dieses Ziel aus.
- Nach der Aktion geht die Kamera weich zur mittigen Orbit-Position zurück.
- Hindernisse zwischen Kamera und Charakter beeinflussen nicht fälschlich den Trefferstrahl.
- Betroffene Dateien: `js/Player.js`, `js/PlayerInteraction.js` und `js/GameMain.js`.

### Verifikation

- Fadenkreuz, abgebauter Block und Trefferziel stimmen überein.
- Pfeile fliegen zur sichtbaren Zielposition.
- Das eigene Charaktermodell blockiert keine Aktion.
- Schulterwechsel und Rückkehr erzeugen keinen Kamerasprung.

## 8. Touch-Steuerung erweitern

### Änderungen in `js/touch.js`

- Ein Finger im Blickbereich steuert Orbit-Yaw und -Pitch.
- Zwei Finger verändern den Kameraabstand.
- Tap und Halten für Interaktionen bleiben erhalten.
- Gestenerkennung trennt Drehen, Zoomen und Abbauen eindeutig.
- Editor und Pausenmenü bleiben in Hoch- und Querformat bedienbar.

### Verifikation

- Pinch-Zoom löst keinen Angriff oder Abbau aus.
- Der virtuelle Joystick funktioniert gleichzeitig mit Kameradrehung.
- Touch-Abbruch setzt alle aktiven Gestenzustände zurück.
- Erweiterung der Tests in `tests/touch.test.js`.

## 9. Gesamtprüfung

### Automatisiert

1. Profilnormalisierung und Migration.
2. Editor-Übernehmen und -Abbrechen.
3. Rig-Aufbau und Zustandsauswahl.
4. Orbit-Winkel, Zoomgrenzen und Kamerakollision.
5. Zielstrahl für Abbau, Nahkampf und Bogen.
6. Touch-Gesten.
7. Gesamte bestehende Testsuite.
8. Produktions-Build.

### Manuelle Testmatrix

- Neuer und migrierter Spielstand.
- First Person und Third Person.
- Alle Körperformen, Haare und Zubehörteile.
- Alle neun Animationszustände.
- Enge Höhlen, niedrige Decken, Wasser und Geländewechsel.
- Maus/Tastatur sowie Touch.
- Profilwechsel während eines laufenden Spielstands.
- Speichern, Neuladen, Exportieren und Importieren.

## Empfohlene Reihenfolge

```text
Save-Format → Editor-Integration
Rig → Animationssteuerung
Orbit-Kamera → Bewegungsausrichtung → Schulterzielsystem
Touch-Anpassung → Gesamtprüfung
```

Rig und Save-/Editor-Arbeiten sind weitgehend unabhängig. Animationen benötigen das neue Rig; Bewegung, Zielsystem und Touch benötigen zuerst den neuen Kamerazustand.

## Fertigstellungskriterien

Das Feature ist fertig, wenn:

- jeder Spielstand sein eigenes Charakterprofil besitzt,
- Editoränderungen kontrolliert übernommen oder verworfen werden,
- alle vereinbarten Zustände sichtbar und weich animiert sind,
- die Kamera frei um den stehenden Charakter rotieren und zoomen kann,
- Bewegung, Fadenkreuz und Aktionen auch aus Third Person konsistent sind,
- Kamera und Charakter nicht durch Gelände clippen,
- Desktop und Touch funktionieren,
- alte Spielstände weiterhin geladen werden können,
- Tests und Build ohne Fehler durchlaufen.
