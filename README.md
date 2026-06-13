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

**Signatur-Fingerprint** (zum Prüfen der Echtheit, über alle Versionen gleich):
```
SHA-256: 660f210c7a289f388bb4812c23825a77f1fc84e6a7ee58d64281b6bf5cd87988
```
> Android/GrapheneOS prüft die Signatur ohnehin automatisch und lehnt fremd signierte
> Updates ab.

## Erster Start

Beim ersten Öffnen vergibst du deine **Passphrase** — danach entsperrt nur sie den Tresor.
Optional aktivierst du einen **2FA-Code** (Aegis/TOTP) als zweite Hürde.

> ⚠️ **Es gibt keinen Reset und kein Backdoor.** Passphrase vergessen = Daten weg.
> Lege ein Backup an (verschlüsselte `.vault`-Datei) und bewahre die Passphrase sicher auf.

## Was es kann

- **Buchen**: Kauf, **Verkauf** und **Entnahme** (Transfer/Ausgabe ohne Verkauf) — je für
  Bitcoin (Menge, EUR, Quelle/Ziel, KYC-Flag) und Gold/Silber (Menge, Einheit g/oz/kg,
  Form Münze/Barren, Feinheit ‰, Stückzahl, Händler).
- **Übersicht**: **Netto-Bestand** je Anlageklasse (Käufe − Verkäufe − Entnahmen),
  investierter Einstand, realisierte Erlöse. Optional aktuelle Preise manuell eintragen
  (bewusst **keine Netz-Abfrage**, OpSec) → aktueller Wert & G/V ggü. netto investiert.
- **Steuertool-Export**: `manual_buys.csv` (Käufe) und `manual_sales.csv` (Verkäufe) exakt
  im Format des BTC-Steuertools. Entnahmen sind keine Verkäufe und bleiben tresor-intern.
- **Edelmetall-CSV**: separates Inventar (mit Vorgang Kauf/Verkauf/Entnahme).
- **Aegis-2FA mit QR**: QR scannen, als Bild speichern (Aegis kann ihn ohne Kamera aus der
  Galerie importieren), kopieren, oder den Base32-Schlüssel manuell eintragen.
- **Dubletten-Schutz**: Warnung beim Erfassen, wenn Typ + Vorgang + Datum + Menge bereits
  existieren; bestehende Doppel werden in der Liste mit ⚠ markiert.
- **Verschlüsselter Sync** der `.vault`-Datei via Syncthing.

## Sicherheit

- Verschlüsselung: **AES-256-GCM**, Schlüssel via **PBKDF2-SHA256 (600.000 Iterationen)**
  aus deiner Passphrase — alles native **WebCrypto**, kein Fremd-Krypto-Code.
- **2FA (Aegis)**: optionaler TOTP-Zweitfaktor (RFC 6238). Die Passphrase verschlüsselt die
  Daten; der Aegis-Code ist die zweite Hürde beim Entsperren.
- Daten liegen nur **verschlüsselt** auf dem Gerät und in der `.vault`-Backup-Datei.
  Im Klartext verlässt nichts das Gerät. **Kein Reset, kein Backdoor.**
- Der QR-Encoder ist eigenständig (kein Fremdcode) und bit-genau gegen eine Referenz-Lib
  verifiziert. Keine externen CDNs, keine Tracker, keine Netz-Abfragen.

## Open Source & selbst prüfen

Der komplette **Client-Code ist offen** ([MIT](LICENSE)) — du musst niemandem vertrauen, du kannst
nachsehen: `index.html` (App + Krypto), `qr.js`, `sw.js`. Schnell-Audit:

- **Kein Nach-Hause-Telefonieren:** keine `fetch`/`XMLHttpRequest`/WebSocket-Aufrufe, keine externen
  Skripte, keine CDNs, kein Analytics. Die einzige externe URL ist der Spenden-Link.
- **Krypto:** ausschließlich native `crypto.subtle` (WebCrypto) — AES-256-GCM + PBKDF2-SHA256 (600k).
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

### Backup & Sync (Syncthing)

1. Auf beiden Geräten Syncthing, einen gemeinsamen Ordner teilen (z.B. `Tresor/`).
2. Im Tresor **Export & Sync → Backup erstellen** → die `.vault`-Datei in den Syncthing-Ordner legen.
3. Auf dem anderen Gerät den Tresor zuerst **einrichten** (eigene Passphrase – darf eine andere
   sein) und entsperren, dann **Vault importieren** → Datei wählen → die Passphrase **der
   importierten Datei** eingeben.

> **Wie der Import zusammenführt:** Der Import **ersetzt nicht**, sondern **merged additiv**
> über die eindeutige `id` jedes Eintrags — neue Einträge kommen hinzu, deine lokalen bleiben,
> deine lokale Passphrase bleibt unverändert. Das heißt aber: **nachträgliche Änderungen und
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
