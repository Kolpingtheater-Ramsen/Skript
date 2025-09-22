## Kolpingtheater Ramsen – Drehbuch

Ein interaktives Drehbuch-System für Proben und Aufführungen. Optimiert für Schauspieler, Regie und Technik. Als installierbare PWA nutzbar – auch offline.

## Features

### Viewer (index.html)

- **Rollenauswahl**: Dropdown zur Auswahl der eigenen Rolle; relevante Zeilen werden hervorgehoben.
- **Szenenübersicht**: Kompakte Übersicht pro Szene inkl. Mikrofon-Zuweisungen und Besetzung.
- **Inhaltsfilter**: Ein-/Ausblenden von Anweisungen, Technik, Licht, Einspielern, Requisiten, Schauspielertexten – jeweils mit konfigurierbaren Kontextzeilen pro Kategorie.
- **Akteurnamen zu Rollennamen**: Optionaler Zusatz der realen Namen in Anweisungen und Zeilen.
- **Mikrofonanzeige**: Mikro-Nummern werden neben Namen dargestellt (optional).
- **Dark Mode / Pink Mode**: Vollständig thematisierte Oberfläche (inkl. Modal, Inputs, Regie-Bereich).
- **PDF-Export**: Schneller Druck als PDF über den Button in den Einstellungen.
- **Status-Toast bei Updates**: Wenn der Service Worker neue Inhalte erkennt, erscheint ein Toast mit „Neu laden“.

### Einstellungen

- **Allgemein**: Szenenübersicht, Akteurnamen, Automatisch scrollen (Director Mode), PDF-Export, Link zu Rollenvorschlägen.
- **Schauspieler**: Schauspielertexte, Mikrofon anzeigen, „Meine Texte verstecken“ (zum Üben/Prompten).
- **Regie**: Bühnenanweisungen + Kontext-Zeilen-Regler.
- **Technik**: Technische Infos + Kontext-Zeilen-Regler.
- **Licht**: Licht-Hinweise + Kontext-Zeilen-Regler.
- **Audio**: Einspieler + Kontext-Zeilen-Regler.
- **Requisiten**: Requisiten + Kontext-Zeilen-Regler.
- **Ansicht**: Dark Mode, Pink Mode.

### Director Mode (synchronisiert per Socket.IO)

- **Übernahme mit Name/Passwort**: Regieführung übernimmt die Session.
- **Marker setzen**: Klick auf eine Zeile markiert diese für alle; optionales Autoscrolling.
- **Visuelle Indikatoren**: Roter Rahmen bei aktivem Director, deutliche Hervorhebungen.
- **Takeover-Handling**: Sauberes Übergeben/Verlassen des Director-Status.

### Navigation & UX

- **ToC & Sidebar**: Inhaltsverzeichnis im Hauptbereich und in der Sidebar; mobil ein-/ausklappbar.
- **Bottom-Navigation**: Bei ausgewählter Rolle schnelle Navigation durch die eigenen Zeilen.
- **Keyboard Shortcuts**: Pfeiltasten zur Navigation; Fokus auf aktuelle Zeile wird beibehalten.
- **FAB**: Schnell zum markierten Text springen, wenn er außerhalb des Sichtbereichs liegt.

### Backstage-Ansichten

- **viewer.html**: Backstage-Display mit aktueller und nächster Szene, Besetzung und deutlich markierten Hinweisen – synchron mit Director Mode.
- **viewer2.html**: Alternative Backstage-Ansicht (Layout/Informationsdichte variieren je nach Bedarf).

### Konvertierung & Tools

- **convert.html**: Text-zu-CSV-Konverter mit automatischer Szenenerkennung, Rollen- und Mikrofon-Zuordnung; Export als CSV.
- **suggestor.html**: Helfer für Rollenvorschläge bei Proben.

### PWA & Offline

- **Installierbar**: Über Browser-Prompt oder „App installieren“-Button (mobil und Desktop).
- **Service Worker**: Caching für schnelle Ladezeiten; Update-Erkennung mit Reload-Toast.
- **iOS-Unterstützung**: Apple-Touch-Icon, Statusbar-Styles etc.

### Multi-Stücke & Räume

- **Mehrere Produktionen**: Verwaltung über `plays.json` (Name + CSV-Quelle je Stück); Auswahl im Einstellungsdialog.
- **Play-Parameter**: Stück per URL (`?play=...`) wählbar; Auswahl wird in `localStorage` persistiert.
- **Getrennte Räume**: Pro Stück eigener Socket.IO-Raum; Director-Status und Marker sind je Stück unabhängig.
- **Per-Stück-Cache**: CSV-Cache-Keys sind stückbezogen (schneller Wechsel zwischen Produktionen).
- **Deep-Links**: Links zu `viewer.html`/`viewer2.html` übernehmen automatisch den gewählten `play`-Parameter.

### Daten & Caching

- **Google-Sheets-CSV**: Inhalte werden live per CSV geladen und mit PapaParse geparst.
- **Lokaler Cache**: Per `localStorage` mit 5‑Minuten‑TTL; Fallback auf Cache bei Netzwerkfehlern.
- **Normalisierung**: Trimmen/Fallkonvertierung (z. B. `Charakter` in Großschrift), Entfernung von Szene 0.
- **Szenen-Intro**: Zeilen mit Kategorie „Szenenbeginn“ werden als Szenen‑Zusammenfassung angezeigt.
- **Einstellungsspeicher**: Alle Schalter/Regler, Theme und Rollenauswahl werden dauerhaft gespeichert.

### Backend & Betrieb

- **Flask‑App**: Liefert statische Dateien aus (`/` und `/<path>`).
- **Echtzeit via Socket.IO**: Ereignisse `join_play`, `set_director`, `unset_director`, `set_marker` (Marker-Broadcast an alle Clients des Stücks).
- **Director‑Verwaltung**: Pro Stück genau ein aktiver Director; sauberes Takeover inkl. Benachrichtigungen.
- **Konfiguration**: `DIRECTOR_PASSWORD`, `SECRET_KEY`, `PORT` per Umgebungsvariablen.
- **Automatisches Update**: Täglicher `git pull` via Scheduler (steuerbar mit `ENABLE_DAILY_GIT_PULL`, `GIT_PULL_DAILY_HOUR`, `GIT_PULL_DAILY_MINUTE`).
- **Logging**: Server‑ und EngineIO‑Logging aktiv für Diagnosezwecke.

### Performance & Stabilität

- **Cache‑First**: Service Worker bedient Assets aus dem Cache und aktualisiert im Hintergrund.
- **Update‑Hinweis**: Bei neuen Assets erscheint ein Toast mit „Neu laden“.
- **Robuste Verbindungen**: Unbegrenzte Reconnect‑Versuche mit kurzem Delay; sichtbarer Verbindungsstatus in den Viewern.
- **Autoscroll‑Hilfen**: Sanftes Scrollen zu markierten/aktuellen Zeilen; Auto‑Scroll in Backstage‑Listen bei Überlänge.
- **Responsives UI**: Mobile Sidebar/Overlay, Sticky‑Header, große Schriften für Bühnen‑Displays.

### Druck & Export

- **PDF‑Druck**: Optimiertes Drucklayout per Browser‑Drucken (Button in den Einstellungen).
- **Konverter**: `convert.html` wandelt Text in CSV mit Szenenerkennung, Rollen‑ und Mikro‑Zuordnung.

### Analytics

- **Cloudflare Web Analytics**: Leichtgewichtiges Tracking zur Nutzungsanalyse (ohne Cookies).

## Setup & Entwicklung

Voraussetzungen: Aktueller Browser; Python 3.10+ empfohlen.

### Projekt klonen

```bash
git clone https://github.com/Kolpingtheater-Ramsen/Skript.git
cd Skript
```

### Start mit uv (empfohlen auf Windows)

```bash
uv venv
uv pip install -r requirements.txt
uv run app.py
```

Alternative ohne uv:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

Standardmäßig läuft die App unter `http://localhost:5000`.

## Datenquelle

- Die Inhalte werden aus einer Google-Sheet-CSV geladen (siehe `script.js`).
- Kurzes Caching per `localStorage` verbessert die Performance; bei Netzwerkfehlern wird – wenn vorhanden – der Cache genutzt.

## Tastaturkürzel

- **Pfeil rechts/Runter**: Nächste Zeile/Markierung
- **Pfeil links/Hoch**: Vorherige Zeile/Markierung

## Technologien

- Frontend: HTML5, CSS3, JavaScript (PapaParse)
- Backend: Python (Flask), Socket.IO
- PWA: Manifest, Service Worker (Update-Toast bei neuen Inhalten)

## Dateistruktur (Auszug)

```
Skript/
├── app.py
├── index.html
├── viewer.html
├── viewer2.html
├── convert.html
├── suggestor.html
├── script.js
├── styles/
│   ├── base.css
│   ├── components.css
│   ├── script.css
│   └── themes.css
├── styles.css
├── manifest.json
├── sw.js
├── papaparse.min.js
└── uv.lock
```

## Lizenz

MIT-Lizenz. Siehe `LICENSE`.

## Support

Probleme oder Fragen? Bitte ein Issue im Repository erstellen.
