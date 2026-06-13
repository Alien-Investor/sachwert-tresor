# Sachwert-Tresor — Installation

Lokaler, verschlüsselter Tresor für deine **Bitcoin-, Gold- und Silberbestände**.
Läuft komplett **offline** auf deinem Gerät — keine Cloud, kein Server, keine Telemetrie.
Deine Daten verlassen das Gerät nie im Klartext.

## 📲 App installieren (Android / GrapheneOS)

Die App ist bewusst **nicht im Google Play Store**. Sie wird über signierte Releases
hier auf Codeberg verteilt.

### Empfohlen: Obtainium (automatische Updates, ohne Google)

1. [Obtainium](https://github.com/ImranR98/Obtainium) installieren.
2. **„App hinzufügen"** → diese URL eintragen:
   ```
   https://codeberg.org/Alien-Investor/sachwert-tresor
   ```
3. Quelle wird als **Forgejo/Gitea** erkannt → **Hinzufügen** → **Installieren**.
4. Neue Versionen meldet Obtainium ab dann automatisch.

### Ohne Obtainium: APK direkt laden

[**Neuestes Release herunterladen**](https://codeberg.org/Alien-Investor/sachwert-tresor/releases/latest)
→ die `.apk`-Datei installieren.

## Echtheit prüfen — Signatur-Fingerprint

Über alle Versionen identisch (keystore-gebunden):

```
SHA-256: 660f210c7a289f388bb4812c23825a77f1fc84e6a7ee58d64281b6bf5cd87988
```

Android/GrapheneOS prüft die Signatur ohnehin automatisch und lehnt jedes fremd
signierte Update bei der Installation ab.

## Erster Start

Beim ersten Öffnen vergibst du deine **Passphrase**. Danach entsperrt nur sie den Tresor.
Optional aktivierst du einen **2FA-Code** (Aegis/TOTP) als zweite Hürde.

> ⚠️ **Es gibt keinen Reset und kein Backdoor.** Passphrase vergessen = Daten weg.
> Lege ein Backup an (verschlüsselte `.vault`-Datei) und bewahre die Passphrase sicher auf.

## Sicherheit

- Verschlüsselung: **AES-256-GCM**, Schlüssel via **PBKDF2-SHA256 (600.000 Iterationen)**,
  native WebCrypto — kein Fremd-Krypto.
- Daten liegen nur **verschlüsselt** auf dem Gerät und in der `.vault`-Backup-Datei.
- Keine Netz-Abfragen (auch keine Kurs-APIs) — Preise trägst du selbst ein.

---
*100 % lokal · keine Cloud · keine Telemetrie · Alien Investor*
