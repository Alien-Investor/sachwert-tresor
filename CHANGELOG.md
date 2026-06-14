# Changelog

Alle nennenswerten Änderungen am Sachwert-Tresor. Neueste oben.
Format: `## vX.Y — Datum`. Web-PWA und native App teilen sich eine Codebasis.

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
