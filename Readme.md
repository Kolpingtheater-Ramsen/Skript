# Kolpingtheater Ramsen - Dynamisches Drehbuch

Ein interaktives Drehbuch-System für das Kolpingtheater Ramsen, optimiert für Proben und Aufführungen.

## Features

### Hauptansicht (index.html)
- 📱 Progressive Web App (PWA) - installierbar auf allen Geräten
- 🎭 Rollenspezifische Texthervorhebung
- 🎬 Director Mode für Probenleitung
- 🔍 Filteroptionen für verschiedene Inhaltstypen
- 🌙 Dark Mode und Pink Mode
- 📊 Szenenübersicht mit Besetzungsliste
- 🎤 Mikrofonzuweisungen
- 📝 Kontextzeilen für technische Anweisungen

### Bühnenansicht (viewer.html)
- 🎪 Optimiert für große Displays hinter der Bühne
- 👥 Aktuelle und nächste Szene mit Besetzungsliste
- ⚡ Echtzeit-Synchronisation mit Director Mode
- 🕒 Integrierte Uhr für Timing
- 📺 Automatische Textgrößenanpassung bei vielen Darstellern

### Konvertierung (convert.html)
- 📄 Text-zu-CSV Konverter für Skripte
- 📊 Automatische Szenenerkennung
- 🎭 Erkennung von Rollen und Mikrofonzuweisungen
- 💾 Export als CSV-Datei

## Installation

1. Klonen Sie das Repository:
```bash
git clone https://github.com/IhrUsername/DynamischesDrehbuch.git
```

2. Installieren Sie die Abhängigkeiten:
```bash
pip install -r requirements.txt
```

3. Starten Sie den Server:
```bash
python app.py
```

4. Öffnen Sie die Anwendung im Browser:
```
http://localhost:5000
```

## Nutzung

### Für Schauspieler
1. Öffnen Sie `index.html` im Browser
2. Wählen Sie Ihre Rolle aus dem Dropdown-Menü
3. Ihre Texte werden automatisch hervorgehoben
4. Optional: Aktivieren Sie "Meine Texte verstecken" zum Üben

### Für den Regisseur
1. Öffnen Sie `index.html` und aktivieren Sie den Director Mode
2. Geben Sie Name und Passwort ein
3. Markieren Sie die aktuelle Textzeile durch Klicken
4. Alle verbundenen Geräte synchronisieren sich automatisch

### Für die Bühnentechnik
1. Öffnen Sie `viewer.html` auf dem Backstage-Display
2. Die Ansicht synchronisiert sich automatisch mit dem Director Mode
3. Zeigt aktuelle und nächste Szene mit allen benötigten Darstellern
4. Technische Anweisungen werden farblich hervorgehoben

### Für neue Skripte
1. Öffnen Sie `convert.html`
2. Fügen Sie das Skript im Textformat ein
3. Klicken Sie auf "Skript analysieren"
4. Überprüfen Sie die Konvertierung
5. Laden Sie die CSV-Datei herunter

## Technische Details

### Systemanforderungen
- Moderner Webbrowser (Chrome, Firefox, Safari, Edge)
- Python 3.7+ für den Server
- Internetverbindung für Echtzeit-Synchronisation

### Verwendete Technologien
- Frontend: HTML5, CSS3, JavaScript
- Backend: Python, Flask, Socket.IO
- Datenformat: CSV
- PWA-Support mit Service Worker
- WebSocket für Echtzeit-Kommunikation

### Dateistruktur
```
DynamischesDrehbuch/
├── app.py              # Server
├── index.html         # Hauptansicht
├── viewer.html        # Bühnenansicht
├── convert.html       # Konverter
├── script.js          # Hauptlogik
├── styles.css         # Styling
├── manifest.json      # PWA Manifest
└── sw.js             # Service Worker
```

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert. Siehe [LICENSE](LICENSE) für Details.

## Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im GitHub Repository oder kontaktieren Sie uns direkt.