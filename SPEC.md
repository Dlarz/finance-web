# Finance-App als Web-App (PWA) fürs iPhone

Baue in diesem Repository eine Web-App-Version meiner Android-App «Finance-App». Sie ist für meine Freundin, die ein iPhone hat: Sie öffnet die Seite in Safari, fügt sie mit «Zum Home-Bildschirm» hinzu und nutzt sie danach wie eine normale App. Unten folgt die komplette Spezifikation der Android-App (SPEC.md). Übernimm daraus alle Funktionen, Regeln, Screens und das Design. Alles Android-Spezifische ersetzt du durch die Web-Lösungen in dieser Nachricht. Wo sich beides widerspricht, gilt diese Nachricht.

Arbeite selbständig, bis die «Definition of done» erfüllt ist. Kleine Entscheidungen triffst du selbst und listest sie im Schlussbericht auf.

## Arbeitsweise
- Speichere diese Nachricht inklusive der Android-Spezifikation unverändert als SPEC.md. Schreib PLAN.md mit den Meilensteinen als Checkliste. Committe und pushe nach jedem Meilenstein.
- Nach jedem Meilenstein: bauen, Tests laufen lassen, Fehler sofort beheben.
- Prüfe die Oberfläche mit Playwright-Screenshots in WebKit (iPhone-Grösse, hell und dunkel, mit Demo-Daten und mit grosser Schrift). Schau dir die Bilder an und behebe, was falsch aussieht.
- Am Ende: Pull Request in main.

## Technik
- Vite + React + TypeScript, reine statische Seite ohne Server
- Speicher: IndexedDB mit Dexie, Datenbankname «finance-app». Beträge als ganze Zahlen in Rappen, Datum als YYYY-MM-DD-Text
- PWA mit vite-plugin-pwa: Manifest (Name «Finance-App», display standalone, Icons 192/512 + maskable, apple-touch-icon 180 px). Der Service Worker lädt alles vor, damit die App nach dem ersten Öffnen komplett offline läuft
- Wenn eine neue Version online ist: dezenter Hinweis «Update verfügbar» mit Knopf zum Neuladen. Die Daten bleiben dabei erhalten
- Keine Anfragen an fremde Server: keine CDNs, keine Google Fonts, kein Tracking. Schriften und Icons werden mitgebaut
- Charts (Donut und Balken) selbst als SVG, animiert, wie in der Spezifikation
- iPhone-Details: Safe Areas (Notch und Home-Leiste) beachten, 100dvh statt 100vh, Eingabefelder mit mindestens 16 px Schrift (sonst zoomt Safari), Touch-Ziele mindestens 44 px
- Sprache: Deutsch und Englisch, umschaltbar in den Einstellungen, Standard ist die Sprache des iPhones. Alle Texte in Übersetzungsdateien
- Gleiches App-Icon wie die Android-App (Donut-Ring), als PNG in allen nötigen Grössen

## Was sich gegenüber Android ändert
- Kein APK, kein Keystore, kein Signieren, kein WorkManager, keine Android-Berechtigungen, keine Haptik (Safari unterstützt sie nicht)
- Wird die Seite normal in Safari geöffnet statt als Home-Bildschirm-App, zeig zuerst eine einfache Anleitung zum Installieren (Teilen → «Zum Home-Bildschirm»), mit einem kleinen Link «Trotzdem im Browser nutzen». Grund: Safari und die Home-Bildschirm-App speichern ihre Daten getrennt
- Wiederkehrende Buchungen: Die Logik läuft beim Öffnen der App und jedes Mal, wenn sie wieder in den Vordergrund kommt
- Fotos: normales Dateifeld für Bilder (iOS bietet dann selbst Kamera oder Fotomediathek an). Bilder vor dem Speichern auf max. 2000 px verkleinern und als JPEG in IndexedDB speichern
- Backup und CSV: als Datei über das Teilen-Menü (Web Share API mit Dateien), sonst als Download. Restore über eine Dateiauswahl
- Datensicherheit: Beim Start dauerhaften Speicher anfragen (navigator.storage.persist). Wenn das letzte Backup mehr als 14 Tage her ist, zeig auf Home einen freundlichen Hinweis mit dem Knopf «Jetzt sichern»
- «Demo-Daten laden» gibt es nur, solange die App noch keine Buchungen hat, damit nie Testdaten in echte Daten geraten
- Tests: Vitest statt JUnit für dieselben Logik-Tests, Playwright statt Roborazzi

## Veröffentlichung
- Das Repository ist öffentlich und wird über GitHub Pages aus dem Ordner /docs auf main ausgeliefert, Adresse https://dlarz.github.io/finance-web/
- Baue deshalb mit relativen Pfaden (base: './'), damit alles unter diesem Unterpfad funktioniert, auch der Service Worker
- Committe den fertigen Build in /docs, zusammen mit einer leeren Datei .nojekyll
- Keine GitHub-Actions-Workflows, denn Workflow-Dateien kannst du aus der Cloud nicht pushen
- Nie echte Daten, Passwörter oder Schlüssel ins Repo. Screenshots nur mit Demo-Daten

## Definition of done
- Alle Punkte aus SPEC.md sind umgesetzt (ausser den Android-Punkten), Build und alle Tests sind grün
- Screenshots aller Hauptscreens in hell und dunkel sind geprüft
- Die App funktioniert offline, lässt sich zum Home-Bildschirm hinzufügen und startet im Vollbild
- README erklärt, wie man die App auf dem iPhone installiert und ein Backup macht
- Der Pull Request in main ist offen

## Schlussbericht
Was gebaut wurde, alle eigenen Entscheidungen, offene Punkte, und in 3 einfachen Schritten, wie ich GitHub Pages einschalte und meine Freundin die App installiert.

--- SPEC.md der Android-App ---# Finance-App – Android app spec

Build a complete, polished personal income & expense tracker for Android in this repository. I will use it every day on my own phone for my real money, so correct numbers and data safety come first, and a beautiful UI right after. I live in Switzerland (currency CHF). The app is only for me: fully offline, no account, no login.

You are running in a Claude Code cloud session. There is no Android Studio, no phone, and no emulator. I install the app by downloading the APK from this repository's GitHub Releases page on my phone (Oppo Find X9 Pro).

Work on your own until everything in "Definition of done" is true. Decide small details yourself and list those decisions in your final report. Only stop to ask me if you are truly blocked.

## How to work
1. Save this entire spec unchanged as `SPEC.md` in the repository root. Re-read it whenever you are unsure and before your final check.
2. Set up the Android SDK. JDK and Gradle are preinstalled; the Android SDK is not. Install the command-line tools into `$HOME/android-sdk`, accept the licenses, install platform-tools plus the latest stable platform and build-tools, and point `local.properties` (gitignored) to it. Also add `scripts/setup-android-sdk.sh` and a SessionStart hook in `.claude/settings.json` that runs it in cloud sessions (only when `CLAUDE_CODE_REMOTE` is `true` and the SDK is missing), so future sessions are ready automatically. If a download is blocked by the network, stop and tell me exactly which domain to allow.
3. Create the Android project from scratch, including the Gradle wrapper.
4. Write `PLAN.md` with the architecture, packages, data model, and the milestones below as a checklist. Tick items off as you go.
5. Commit and push after every milestone, so nothing is lost if the session stops.
6. After every milestone, run `./gradlew assembleDebug testDebugUnitTest` and fix everything before moving on. Never let errors pile up.
7. Milestones:
   1. Setup: SDK, project, dependencies, signing, theme, navigation skeleton, first-launch screen
   2. Data layer: Room, repositories, default categories, money + date logic with unit tests
   3. Add / Edit transaction
   4. Transactions tab + details
   5. Home, then publish the first APK release so I can try the app
   6. Statistics with charts
   7. Recurring transactions (engine + screen) with unit tests
   8. Settings, category + tag management, CSV export, backup / restore
   9. Polish: animations, empty states, dark mode, edge cases
   10. Final check against SPEC.md, then publish the final APK release and open a pull request into main
8. You can't see the app on a device, so check the UI with screenshot tests. Use Roborazzi (Robolectric) to render every main screen with demo data in light and dark mode, look at the images, and fix whatever looks wrong. Keep these tests in the repo.

## Signing, versions, and delivery
- In milestone 1, create one signing keystore and commit it together with its passwords (e.g. in `keystore.properties`); this repository is private. Sign both debug and release builds with it. Never change or regenerate it: with a different key, updates won't install over the old version and I would lose my data
- versionCode = number of commits (`git rev-list --count HEAD`), versionName = `1.0.<versionCode>`, so every build is newer than the one before
- Keep R8 / minification off for now. Crashes it can cause only show up on a real device, which you can't test from here
- To publish a release: build both APKs and run `gh release create v1.0.<versionCode>` (target: your current branch, mark as latest) with two files attached: `FinanceApp-1.0.<versionCode>.apk` (release build, for daily use) and `FinanceApp-Dev-1.0.<versionCode>.apk` (debug build with the "Load demo data" option). Add short release notes in plain words
- If creating the release fails, commit the two APKs into an `apk/` folder instead and tell me the link
- Don't create GitHub Actions workflows; pushing workflow files from cloud sessions is usually blocked

## Tech stack
- Kotlin, Jetpack Compose, Material 3, single Activity, Navigation Compose
- MVVM: ViewModel + StateFlow, one immutable UI state per screen
- Room with KSP, Flow queries so every screen updates instantly after a change
- DataStore (settings), WorkManager (recurring), Coil (images), kotlinx.serialization (backup)
- Manual dependency injection (an AppContainer in the Application class), no Hilt
- `java.time` everywhere; inject a `Clock` so all date logic is testable
- Version catalog, Compose BOM, latest stable versions that work together; minSdk 26, compile/target SDK = latest stable
- Packages: `data` (database, repositories, backup), `domain` (money, periods, statistics, recurring; plain Kotlin, no Android imports), `ui` (one package per screen, shared components, theme)
- Edge-to-edge with correct window insets: nothing hidden behind the status bar, navigation bar, or keyboard. Support predictive back
- Room `exportSchema = true`; NEVER use destructive migrations. An update must never delete my data
- No INTERNET permission
- Application id `ch.zagros.financeapp`. Debug builds use `applicationIdSuffix ".debug"` and the name "Finance-App Dev", so testing never touches the real app's data

## Core rules
**Money**
- Amounts are `Long` in Rappen (cents), always positive; the type (EXPENSE / INCOME) gives the sign. Never use Float/Double for money
- Swiss format: `CHF 1'234.50` (apostrophe as thousands separator, always 2 decimals). Expenses in red with "−", income in green with "+"
- Max 2 decimals, max 99'999'999.99
- Currency is chosen in Settings (default CHF). It only changes the displayed code, with no conversion

**Balance**
- Total balance = starting balance + all income − all expenses
- First launch asks for my starting balance ("How much money do you have right now?", may be 0 or negative). It can be edited in Settings. It is not a transaction and never shows up in statistics
- Transactions can't have a future date (date pickers end at today). Only a recurring rule may start in the future; its first transaction is created on that day

**Dates**
- A transaction has a `date` (LocalDate, no time) and `createdAt`. Lists sort by date, then createdAt, newest first
- Weeks start on Monday by default; Sunday can be chosen in Settings. All week logic uses this setting
- "Last used date" = the date of the transaction I created most recently (by createdAt), e.g. for entering several receipts from the same past day

## Data model (Room)
- Transaction: id, type, amount, categoryId, date, comment?, createdAt, updatedAt, recurringRuleId?, occurrenceDate?
- Category: id, name, type, iconKey, colorHex, sortOrder
- Tag: id, name (trimmed, unique ignoring case) + Transaction–Tag cross-ref
- Attachment: id, transactionId, fileName, createdAt
- RecurringRule: id, type, amount, categoryId, comment?, tags, frequency (DAILY / WEEKLY / MONTHLY / YEARLY), interval (every N), startDate, endDate?, isPaused
- Foreign keys; indices on date, type, categoryId; UNIQUE index on (recurringRuleId, occurrenceDate)
- Sums per category / day / month for a date range are computed in SQL, not in Kotlin loops

## Default categories (created on first launch)
- Expenses: Groceries, Restaurants & Takeaway, Transport, Car, Housing & Rent, Bills & Utilities, Health, Education, Shopping, Entertainment, Travel, Subscriptions, Other
- Income: Salary, Side job, Gifts, Investments, Other
- Each one gets a fitting Material icon and a clearly distinct color that works in light and dark mode. Health = red, Education = blue. "Other" can't be deleted

## Navigation
Bottom bar: Home · Statistics · Transactions. A big "+" button on all three opens Add transaction. Settings is opened with a gear icon on Home. The selected tab and period on Statistics are kept when I switch tabs.

## Screens

### First launch
One friendly screen: welcome, starting balance (keypad), currency (CHF preselected), a "Start" button, and a "Restore from backup" link for when I move to a new phone.

### Home
- Header: "Overview" with today's date underneath, gear icon for Settings
- Big balance card (red if negative; the number animates when it changes)
- Two cards: this month's income and this month's expenses
- Last 5 transactions (tap opens details) + "See all" (opens Transactions). Each row shows the transaction date under the category name (Today, Yesterday, or e.g. "Mon, Sep 28"), followed by the comment and tags
- Empty state: "No transactions yet. Tap + to add your first one."

### Add / Edit transaction
- Expense | Income toggle at the top. It switches the category grid and clears the category if it doesn't fit
- Big amount with a custom in-app keypad (0–9, ".", backspace, haptic feedback). The keypad is open when the screen opens, collapses when I tap another field, and reopens when I tap the amount
- Category grid: icon in a colored circle + name. The last tile, "+ New", opens a dialog with a name field, an icon picker (~40 icons), and a color picker (~20 colors). The new category is selected right away
- Names on tiles and chips never break inside a word: at most 2 lines, line breaks only between words, and when a word does not fit, the font shrinks automatically. This holds on every screen with tiles or chips and with large system font sizes
- Date chips: Today · Yesterday · 2 days ago · Last used (shows its date, e.g. "Sep 25") · Pick date (calendar). Hide "Last used" when there are no transactions yet or when it equals another chip. Default: Today
- Tags: typing and pressing Enter or comma adds a chip; existing tags are suggested while typing (most used first); × removes a tag
- Comment: optional, multi-line
- Pictures: several per transaction, from camera or gallery; thumbnails with ×; tap for a fullscreen viewer (pinch to zoom, swipe between pictures)
- Repeat: Off (default) · Daily · Weekly · Monthly · Yearly, "every N", and an optional end date. Show a preview such as "Monthly on the 31st (last day in shorter months) · next: Oct 31". With Repeat on, the date may be in the future. Repeat is only offered when creating; existing rules are edited in Recurring
- Save is enabled only when the input is valid (amount > 0, category chosen); errors are shown inline
- The form survives rotation and process death. Going back with unsaved changes asks "Discard changes?"
- After saving: close the screen and show a "Saved" snackbar
- Edit mode: the same screen, prefilled, plus Delete. For a transaction created by a recurring rule, editing only changes this one; show a hint with a link to edit the rule

### Transactions
- Search (comment, tags, category, amount) + a filter button with a badge showing the number of active filters
- Filter sheet: type, categories, tags, date range, has pictures. Active filters appear as removable chips
- Grouped by date with sticky headers: Today, Yesterday, then "Mon, Sep 28" (with the year if it isn't the current year). Each header shows that day's net total
- Row: category icon, category name, comment (one line) and tags, colored amount, small icons for pictures and recurring
- Swipe to delete with an "Undo" snackbar. Undo restores everything, including tags and pictures
- Tapping a row opens details: all fields including pictures, created / edited time, link to the recurring rule, plus Edit and Delete
- Stays smooth with 10,000 transactions
- Empty states for "no transactions" and "no results" (with "Clear filters")

### Statistics (the most important screen, make it beautiful)
- Tabs: Day · Week · Month · Year · Period
- Selector: ‹ label ›, plus a "Today" button when I'm not on the current period. Swiping left / right also changes the period. Tapping the label opens a picker:
  - Day "Wed, Sep 30, 2026" → date picker
  - Week "Sep 28 – Oct 4" → pick any day and its week is used (show years when a week spans two years)
  - Month "September 2026" → month picker
  - Year "2026" → year list
  - Period "Sep 5 – Sep 30, 2026" → date range picker; the arrows shift the range by its own length
- Summary: Income · Expenses · Net for the selected period
- Expenses | Income toggle for the charts below
- Donut chart:
  - One segment per category in its color. Segment size = its share of the total, with small gaps between segments
  - The total is shown in the center. Tapping a segment enlarges it, dims the others, and shows its category, amount, and % in the center. Tapping it again or tapping the center resets the view
  - Draws itself in with an animation and animates smoothly when the period or type changes
  - Categories under 2 % are combined into one grey "Others" segment in the ring only (the list still shows all of them)
  - Empty state: grey ring + "No expenses this week"
- List under the donut: color dot, icon, name, amount, %, and a thin bar in the category color, sorted by amount. Tapping a row opens the transaction list filtered by that category, type, and period
- Bar chart over time for the selected type: Week = 7 days, Month = each day, Year = 12 months, Period = days (≤ 31 days), weeks (≤ 6 months), or months. Hidden for Day. Tapping a bar shows its exact value; today / this month is highlighted; axis labels are compact (1.2k)
- Draw both charts with Compose Canvas (no chart library)

### Recurring (Settings → Recurring)
- List: category icon, name (comment or category), amount, schedule (e.g. "Monthly on the 1st"), next date, "Paused" badge
- "+" button to create a rule directly (the start date may be in the future)
- Edit (changes only affect future occurrences), pause / resume, delete. Deleting asks whether to also delete the transactions the rule created (default: keep them)

### Categories (Settings → Categories)
- Expense and Income tabs; add, edit (name, icon, color), drag to reorder (this order is used in the Add screen)
- Deleting a category used by transactions or rules first asks which category to move them to

### Tags (Settings → Tags)
Rename (renaming to an existing name merges the two tags) and delete.

### Settings
Starting balance · Currency · First day of week · Theme (System / Light / Dark) · Categories · Tags · Recurring · Export CSV · Backup · Restore · Delete all data (double confirmation; resets the app like a fresh install) · App version.
Debug builds only: "Load demo data", about 6 months of realistic Swiss data (monthly rent and salary as recurring rules, groceries, tags, comments) to test the charts.

## Recurring engine
- Runs on app start, once a day via WorkManager (unique periodic work), and right after a rule is created or edited
- Creates all due occurrences up to today in one database transaction, including days when the phone was off or the app wasn't opened
- The transaction I save with Repeat on is the rule's first occurrence
- Every occurrence is calculated from the start date (start + n × interval), never from the previous occurrence. The 31st becomes the last day in shorter months (Jan 31 → Feb 28 → Mar 31); Feb 29 becomes Feb 28 in non-leap years
- Duplicates are impossible: insert using the unique (recurringRuleId, occurrenceDate) index and ignore conflicts, so two runs at the same time are safe
- An occurrence I deleted must never come back
- Respects the end date. Paused rules create nothing; after resuming, they continue with the next future occurrence (no back-filling)
- If a new rule starts in the past, create the missed occurrences up to today and say how many in the "Saved" message
- Generated transactions copy type, amount, category, comment, and tags (not pictures) and link to the rule

## Pictures
- Gallery: Android Photo Picker (no storage permission)
- Camera: `TakePicture` contract with a FileProvider URI. Do NOT declare the CAMERA permission (declaring it without requesting it makes the system camera fail)
- Copy each picture into app-private storage: max 2000 px on the long side, JPEG ~85 %, correct EXIF rotation. Store only the file name in the database
- Clean up temp files when I cancel, files of deleted transactions (after the undo time), and orphaned files on app start

## Export & backup
- CSV columns: date; type; category; amount (negative for expenses, no thousands separator); currency; tags; comment. Semicolon-separated, UTF-8 with BOM, so it opens correctly in Excel with Swiss settings. Save or share it via the system sheet
- Backup: one `.zip` file (all data and settings as versioned JSON + all pictures), saved with the system file picker as `financeapp-backup-YYYY-MM-DD.zip`. Restore accepts any valid backup file regardless of its name
- Restore: pick a `.zip` and validate it completely first. Show a summary ("412 transactions, 18 categories, 37 pictures. This replaces all current data"), ask for confirmation, then replace everything at once. If anything fails, my current data stays untouched
- Android Auto Backup: cloud backup = database + settings (no pictures, because of the 25 MB limit); device-to-device transfer = everything

## Design
- Calm, modern, premium feel like a good banking app: lots of white space, one accent color, big bold numbers, rounded cards, soft shadows, smooth motion. It must not look like a default template
- Custom color scheme with no dynamic color, so amount and category colors always stay consistent. All colors, shapes, and fonts are defined in the theme so I can change them in one place
- Light and dark mode both properly designed, with good contrast
- Tabular digits for amounts so numbers line up
- Animations: the donut draws in, the balance counts up, list items animate in and out, and screen transitions are smooth
- Friendly empty states: an icon, one sentence, one action
- Works on small (360 dp) to large phones and with large system font sizes; touch targets ≥ 48 dp; content descriptions on icons
- All texts in `strings.xml` (English for now) so I can translate the app later
- App name "Finance-App". Adaptive launcher icon: a thick donut ring of 4 segments in category colors (red like Health, blue like Education, plus yellow and green) with small gaps, on a dark background, nothing else; everything inside the safe zone, plus a monochrome layer for themed icons. It must stay clearly recognizable at 48 px

## Tests
Unit tests for the plain Kotlin logic:
- Money parsing and formatting
- Period ranges: day / week / month / year / custom, Monday vs Sunday start, weeks across months and years, leap years
- Recurring engine: month ends, Feb 29, catch-up, no duplicates when run twice, a deleted occurrence stays deleted, pause / resume, end date
- Balance
- Statistics: sums, percentages, "Others"
- Backup round-trip: export → import gives identical data

Also: Roborazzi screenshot tests of every main screen in light and dark mode, and Robolectric tests for the tricky UI cases (empty database, rotation, very long texts, huge amounts, 10 pictures).

## Definition of done
- Every point in SPEC.md is implemented and reachable in the UI (go through it line by line)
- `./gradlew assembleDebug assembleRelease testDebugUnitTest lint` passes without errors
- You have looked at every screenshot and fixed what looked wrong
- No TODOs, placeholder screens, or buttons that do nothing
- No crashes or overflowing text with an empty database, rotation, very long names or comments, huge amounts, or 10 pictures on one transaction
- The newest APKs are published, and a pull request into main is open
- `README.md` explains how to install and update the app on an Android phone

## Final report
- What you built and how the code is organized (short)
- Every decision you made yourself
- Anything unfinished and any known issues (be honest)
- The link to the newest release, with short steps to install the APK on my Oppo phone and to update it later
- A reminder that the keystore in the repository must never be deleted or changed
