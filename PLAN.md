# PLAN – Finance-App als Web-App (PWA)

## Architektur

- **Vite + React 19 + TypeScript**, reine statische Seite, Build nach `/docs` (GitHub Pages), `base: './'`.
- **Speicher:** IndexedDB über Dexie, Datenbank `finance-app`. Beträge als ganze Zahlen in Rappen, Datum als `YYYY-MM-DD`.
- **PWA:** vite-plugin-pwa (Workbox `generateSW`, `registerType: 'prompt'`). Alle Assets werden vorgeladen; «Update verfügbar»-Banner mit Neuladen.
- **Navigation:** eigener Hash-Router (`src/app/router.ts`), damit die App unter dem Unterpfad und als Home-Bildschirm-App funktioniert. Zurück-Geste wird bei ungespeicherten Änderungen abgefangen («Änderungen verwerfen?»).
- **Live-Daten:** `dexie-react-hooks` (`useLiveQuery`) – jede Ansicht aktualisiert sich sofort nach einer Änderung (Ersatz für Room-Flows).
- **Sprache:** Deutsch/Englisch, Standard = Sprache des Geräts; alle Texte in `src/i18n/de.ts` und `src/i18n/en.ts`.
- **Design:** alle Farben, Radien, Schatten und Schriften in `src/theme/theme.css` (CSS-Variablen, hell/dunkel). Inter (variable) und Material-Icons werden mitgebaut – keine Anfragen an fremde Server.

## Pakete (Ordner)

| Ordner | Inhalt |
| --- | --- |
| `src/domain` | reine Logik ohne Browser-APIs: Geld (`money.ts`), Datum (`dates.ts`), Zeiträume (`periods.ts`), Wiederholungen (`recurring.ts`), Statistik, Saldo, CSV – alles mit Vitest-Tests |
| `src/data` | Dexie-Schema (`db.ts`), Repositories (Buchungen, Kategorien, Tags, Regeln), Wiederholungs-Engine, Backup/Restore (zip), Demo-Daten, Bildverarbeitung |
| `src/app` | App-Zustand (Einstellungen, Theme, Sprache), Router, Toasts, Dialoge, PWA-Registrierung, Statistik-/Listen-Zustand |
| `src/ui/components` | wiederverwendbare Bausteine: Keypad, Donut, Balkendiagramm, FitText, Chips, Sheets, Bildergalerie mit Viewer, Swipe-to-delete … |
| `src/ui/screens` | ein Modul pro Screen |
| `src/i18n` | Übersetzungen + Datumsformatierung |
| `e2e` | Playwright-Tests (WebKit, iPhone-Grösse) inkl. Screenshots und Offline-Test |
| `scripts` | Icon-Generierung, Icon-Extraktion, statischer Server für `/docs` |

## Datenmodell (Dexie, Version 1)

| Tabelle | Felder / Indizes |
| --- | --- |
| `transactions` | id, type, amount, categoryId, date, comment, createdAt, updatedAt, recurringRuleId?, occurrenceDate? – Indizes: date, type, categoryId, createdAt, recurringRuleId, **unique** `[recurringRuleId+occurrenceDate]` |
| `categories` | id, name, type, iconKey, colorHex, sortOrder, isDefaultOther |
| `tags` | id, name, **unique** nameLower |
| `transactionTags` | `[transactionId+tagId]` |
| `attachments` | id, transactionId, blob (JPEG ≤ 2000 px), thumb, width, height, createdAt |
| `recurringRules` | id, type, amount, categoryId, comment, tagIds, frequency, interval, startDate, endDate, isPaused, generateFrom |
| `tombstones` | `[ruleId+occurrenceDate]` – gelöschte Vorkommen kommen nie zurück |
| `settings` | key/value: onboarded, startingBalance, currency, weekStart, theme, language, lastBackupAt, firstUseAt |
| `drafts` | ungespeicherte Formulare (überleben das Beenden der App) |

Schema-Änderungen nur über neue Dexie-Versionen mit Upgrade-Funktion – nie destruktiv.

## Meilensteine

- [x] 1. Setup: Projekt, Abhängigkeiten, PWA-Konfiguration, Theme, Navigation, Erststart-Screen, Installations-Hinweis
- [x] 2. Datenschicht: Dexie, Repositories, Standardkategorien, Geld- und Datumslogik mit Unit-Tests
- [x] 3. Buchung hinzufügen / bearbeiten (Keypad, Kategorien, Datum-Chips, Tags, Notiz, Bilder, Wiederholen, Entwurf, Verwerfen-Dialog)
- [x] 4. Buchungen-Tab (Suche, Filter, Gruppen, Swipe-Löschen mit Rückgängig) + Detailansicht
- [x] 5. Home (Kontostand animiert, Monatswerte, letzte Buchungen, Backup-Hinweis)
- [x] 6. Statistik mit Donut und Balkendiagramm (SVG, animiert), Zeitraum-Auswahl, Wischen
- [x] 7. Wiederholungen (Engine + Screen) mit Unit-Tests
- [x] 8. Einstellungen, Kategorien- und Tag-Verwaltung, CSV-Export, Backup / Restore, Demo-Daten, Alles löschen
- [x] 9. Feinschliff: Animationen, leere Zustände, Dark Mode, Safe Areas, grosse Schrift, Randfälle; Playwright-Screenshots geprüft
- [x] 10. Schlussprüfung gegen SPEC.md, Build nach `/docs`, README, Pull Request in `main`
