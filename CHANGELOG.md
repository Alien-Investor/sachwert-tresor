# Changelog

Alle nennenswerten Änderungen am Sachwert-Tresor. Neueste oben.
Format: `## vX.Y — Datum`. Web-PWA und native App teilen sich eine Codebasis.

## v2.1 — 2026-07-19

Mehrwährungs-Support: Buchungen in EUR, USD oder CHF — für BTC und Edelmetalle.

- **Neu: Währung je Buchung.** Beim Erfassen wählbar (EUR/USD/CHF); bestehende
  Einträge gelten weiter als EUR und lassen sich rückwirkend über „Bearbeiten"
  auf USD/CHF umstellen. Die App rechnet bewusst **nicht** um — sie kennt keine
  Kurse und fragt keine ab (offline, keine Netzabfrage).
- **Übersicht & Verlauf:** Summen („Investiert", „Realisiert", „Netto investiert")
  werden **je Währung getrennt** ausgewiesen (z.B. „900,00 € · 1.000,00 $"),
  statt Beträge verschiedener Währungen stillschweigend zu addieren.
- **Neu: optionaler EUR-Gegenwert.** Bei USD/CHF-Buchungen kann der EUR-Wert vom
  Buchungstag (laut Abrechnung) miterfasst werden. Damit bleiben Steuertool-Export
  und Wert-Vergleich aufs Datum genau vollständig.
- **Steuertool-Export bleibt steuerlich sauber:** Das BTC-Steuertool rechnet in EUR.
  USD/CHF-Buchungen landen nur mit erfasstem EUR-Gegenwert im Export; ohne werden
  sie ausgelassen und eine sichtbare Warnung zeigt, wie viele fehlen — niemals
  stillschweigend falsche Beträge.
- **Wert-Vergleich (manuelle Preise):** Gewinn/Verlust rechnet gegen die EUR-Basis
  (EUR-Buchungen + EUR-Gegenwerte); fehlen Gegenwerte, wird das P/L als „≈" markiert
  und ein Hinweis genannt.
- **Liste & Exporte:** Beträge mit Währungssymbol, EUR-Gegenwert als „≈"-Zusatz;
  `edelmetalle.csv` hat neue Spalten `waehrung` und `eur_gegenwert` (Spalte `eur`
  heißt jetzt `betrag`).
- **Import-Härtung erweitert:** Währungsfeld und EUR-Gegenwert laufen durch die
  Feld-Whitelist des Vault-Imports (unbekannte Währungen werden zu EUR normalisiert,
  ungültige Gegenwerte verworfen).

## v2.0 — 2026-07-04

Sicherheits-Release: Härtung nach internem Code-Audit. Keine neuen Pflichtschritte
für Nutzer — bestehende Tresore, Backups und 2FA funktionieren unverändert.

- **Android — keine INTERNET-Permission mehr:** Die App kann auf Betriebssystem-Ebene
  nachweisbar keine Verbindung aufbauen. „Keine Telemetrie" ist jetzt im Manifest
  verifizierbar, nicht nur ein Versprechen.
- **Android — FLAG_SECURE:** Keine Screenshots, kein Screen-Recording, keine
  Bestands-Vorschau im App-Switcher (Recents).
- **Android — allowBackup=false:** Tresor-Daten landen in keinem ADB-/Cloud-Backup.
  Backups macht ausschließlich der Nutzer selbst (verschlüsselte `.vault`-Datei).
- **Content-Security-Policy:** `connect-src 'none'` — selbst ein hypothetischer
  Script-Einschleusungs-Fund könnte keine Daten übers Netz exfiltrieren.
- **Vault-Import gehärtet:** Einträge aus `.vault`-Dateien werden beim Zusammenführen
  schema-validiert (nur bekannte Felder, geprüfte Typen, begrenzte Textlängen);
  alle Felder werden beim Rendern HTML-escaped. Ein präpariertes Backup kann keinen
  Code mehr in die App schmuggeln. 2FA-Secrets werden beim Import Base32-validiert.
- **Sperren räumt auf:** Beim manuellen wie automatischen Sperren werden alle
  gerenderten Bestände, Formulareingaben und der 2FA-QR aus dem DOM entfernt —
  nichts Entschlüsseltes bleibt im Hintergrund lesbar.
- **Auto-Lock nach Backgrounding:** Kehrt man nach längerer Zeit zur App zurück
  (eingefrorene WebView), wird die verstrichene Zeit geprüft und sofort gesperrt —
  vorher konnte der Timer im Hintergrund pausieren.
- **Speicherfehler sichtbar:** Schlägt das Persistieren fehl (Speicher voll), erscheint
  eine deutliche Warnung statt eines stillen Datenverlusts.
- **CSV-Export:** Formel-Injection neutralisiert (`=`, `+`, `@` am Zellanfang).
- **Offline-Fallback:** Service Worker liefert bei Navigationen ohne Netz die App-Shell.
- **Handbuch:** Ehrliche Einordnung, dass der Aegis-Code eine Entsperr-Hürde ist,
  kein zweiter Verschlüsselungsfaktor.
- **Fixes:** Restliche deutsche Texte im Englisch-Modus übersetzt („Entschlüssele…",
  „Ändere…", CSV-Fehlermeldungen); Preis-Eingabefelder werden nicht mehr während
  des Tippens vom Neu-Rendern überschrieben.

## v1.9 — 2026-06-14

- **Fix (i18n, Wurzelursache):** Beim Sprachwechsel aktualisierten sich JS-gerenderte
  Inhalte nicht, solange man auf dem Tab blieb — am sichtbarsten die vier Übersichts-
  Kacheln („Bitcoin (Bestand)", „Gold fein", „Silber fein", „Netto investiert"), die
  im Englisch-Modus deutsch blieben. Ursache: ein falscher `window.App`-Check verhinderte
  das Neu-Rendern. Jetzt schalten Übersicht, Verlauf, Liste und Einstellungen sofort um.

## v1.8 — 2026-06-14

- **Fix (i18n):** Im Verlauf-Tab blieben „Höchststand", „… jetzt" und „X Datenpunkte"
  auch im Englisch-Modus deutsch; ebenso der Speichern-Button im Bearbeiten-Modus.
  Jetzt vollständig übersetzt.
- **Fix:** Der Spenden-Blitz im Footer war ein Emoji (gelb in der App, winzig im Web).
  Ersetzt durch ein grünes Blitz-SVG (neon, passend zum Design, größer und überall gleich).
- **Klarstellung:** Der CSV-Import-Hinweis verwies auf einen „Konverter", den es nicht gibt.
  Text korrigiert; Handbuch erklärt jetzt die Aufgabenteilung — Broker-/Börsen-CSVs gehören
  direkt ins BTC-Steuertool, der Tresor-CSV-Import ist nur für eigene Listen im Tresor-Format.
- **Handbuch:** Abschnitt „Backup & Sync" erklärt jetzt genau, wo die Daten liegen
  (localStorage: App-Sandbox vs. Browser-Profil) und warum die App persistenter ist.
- **UI:** Mehr Abstand zwischen „Jetzt sperren" und „Lokale Daten löschen" in den
  Einstellungen (lagen am Handy beim Umbruch zu eng beieinander).

## v1.7 — 2026-06-13

- **Neu: Sprachumschalter Deutsch/Englisch.** Der „DE/EN"-Button oben links schaltet die
  komplette Oberfläche (inkl. Handbuch) um — offline, ohne Netz. Standard nach Gerätesprache,
  Auswahl wird gemerkt. Englischsprachige können den Tresor jetzt vollständig nutzen.

## v1.6 — 2026-06-13

- **Fix (App):** CSV-Exporte (Steuertool/Verkäufe/Edelmetalle) und „QR als Bild speichern"
  liefen über den Browser-Download, der in der nativen App-WebView nicht funktioniert —
  am Handy passierte nichts. Laufen jetzt über den nativen Speichern-/Teilen-Weg (wie das
  Vault-Backup). Auf dem Desktop unverändert als Download.

## v1.5 — 2026-06-13

- **Neu: In-App-Handbuch.** Der „?"-Button oben rechts öffnet ein Vollbild-Handbuch
  (offline) mit allem Wichtigen: Prinzip, Erste Schritte, Erfassen, Backup & Sync,
  CSV-Import, Steuertool-Export, 2FA über Geräte, Sicherheit.

## v1.4 — 2026-06-13

- **Fix:** Die `.vault`-Backup-Datei ließ sich in der nativen App nicht auswählen —
  Androids Datei-Picker graute sie aus (unbekannter MIME-Typ). Der Dateifilter wurde
  entfernt, jetzt ist sie wählbar.

## v1.3 — 2026-06-13

- **Fix:** „Backup wiederherstellen" in der nativen App tat nichts. Die Passphrase-Abfrage
  lief über ein Browser-Dialogfenster, das in der App-WebView deaktiviert ist. Jetzt fragt
  ein In-App-Eingabefeld nach der Passphrase — Import funktioniert auf Web und App.

## v1.2 — 2026-06-13

- **Neu:** Spenden-Link im Footer (öffnet `alien-investor.org/spenden.html` extern).

## v1.1 — 2026-06-13

- **Neu:** Eigenes App-Icon (Neon-Tresor-Dial + Alien-Kopf + Bitcoin/Gold/Silber-Punkte),
  zugleich PWA-Icon. Android-Adaptive-Icon.

## v1.0 — 2026-06-13

- Erste Version. Lokaler, verschlüsselter Tresor für Bitcoin-, Gold- und Silberbestände.
- Verschlüsselung AES-256-GCM, Schlüssel via PBKDF2-SHA256 (600.000 Iterationen), native WebCrypto.
- Optionales 2FA (Aegis/TOTP, RFC 6238), eigener QR-Encoder (kein Fremdcode).
- Erfassen von Kauf/Verkauf/Entnahme (BTC) und Gold/Silber (Stückzahl × Stückelung).
- Backup/Wiederherstellen über verschlüsselte `.vault`-Datei, CSV-Bulk-Import.
- Export ins BTC-Steuertool-Format. Komplett offline, keine Cloud, keine Telemetrie.
- Native GrapheneOS/Android-App (Capacitor, signierte APK) + Web-PWA.
