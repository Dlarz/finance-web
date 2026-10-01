# Finance-App (Web)

Persönlicher Einnahmen- und Ausgaben-Tracker als Web-App fürs iPhone. Läuft komplett offline, ohne Konto und ohne Server – alle Daten bleiben auf dem Gerät.

**Adresse:** https://dlarz.github.io/finance-web/

## Auf dem iPhone installieren

1. Öffne https://dlarz.github.io/finance-web/ in **Safari** (nicht in Chrome oder in einem anderen Browser).
2. Tippe unten auf den **Teilen-Knopf** (Quadrat mit Pfeil nach oben).
3. Wähle **«Zum Home-Bildschirm»** und tippe auf **«Hinzufügen»**.
4. Öffne die App ab jetzt **immer über das Symbol auf dem Home-Bildschirm**. Sie startet im Vollbild und funktioniert auch ohne Internet.

Wichtig: Safari und die Home-Bildschirm-App speichern ihre Daten getrennt. Erfasse deine Buchungen deshalb nur in der Home-Bildschirm-App. Wird die Seite in Safari geöffnet, zeigt die App zuerst eine Anleitung zum Installieren.

Beim ersten Start fragt die App nach dem aktuellen Kontostand und der Währung. Wer von einem anderen Gerät umzieht, wählt dort «Aus Backup wiederherstellen».

## Backup machen und wiederherstellen

Die Daten liegen nur auf dem iPhone. Ein Backup schützt vor Verlust (neues Handy, gelöschte Website-Daten).

**Backup erstellen**

1. Home → Zahnrad → **Einstellungen** → **Backup erstellen**.
2. Das Teilen-Menü öffnet sich. Wähle **«In Dateien sichern»** (z. B. iCloud Drive) oder schicke dir die Datei per Mail/AirDrop.
3. Die Datei heisst `financeapp-backup-JJJJ-MM-TT.zip` und enthält alle Buchungen, Kategorien, Tags, Wiederholungen, Einstellungen und Bilder.

Ist das letzte Backup mehr als 14 Tage her, erinnert die App auf dem Home-Screen mit dem Knopf «Jetzt sichern».

**Backup wiederherstellen**

1. Einstellungen → **Wiederherstellen** (oder beim ersten Start «Aus Backup wiederherstellen»).
2. Wähle die Backup-Datei aus «Dateien».
3. Die App prüft die Datei vollständig, zeigt eine Zusammenfassung («412 Buchungen, 18 Kategorien, 37 Bilder») und ersetzt erst nach der Bestätigung alle aktuellen Daten. Schlägt etwas fehl, bleiben die bisherigen Daten unverändert.

**CSV-Export:** Einstellungen → **CSV exportieren** liefert alle Buchungen als Tabelle (Semikolon-getrennt, UTF-8 mit BOM), die sich direkt in Excel oder Numbers öffnen lässt.

## Updates

Neue Versionen werden beim Öffnen der App erkannt. Es erscheint ein dezenter Hinweis «Update verfügbar» mit dem Knopf «Neu laden». Die Daten bleiben dabei erhalten.

## Funktionen

- Home mit Kontostand (Startsaldo + Einnahmen − Ausgaben), Einnahmen und Ausgaben des Monats, letzte Buchungen
- Buchungen mit Betrag (eigenes Zahlenfeld), Kategorie, Datum, Tags, Notiz, Bildern und Wiederholung (täglich, wöchentlich, monatlich, jährlich, alle N, Enddatum)
- Buchungsliste mit Suche, Filtern, Tagesgruppen, Wischen zum Löschen (mit Rückgängig)
- Statistik pro Tag, Woche, Monat, Jahr oder frei gewähltem Zeitraum: Donut nach Kategorie, Verlauf als Balken
- Wiederkehrende Buchungen werden beim Öffnen der App automatisch nachgetragen, auch für Tage, an denen die App nicht offen war
- Kategorien (eigene Symbole und Farben, Reihenfolge per Ziehen), Tags (umbenennen, zusammenlegen, löschen)
- Deutsch und Englisch, helles und dunkles Design, Wochenstart Montag oder Sonntag, Währung CHF/EUR/USD/GBP

## Entwicklung

```bash
npm install
npm run dev          # Entwicklungsserver
npm test             # Unit-Tests (Vitest)
npm run build        # Typprüfung + Build nach /docs
npm run e2e          # Playwright-Tests in WebKit (iPhone-Grösse), schreibt Screenshots nach /screenshots
npm run icons        # App-Icons aus scripts/icon.svg erzeugen
```

`npm run e2e` erwartet einen fertigen Build in `/docs` (`npm run screenshots` baut zuerst). Die Tests benötigen einmalig `npx playwright install webkit`.

### Veröffentlichung über GitHub Pages

Der fertige Build liegt im Ordner `/docs` und wird mit eingecheckt (inkl. leerer Datei `.nojekyll`). In den Repository-Einstellungen unter *Pages* muss als Quelle **Branch `main`, Ordner `/docs`** gewählt sein. Danach ist die App unter https://dlarz.github.io/finance-web/ erreichbar.

Vor jedem Release: `npm run build`, dann `/docs` committen und pushen.

## Technik

Vite, React, TypeScript, Dexie (IndexedDB), vite-plugin-pwa (Workbox), fflate (Backup-Zip). Keine Anfragen an fremde Server: Schrift (Inter) und Icons (Material Icons) werden mitgebaut. Siehe `PLAN.md` für Architektur und Datenmodell und `SPEC.md` für die vollständige Spezifikation.
