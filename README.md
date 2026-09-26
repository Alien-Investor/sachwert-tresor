# Sachwert-Tresor

Lokaler, verschlüsselter Tresor für deine **Bitcoin-, Gold- und Silberbestände**.
Läuft komplett **offline** auf deinem Gerät — keine Cloud, kein Server, keine Telemetrie.
Im Klartext verlässt nichts dein Gerät.

## 📲 App installieren (Android / GrapheneOS)

Die App ist bewusst **nicht im Google Play Store** — sie wird über signierte Releases
hier auf Codeberg verteilt. Empfohlen über **[Obtainium](https://github.com/ImranR98/Obtainium)**
(automatische Updates, ohne Google):

1. In Obtainium **„App hinzufügen"** → diese Repo-URL eintragen:
   ```
   https://codeberg.org/Alien-Investor/sachwert-tresor
   ```
2. Quell-Typ wird als **Forgejo/Gitea** erkannt → **Hinzufügen** → **Installieren**.
3. Künftige Updates meldet Obtainium automatisch (sobald ein neues Release erscheint).

**Ohne Obtainium** — APK direkt laden:
[**Neuestes Release**](https://codeberg.org/Alien-Investor/sachwert-tresor/releases/latest)
→ die `.apk` herunterladen und installieren.

**Signatur-Fingerprint** (zum Prüfen der Echtheit, über alle Versionen gleich).
Derselbe Wert, zwei Schreibweisen — beides ist der SHA-256 des Signatur-Zertifikats:
```
AppVerifier (mit Doppelpunkten, so zeigt die App es dir an):
66:0F:21:0C:7A:28:9F:38:8B:B4:81:2C:23:82:5A:77:F1:FC:84:E6:A7:EE:58:D6:42:81:B6:BF:5C:D8:79:88

Plain SHA-256 (apksigner / ohne Trennzeichen):
660f210c7a289f388bb4812c23825a77f1fc84e6a7ee58d64281b6bf5cd87988
```
Mit [AppVerifier](https://github.com/soupslurpr/AppVerifier) die installierte App öffnen
und mit dem Doppelpunkt-Wert oben vergleichen.
> Android/GrapheneOS prüft die Signatur ohnehin automatisch und lehnt fremd signierte
> Updates ab.

## 🖥️ Installieren (Linux-Desktop, Flatpak)

Seit v3.3 gibt es denselben Code auch für den Linux-Desktop, verpackt mit Electron als **Flatpak** (x86_64). Das Tresor-Format
ist identisch: Backups vom Handy lassen sich am Desktop importieren und umgekehrt (z.B. über Syncthing). Verteilung als Datei mit
GPG-signierter Prüfsumme im [Codeberg-Release](https://codeberg.org/Alien-Investor/sachwert-tresor/releases) — nicht auf Flathub,
kein automatisches Update.

**Voraussetzung:** Flatpak mit dem Flathub-Remote (für die Laufzeit `org.freedesktop.Platform` 25.08, die flatpak beim Installieren nachlädt):
```
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

**1. Drei Dateien aus dem Release laden:** `sachwert-tresor-X.Y-linux-x86_64.flatpak`, `SHA256SUMS`, `SHA256SUMS.asc`.

**2. Signatur prüfen.** Die Prüfsummen sind mit dem GPG-Release-Schlüssel von Alien Investor signiert
([`alien-investor-release-key.asc`](alien-investor-release-key.asc) hier im Repo, derselbe Schlüssel wie bei Alien Pass). Den Fingerabdruck
zusätzlich über einen zweiten Weg vergleichen (Website [alien-investor.org](https://alien-investor.org/sachwert-tresor.html)):
```
Fingerabdruck:  100F 9E25 BFAE A807 DBC3  57D7 50C0 D785 83BF CB81
```
```
gpg --import alien-investor-release-key.asc
gpg --verify SHA256SUMS.asc SHA256SUMS      # „Korrekte Signatur von "Alien Investor (Release-Signatur) …"“
sha256sum -c SHA256SUMS                     # „…flatpak: OK“
```

**3. Installieren und starten:**
```
flatpak install --user sachwert-tresor-X.Y-linux-x86_64.flatpak
flatpak run org.alieninvestor.tresor
```
Danach steht der Sachwert-Tresor im Anwendungsmenü.

**Update:** Eine neue Bündel-Datei lässt sich (Flatpak 1.14) nicht über die installierte legen. Neue Version laden und prüfen (Schritt 1–2), dann
```
flatpak uninstall --user org.alieninvestor.tresor     # löscht KEINE Daten (ohne --delete-data)
flatpak install --user sachwert-tresor-X.Y-linux-x86_64.flatpak
```
Der Tresor liegt in `~/.var/app/org.alieninvestor.tresor/data/sachwert-tresor/vault.aisv` und bleibt dabei erhalten. Vorher trotzdem ein Backup anlegen.

**Selbst prüfen, dass die App kein Netz hat:**
```
flatpak info --user --show-permissions org.alieninvestor.tresor
```
Erwartet genau:
```
[Context]
shared=ipc;
sockets=wayland;fallback-x11;
devices=dri;
```
Kein `network`, kein `filesystem`. Was die Desktop-Fassung kann und wo ihre Grenzen liegen, steht unter [Sicherheit](#sicherheit).

## Erster Start

Beim ersten Öffnen vergibst du deine **Passphrase** — danach entsperrt nur sie den Tresor.
Optional aktivierst du einen **2FA-Code** (Aegis/TOTP) als zweite Hürde. In der Android-App lässt sich
zusätzlich das **Entsperren per Fingerabdruck** einschalten (siehe [Sicherheit](#sicherheit)).

> ⚠️ **Es gibt keinen Reset und kein Backdoor.** Passphrase vergessen = Daten weg.
> Lege ein Backup an (verschlüsselte `.vault`-Datei) und bewahre die Passphrase sicher auf.

## Was es kann

- **Buchen**: Kauf, **Verkauf** und **Entnahme** (Transfer/Ausgabe ohne Verkauf) — je für
  Bitcoin (Menge, Betrag, Quelle/Ziel, KYC-Flag) und Gold/Silber (Menge, Einheit g/oz/kg,
  Form Münze/Barren, Feinheit ‰, Stückzahl, Händler).
- **BTC oder Sats** (seit v2.2): Anzeige-Einheit umschaltbar (Übersicht, Bestände,
  Verlauf) und beim Erfassen wahlweise Eingabe in BTC oder Sats — gespeichert und
  exportiert wird immer BTC, das Steuertool-Format bleibt unverändert.
- **Backup-Erinnerung** (seit v2.2): Die Übersicht warnt, wenn noch kein Backup existiert
  oder das letzte länger her ist und neue Buchungen dazukamen — rein lokal.
- **Mehrwährung** (seit v2.1): Buchungen in **EUR, USD oder CHF**. Summen werden je Währung
  getrennt ausgewiesen — die App rechnet bewusst nicht um (sie kennt keine Kurse, fragt
  keine ab). Optional lässt sich je Fremdwährungs-Buchung der **EUR-Gegenwert vom
  Buchungstag** (laut Abrechnung) miterfassen.
- **Übersicht**: **Netto-Bestand** je Anlageklasse (Käufe − Verkäufe − Entnahmen),
  investierter Einstand, realisierte Erlöse. Optional aktuelle Preise manuell eintragen
  (bewusst **keine Netz-Abfrage**, OpSec) → aktueller Wert & G/V ggü. netto investiert.
- **Vermögensentwicklung** (seit v2.12): Jeder Preis, den du in der Übersicht einträgst, wird
  mit Datum gemerkt (ein Stand je Tag). Daraus zeichnet der Verlauf den **Wert deiner Bestände**
  neben dem gestrichelten **Einstand** — mit Zeitraum-Umschaltern (YTD/1J/3J/5J/MAX) und einem
  Tooltip, der zu jedem Tag Wert, Einstand und Differenz nennt. Weiterhin **keine Netz-Abfrage**:
  bewertet wird ausschließlich mit den selbst eingetragenen Ständen, und vor dem ersten Stand
  gibt es bewusst keine Wertlinie statt erfundener Zahlen.
- **Steuertool-Export**: `manual_buys.csv` (Käufe) und `manual_sales.csv` (Verkäufe) exakt
  im Format des BTC-Steuertools. Entnahmen sind keine Verkäufe und bleiben tresor-intern.
  Das Steuertool rechnet in EUR: USD/CHF-Buchungen sind nur mit erfasstem EUR-Gegenwert
  enthalten — sonst werden sie ausgelassen und eine Warnung zeigt, wie viele fehlen.
- **Edelmetall-CSV**: separates Inventar (mit Vorgang Kauf/Verkauf/Entnahme).
- **Nachlass-Anhang** (seit v2.6): ein Blatt mit den aktuellen Netto-Beständen für das
  Erben-Paket, im Aufbau des [Nachlassplaners](https://alien-investor.org/nachlassplaner.html)
  (Fassungsnummer, Datum, Vernichtungsvermerk, Hinweise in Erben-Sprache). Nur Mengen mit
  Stückelung, keine Preise, keine Händler, keine Standorte. Zusammenspiel: Der Tresor kennt
  die Mengen, der Planer kennt die Orte — der Anhang bringt beides in ein Erben-Paket, ohne
  dass ein Werkzeug die Daten des anderen liest. Druck (Browser), PDF über den Speichern-Dialog (Linux-App) oder `.txt` (Handy).
- **Aegis-2FA mit QR**: QR scannen, als Bild speichern (Aegis kann ihn ohne Kamera aus der
  Galerie importieren), kopieren, oder den Base32-Schlüssel manuell eintragen.
- **Dubletten-Schutz**: Warnung beim Erfassen, wenn Typ + Vorgang + Datum + Menge bereits
  existieren; bestehende Doppel werden in der Liste mit ⚠ markiert.
- **Verschlüsselter Sync** der `.vault`-Datei via Syncthing.

## Sicherheit

- Verschlüsselung: **AES-256-GCM** über native **WebCrypto**. Den Schlüssel leitet seit v3.0
  **Argon2id** aus deiner Passphrase ab (64 MiB Speicher, 3 Durchgänge): Jeder Rateversuch
  kostet Arbeitsspeicher, das macht Durchprobieren auf Grafikkarten und Spezialchips deutlich
  teurer als mit dem früheren PBKDF2. Argon2id stammt aus der quelloffenen Bibliothek
  [hash-wasm](https://www.npmjs.com/package/hash-wasm) (MIT, Version 4.12.0), liegt fest unter
  `vendor/hash-wasm/` und wird beim Build per SHA-256 geprüft.
- **Schlüsselhierarchie** (v3.0): Die Daten verschlüsselt ein zufälliger Datenschlüssel; die
  Passphrase schützt nur diesen. Ein Passphrase-Wechsel erneuert beide.
- **Umstellung** (v3.0): Tresore aus älteren Versionen werden beim ersten Entsperren automatisch
  umgestellt — geschrieben wird erst, nachdem die neue Datei zur Probe entschlüsselt wurde. Alte
  `.vault`-Backups bleiben dauerhaft importierbar.
- **Keine INTERNET-Berechtigung** (ab v2.0): Dass die Android-App nicht nach Hause funken *kann*,
  erzwingt das Betriebssystem — im Manifest der APK selbst nachprüfbar. Ihre **einzige
  System-Berechtigung** ist seit v3.0 `USE_BIOMETRIC` für das optionale Fingerabdruck-Entsperren,
  dazu `USE_FINGERPRINT`, das androidx.biometric mitbringt und die App auf Android bis 8.1
  beschränkt. Die im Manifest zusätzlich gelistete `…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` ist
  eine app-interne Signatur-Berechtigung von AndroidX ohne Systemzugriff. Der Build bricht ab,
  sobald die fertige APK eine andere Berechtigung anfordert.
- **Fingerabdruck** (optional, v3.0): Ein vom Android-Keystore verwahrter Zufallsschlüssel schließt
  den Datenschlüssel auf, freigegeben nur nach starker Biometrie. **Ehrlich eingeordnet:** bequem,
  aber erzwingbar, und kein zusätzlicher Faktor. Die Passphrase bleibt Pflicht nach jedem Neustart
  (seit v3.2 abwählbar: Haken „auch nach Neustart“ beim Aktivieren, ab Werk aus — die Wahl steckt
  im Fingerabdruck-Slot und ist dort mitauthentisiert),
  nach einem Passphrase-Wechsel (danach ist der Fingerabdruck aus und muss neu aktiviert werden),
  nach „Jetzt sperren“ und sobald in Android ein neuer Fingerabdruck
  registriert wird — dann schaltet die App den Fingerabdruck ab und warnt. Die Neustart-Regel ist
  Programmcode, keine kryptografische Garantie; Android bindet den Schlüssel an jede starke
  Biometrie des Geräts.
- **FLAG_SECURE** (ab v2.0): keine Screenshots, kein Screen-Recording, keine
  Bestands-Vorschau im App-Switcher. **allowBackup=false** plus Regeln gegen die
  Gerät-zu-Gerät-Übertragung (v3.0): Tresor-Daten landen in keinem ADB-/Cloud-Backup und werden
  beim Handywechsel nicht mitkopiert — Backups machst nur du selbst (`.vault`).
- **Kein fremdes Autofill** (ab v3.6.1): Die App nimmt ihre WebView vom Android-Autofill-Framework aus. Ein anderer Passwort-Manager,
  der als Autofill-Dienst eingerichtet ist, sieht die Passphrase-Felder nicht und kann nicht anbieten, sie zu speichern —
  `autocomplete="off"` im HTML hält das nicht auf (Querfund aus dem Gerätetest von Alien Pass).
- **Rückfragen im eigenen Dialog** (ab v3.5): Löschen, mögliche Duplikate, 2FA/Fingerabdruck abschalten und
  „Lokale Daten löschen“ fragen in einem Dialog innerhalb der App nach, nicht über den Android-Systemdialog.
  Der Systemdialog erbt FLAG_SECURE nicht — ein Screenshot bei offener Rückfrage hätte den Dialogtext gezeigt,
  während die App dahinter schwarz blieb (intern gefunden beim Gerätetest der Schwester-App Alien Notes).
- **Sperre auch bei offenem Datei-Picker** (ab v3.6): Läuft die Auto-Sperre ab, während der Datei-Picker offen ist, sperrt die App
  trotzdem — kein Schlüssel bleibt im Speicher. Die gewählte Datei (`.vault` oder CSV) geht dabei nicht verloren: Die App merkt sich nur
  den Verweis, liest nichts, solange sie zu ist, und nach dem Entsperren läuft der Import mit genau dieser Datei weiter (intern gefunden beim
  Gerätetest der Schwester-App Alien Pass). Eine inzwischen geänderte oder ersetzte Datei wird gemeldet, nicht still übergangen (ab v3.6.1).
- **Deckel für den CSV-Import** (ab v3.6.1, wie Alien Pass): höchstens 20 MiB, 40.000 Zeilen, 10.000 Buchungen im Tresor.
- **Content-Security-Policy** mit `connect-src 'none'`: Die Seite selbst kann
  keinerlei Netz-Verbindung aufbauen, unabhängig von der Hülle. Seit v2.2 zusätzlich **ohne `unsafe-inline`**
  (`script-src 'self'`): Inline-Script ist komplett verboten — selbst eingeschleustes
  Markup hätte keine Ausführungsfläche. Seit v3.0 steht dort zusätzlich `'wasm-unsafe-eval'`:
  Browser (auch die Android-WebView) brauchen es, um das Argon2-WebAssembly zu übersetzen; es erlaubt weder `eval` noch
  Inline-Script.
- **2FA (Aegis)**: optionaler TOTP-Zweitfaktor (RFC 6238) als zweite Hürde beim
  Entsperren auf dem Gerät. Die Verschlüsselung selbst schützt allein die Passphrase —
  wähle sie entsprechend stark.
- **Fehlversuchs-Bremse** (v3.0): Nach 3 falschen Versuchen wächst eine Wartezeit bis 30 Sekunden
  — ein Riegel gegen Durchprobieren am Gerät, kein Krypto-Schutz.
- Daten liegen nur **verschlüsselt** auf dem Gerät und in der `.vault`-Backup-Datei.
  Im Klartext verlässt nichts das Gerät. **Kein Reset, kein Backdoor.**
- Importierte `.vault`-Dateien werden **schema-validiert** (nur bekannte Felder und
  geprüfte Typen), alle Inhalte werden beim Anzeigen HTML-escaped.
- Der QR-Encoder ist eigenständig (kein Fremdcode) und bit-genau gegen eine Referenz-Lib
  verifiziert. Keine externen CDNs, keine Tracker, keine Netz-Abfragen.
- **Desktop-Fassung (Linux, seit v3.3), ehrlich eingeordnet:**
  - **Kein Netz, vom System erzwungen:** Das Flatpak hat keine Netzwerk-Berechtigung, im Käfig gibt es nur `lo`. Zusätzlich blockt die App
    selbst jede Verbindung (Content-Security-Policy, Anfrage-Filter, WebRTC über einen toten Proxy ins Leere). **Keine Dateien:** Backup, Import,
    CSV-Export und Nachlass-Anhang laufen über den Dateidialog des Systems (Portal), der nur die gewählte Datei freigibt.
  - **Härtung der Hülle:** Chromium-Sandbox über Flatpaks eigenen Käfig (`zypak`), Renderer ohne Node, Kontext-Isolation, nur die eigene
    Seite erreicht die Brücke zum Hauptprozess. Electron-Fuses: kein `ELECTRON_RUN_AS_NODE`, kein `NODE_OPTIONS`, kein `--inspect`, App nur aus
    dem Archiv. Fernsteuerung (`--remote-debugging-*`) wird verweigert, DevTools lassen sich nicht öffnen, kein Anwendungsmenü.
  - **Tresor als Datei** (Rechte 600, Ordner 700), atomar geschrieben — ein Absturz oder eine volle Platte hinterlässt nie einen halben Tresor.
  - **Zwischenablage:** Der kopierte 2FA-Schlüssel ist für KDE als Passwort markiert, Klipper nimmt ihn nicht in den Verlauf (unter Plasma
    geprüft); andere Zwischenablage-Manager können die Markierung ignorieren. Die App löscht ihre eigene Kopie beim Sperren und beim Beenden.
    Nur der Kopieren-Knopf setzt die Markierung — Strg+C auf markiertem Text kopiert über Chromium ohne sie und wird nicht gelöscht.
    Anders als Alien Pass überwacht der Tresor **nicht**, was du mit der Maus markierst (Mittelklick-Einfügen unter X11) — er zeigt keine
    Passwörter, nur beim Einrichten von 2FA liegt ein Geheimnis auf dem Schirm.
  - **Klartext verlässt den Käfig nur auf deinen Klick:** CSV-Exporte, der Nachlass-Anhang als `.txt` oder PDF sind unverschlüsselt —
    nach Gebrauch löschen.
  - **Grenzen:** Die App liefert ihre Browser-Engine (Electron 44) selbst mit — Sicherheits-Updates dafür kommen nur mit einer neuen
    App-Version, nicht über das System. **Kein Schutz vor Bildschirmfotos** (Linux kennt kein Gegenstück zu FLAG_SECURE). Unter **X11** kann
    jedes laufende Programm Tastatur und Zwischenablage mitlesen, Wayland trennt Programme besser. Bei **Bildschirmsperre und Ruhezustand
    sperrt die App nicht von selbst** (im Flatpak erfährt sie davon nichts): Systemsperre nutzen, dazu eine kurze Inaktivitäts-Sperre,
    Strg+L sperrt sofort. „Hintergrund“ heißt am Desktop minimiert oder versteckt — ein Wechsel zu einem anderen Fenster sperrt nicht,
    leert aber getippte Passphrasen. Kein Fingerabdruck. Die Hülle besteht aus drei kleinen Dateien (`desktop/main.js`, `desktop/preload.js`,
    `desktop/atomic.js`) plus Electron. Muster und Härtung stammen aus Alien Pass (dort drei interne Audits); für den Tresor selbst gab es Tests
    mit der echten Hülle, kein eigenes Audit.

## Open Source & selbst prüfen

Der komplette **Client-Code ist offen** ([MIT](LICENSE)) — du musst niemandem vertrauen, du kannst
nachsehen: `index.html` (UI), `app.js` (App + Krypto), `qr.js`, `sw.js`, `vendor/hash-wasm/` (Argon2id). Die Desktop-Hülle liegt
vollständig in `desktop/` (Hauptprozess, Brücke, Build-Skript mit gepinntem Electron-Hash, Flatpak-Manifest). Schnell-Audit:

- **Kein Nach-Hause-Telefonieren:** keine `fetch`/`XMLHttpRequest`/WebSocket-Aufrufe, keine externen
  Skripte, keine CDNs, kein Analytics. Die einzige externe URL ist der Spenden-Link.
- **Krypto:** AES-256-GCM über native `crypto.subtle` (WebCrypto); Argon2id aus `vendor/hash-wasm/`
  (MIT, Version 4.12.0, beim Build per SHA-256 geprüft). Den alten PBKDF2-Lesepfad behält die App, damit
  frühere Backups importierbar bleiben — geschrieben wird nur noch das neue Format.
- **Schriften** liegen lokal unter `vendor/` (kein Google-Fonts-Abruf).
- `roundtrip-test.mjs` belegt: Export → `.vault` → Import auf einem Zweitgerät ist verlustfrei.

> Build-/Signatur-/Deploy-Interna (Keystore, Server) liegen bewusst **nicht** im öffentlichen Teil —
> sie enthalten keine Geheimnisse, aber auch keinen Mehrwert für die Prüfung des Clients.

## Bedienung

> 💡 Die komplette Bedienung steckt auch **als Handbuch in der App** — der „?"-Button
> oben rechts öffnet es (offline, ohne Netz).

### Aegis 2FA einrichten

1. Tresor öffnen → **Einstellungen → 2FA aktivieren**.
2. In **Aegis** → „+" → entweder den **QR-Code scannen** oder „Eintrag manuell hinzufügen"
   → Typ **TOTP** → den **Base32-Schlüssel** eingeben.
3. Den 6-stelligen Aegis-Code zur Bestätigung eintippen → fertig.

> Tipp: Läuft der Tresor auf demselben Handy wie Aegis, ist das manuelle Eintragen des
> Schlüssels (Kopier-Button) bequemer als den eigenen Bildschirm zu scannen.

Die 2FA-Hürde gilt **nur auf diesem Gerät** — ein Backup trägt sie nicht mit (seit v3.4, wie bei Alien Pass).
Auf jedem weiteren Gerät richtest du sie getrennt ein. So bleibt ein Backup immer der Notausgang, wenn Aegis
verloren geht: neu einrichten, Backup importieren, kein Code nötig.

### Backup & Sync (Syncthing)

1. Auf beiden Geräten Syncthing, einen gemeinsamen Ordner teilen (z.B. `Tresor/`).
2. Im Tresor **Export & Sync → Backup erstellen** → die `.vault`-Datei in den Syncthing-Ordner legen.
3. Auf dem anderen Gerät den Tresor zuerst **einrichten** (eigene Passphrase – darf eine andere
   sein) und entsperren, dann **Vault importieren** → Datei wählen → die Passphrase **der
   importierten Datei** eingeben.
   Sperrt die App, während der Datei-Picker offen ist, zeigt der Sperrbildschirm „Datei gewählt — zum Importieren
   entsperren“; nach dem Entsperren läuft der Import mit genau dieser Datei weiter.

> **Wie der Import zusammenführt:** Der Import **ersetzt nicht**, sondern **merged additiv**
> über die eindeutige `id` jedes Eintrags — neue Einträge kommen hinzu, deine lokalen bleiben,
> deine lokale Passphrase bleibt unverändert, und die 2FA-Hürde des Backups wird nie übernommen. Das heißt aber: **nachträgliche Änderungen und
> Löschungen syncen nicht** (ein bearbeiteter Eintrag bleibt auf dem anderen Gerät auf altem
> Stand, ein gelöschter taucht beim Import wieder auf). Für ein anhängendes Käufe-Logbuch ist
> das meist gewollt; korrigiere Einträge sonst auf beiden Geräten gleich.

> Sync ist bewusst **manuell** (Export/Import), damit kein Hintergrund-Prozess still Daten
> schreibt. Die `.vault`-Datei ist verschlüsselt — selbst wenn sie irgendwo landet, ist ohne
> Passphrase nichts lesbar.

### Steuertool-Export

**Export & Sync → manual_buys.csv** erzeugt genau das Eingabeformat des BTC-Steuertools.
KYC-Käufe bekommen `kyc=ja` (landen im Finanzamt-Report), noKYC bleibt leer (nur interner
Report). Edelmetalle sind in DE nach 1 Jahr Haltefrist steuerfrei und brauchen das Steuertool
nicht — dafür gibt es die separate `edelmetalle.csv`.

---
100 % lokal · Alien Investor Stil · keine Konto-, keine Server-Abhängigkeit.
