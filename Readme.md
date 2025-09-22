## Kolpingtheater Ramsen – Drehbuch

Ein interaktives Drehbuch-System für Proben und Aufführungen. Optimiert für Schauspieler, Regie und Technik. Als installierbare PWA nutzbar – auch offline.

## Features

### Drehbuch-Viewer

- **Rolle wählen**: Eigene Zeilen werden klar hervorgehoben.
- **Überblick je Szene**: Wer spielt mit? Auf Wunsch mit Mikrofonnummern.
- **Inhalte nach Bedarf**: Anweisungen, Technik, Licht, Einspieler, Requisiten und Texte ein‑/ausblenden. Anzahl der Kontextzeilen frei wählbar.
- **Echte Namen anzeigen**: Neben den Rollennamen können die Schauspielernamen eingeblendet werden.
- **Angenehme Darstellung**: Dunkler Modus und Pink Mode für bessere Lesbarkeit.
- **Als PDF drucken**: Direkt aus der App.
- **Hinweis bei neuen Inhalten**: „Neu laden“, wenn eine Aktualisierung bereitsteht.

### Einstellungen

- **Produktion & Rolle**: Stück auswählen, Rolle wählen und Anzeige personalisieren.
- **Texte & Hinweise**: Schauspielertexte, Mikrofonnummern, Requisiten ein‑/ausblenden.
- **Kontext anpassen**: Anweisungen, Technik, Licht und Einspieler mit einstellbaren Kontextzeilen.
- **Darstellung**: Dark Mode, Pink Mode und automatisches Scrollen.
- **Probenhilfe**: Link zu Rollenvorschlägen für die Probe.

### Director Mode (Leitung)

- **Leitung übernehmen**: Mit Name und Passwort.
- **Gemeinsamer Fokus**: Zeilen für alle markieren; auf Wunsch scrollt es automatisch mit.
- **Klar erkennbar**: Deutliche Anzeigen, wenn die Leitung aktiv ist.
- **Reibungslose Übergabe**: Leitung kann problemlos übergeben oder beendet werden.

### Navigation & Bedienung

- **Inhaltsverzeichnis & Seitenleiste**: Schnell zur gewünschten Szene; mobil ein‑/ausklappbar.
- **Schnell-Navigation**: Bei gewählter Rolle komfortabel durch die eigenen Zeilen springen.
- **Tastaturbedienung**: Pfeiltasten zur Steuerung.
- **Sprung zum Marker**: Mit einem Tippen direkt zur markierten Stelle.

### Backstage-Displays

- **Bühnenansicht**: Aktuelle und nächste Szene mit Besetzung; Hinweise sind groß und deutlich – stets synchron mit der Leitung.
- **Schauspieleransicht**: Alternative Darstellung mit Fokus auf Rollen und Fortschritt.

### App & Offline

- **Installierbar**: Als App auf Handy, Tablet und Desktop nutzen.
- **Offline nutzbar**: Inhalte sind auch ohne Internet verfügbar und werden automatisch aktualisiert.
- **iPhone/iPad**: Startbildschirm‑Icon und Vollbild.

### Mehrere Produktionen

- **Mehrere Stücke**: Produktionen verwalten und schnell umschalten.
- **Bleibt gespeichert**: Die Auswahl wird gemerkt.
- **Getrennte Leitung**: Markierungen und Leitung sind je Produktion unabhängig.
- **Praktische Links**: Verweise auf Bühnen‑ und Schauspieleransicht öffnen die richtige Produktion.

### Inhalte & Speicher

- **Direkt aus der Quelle**: Inhalte kommen aus einer gepflegten Google‑Tabelle.
- **Schnell geladen**: Kurzzeit‑Zwischenspeicher für zügige Ladezeiten – auch bei wackeligem Netz.
- **Szenen‑Zusammenfassung**: Zu Beginn jeder Szene steht eine kurze Beschreibung.
- **Persönliche Einstellungen**: Filter, Modus und Rollenauswahl bleiben erhalten.

### Schnell & Stabil

- **Zügig und flüssig**: Kurze Ladezeiten und sanftes Scrollen.
- **Immer aktuell**: Hinweis bei neuen Versionen; mit einem Klick neu laden.
- **Alles im Blick**: Verbindungsstatus ist sichtbar.
- **Überall nutzbar**: Optimiert für Handy, Tablet, Laptop und Bühnenbildschirme.

### Druck & Werkzeuge

- **PDF‑Druck**: Das Skript mit einem Klick als PDF ausgeben.
- **Konverter**: Rohtext schnell in ein strukturiertes Skript verwandeln.
- **Rollenvorschläge**: Praktische Hilfe zur Besetzung bei Proben.

### Datenschutz

- **Einfache Besucherstatistik**: Ohne Cookies.

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
