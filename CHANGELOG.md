# Changelog

Alle nennenswerten Änderungen am Sachwert-Tresor. Neueste oben.
Format: `## vX.Y — Datum`. Android-App und Linux-Desktop teilen sich eine Codebasis.

## v3.6.1 — 2026-09-26

Nacharbeit aus dem gezielten internen Security-Audit zu v3.6 (kein Fund über „niedrig“, nichts davon betrifft Verschlüsselung oder Daten).

- **CSV-Import mit Deckeln wie in Alien Pass:** höchstens 20 MiB, 40.000 Zeilen und 10.000 Buchungen im Tresor; die Größe wird vor dem Lesen
  geprüft, der Zeilendeckel beim Einlesen, der Buchungsdeckel vor dem Einfügen (nichts wird halb übernommen). Die Dubletten-Prüfung ist jetzt
  linear statt quadratisch — eine große CSV fror die App vorher für Minuten ein, und die Auto-Sperre kam erst danach.
- **Kein fremdes Autofill mehr (Querfund aus dem Gerätetest von Alien Pass, im Tresor genauso beobachtet):** Die WebView meldete jedes
  Passwortfeld an das Android-Autofill-Framework; ein anderer Passwort-Manager als Autofill-Dienst bot sich im Passphrase-Feld des
  Backup-Imports an und konnte anbieten, die Passphrase zu speichern. `autocomplete="off"` hält das nicht auf, darum jetzt nativ: Die App
  nimmt ihre Felder vom Autofill-Framework aus (eine Zeile in der MainActivity, wie bisher im Klartext in `patch-hardening.mjs`).
- **Lesefehler werden gemeldet:** Wurde die gewählte Datei zwischen Auswahl und Entsperren geändert oder ersetzt (z.B. durch Syncthing), liest
  der Browser sie nicht mehr. Vorher blieb es still, jetzt steht „Datei konnte nicht gelesen werden — bitte erneut wählen.“ Gilt für CSV und `.vault`.
- **Kleinigkeiten:** Eine zurückgestellte Uhr verlängert den gemerkten Dateiverweis nicht mehr; ein Verweis verfällt bei einer Neu-Einrichtung;
  eine Sperre mit erneutem Entsperren während des Lesens verwirft die CSV. Wortlaut in Handbuch, README und CHANGELOG: nach dem Entsperren
  „läuft der Import weiter“ (beim `.vault` folgt die Passphrase der Datei), und die Sperr-Regel ist korrekt beschrieben.

## v3.6 — 2026-09-26

Ein Gerätetest-Fund aus der Schwester-App Alien Pass, hier nachgezogen. Am Tresor-Format, an der Verschlüsselung und an deinen Daten ändert
sich nichts; Android und Linux-Desktop bekommen dieselbe App.

- **Import bei Sperre während des Datei-Pickers war unmöglich.** Der Datei-Picker ist eine eigene Android-Ansicht (am Desktop der Dateidialog des
  Systems); läuft währenddessen die Auto-Sperre ab, kam die gewählte Datei in eine gesperrte App: Eine CSV wurde still verworfen, ein
  `.vault`-Backup trotz Sperre eingelesen. Jetzt merkt sich die App nur den Verweis auf die Datei (gelesen wird nichts, solange die App zu
  ist), zeigt auf dem Sperrbildschirm „Datei gewählt — zum Importieren entsperren“ und importiert nach dem Entsperren genau diese Datei im
  Tab „Export & Sync“ (bei einem `.vault`-Backup folgt dort die Passphrase der Datei). Gilt für `.vault`-Backups und CSV. Der Verweis verfällt
  nach fünf Minuten ohne Entsperren. Die Sperr-Regel selbst bleibt unverändert (Auto-Sperre nach Inaktivität bzw. Wegzeit); nach dem Sperren
  ist kein Schlüssel im Speicher.
- Handbuch DE/EN (Erste Schritte, Backup & Sync) und README ergänzt.

## v3.5 — 2026-09-26

Rückfragen im eigenen Look und „Rückgängig“ nach dem Löschen. Am Tresor-Format, an der Verschlüsselung und an deinen Daten ändert sich nichts;
Android und Linux-Desktop bekommen dieselbe App.

- **Rückfragen erscheinen als eigener Dialog in der App, nicht mehr als Android-Systemdialog (intern gefunden beim Gerätetest der Schwester-App
  Alien Notes).** Der Systemdialog erbt den Screenshot-Schutz der App nicht: Ein Screenshot bei offener Rückfrage zeigte den Dialogtext, während
  die App dahinter schwarz blieb. Jetzt liegt jede Rückfrage (Buchung löschen, mögliches Duplikat, 2FA oder Fingerabdruck abschalten, lokale
  Daten löschen) im Fenster der App und wird wie alles andere geschützt. Jeder Dialog trägt seinen eigenen Knopf („Löschen“, „Trotzdem
  eintragen“, „Deaktivieren“, „Tresor löschen“) statt eines nackten „OK“; die Löschnachfrage nennt Datum, Richtung und Menge der Buchung.
  Escape oder ein Tipp daneben bricht ab, eine Sperre während der Frage lässt die Antwort verfallen.
- **„Rückgängig“ nach dem Löschen.** Der Hinweis „Gelöscht“ bekommt für sechs Sekunden einen Knopf, der die Buchung sofort an ihre Stelle
  zurückholt. Für „Lokale Daten löschen“ gibt es das bewusst nicht — dort bleibt die Rückfrage.
- Kleinigkeiten: Der Leuchtschein im Kopf der App ragt auf schmalen Bildschirmen nicht mehr über den Rand; die Meldung „automatisch gesperrt“
  bleibt nach der Sperre stehen.
- Linux-Desktop: keine Änderung an der Hülle, Bundle `sachwert-tresor-3.5-linux-x86_64.flatpak` mit derselben App.

## Hinweis — 2026-09-24: Web-Version eingestellt

Den Sachwert-Tresor gibt es ab sofort nur noch als App: Android (Zap Store, APK auf Codeberg) und Linux-Desktop (Flatpak). Die bisherige
Browser-Version unter `api.alien-investor.org/tresor/` ist abgeschaltet, weil nur die Apps die volle Härtung bieten (keine
Internet-Berechtigung, FLAG_SECURE, Flatpak ohne Netz). Wer dort noch Einträge hatte: Die Daten lagen nur im eigenen Browser, nie auf dem
Server. Bis zum 31.10.2026 lässt sich dort eine alte Version nur zum Exportieren öffnen; die `.vault`-Datei dann in der App importieren.
Am Tresor-Format und an der Verschlüsselung ändert sich nichts.

## v3.4 — 2026-09-23

Sicherheits-Korrektur beim Wiederherstellen. Am Tresor-Format, an der Verschlüsselung und an deinen Daten ändert sich nichts.

- **Ein Backup bringt die 2FA-Hürde nicht mehr mit.** Bisher konnte eine `.vault`-Datei beim Wiederherstellen nach Rückfrage die Aegis-Hürde
  aktivieren. Wer den Aegis-Eintrag nicht mehr hatte, sperrte sich damit aus dem eigenen Backup aus. Jetzt gilt die Hürde nur auf dem Gerät, auf
  dem du sie einrichtest — wie bei Alien Pass. Der Import führt Buchungen und Preisstände zusammen und lässt 2FA unverändert. Ein Backup bleibt
  damit immer der Notausgang: neu einrichten, importieren, kein Code nötig. Wer denselben Aegis-Eintrag bisher per Backup auf ein zweites Gerät
  gebracht hat, richtet 2FA dort künftig getrennt ein.
- Einstellungen und Handbuch sagen das jetzt ausdrücklich („gilt nur auf diesem Gerät — Backups tragen sie nicht mit“).
- Linux-Desktop: keine Änderung an der Hülle, Bundle `sachwert-tresor-3.4-linux-x86_64.flatpak` mit derselben App.

## v3.3 — 2026-09-23

Der Sachwert-Tresor gibt es jetzt auch für den **Linux-Desktop** — derselbe Code wie im Browser und in der Android-App, verpackt mit Electron
als Flatpak (x86_64, Muster Alien Pass v1.8). Am Tresor-Format, an der Verschlüsselung und an deinen Daten ändert sich nichts; Backups
laufen zwischen Handy, Browser und Desktop in beide Richtungen.

- **Linux-Desktop (Flatpak) ohne Netz und ohne Dateizugriff.** Das Flatpak hat keine Netzwerk-Berechtigung und keinen Zugriff auf deine
  Dateien — nachprüfbar mit `flatpak info --show-permissions org.alieninvestor.tresor`. Backup, Import, CSV-Export und Nachlass-Anhang laufen
  über den Dateidialog des Systems, der nur die gewählte Datei freigibt. Der Tresor liegt als Datei (Rechte 600) unter
  `~/.var/app/org.alieninvestor.tresor/data/`, atomar geschrieben. Die Hülle ist gehärtet wie bei Alien Pass: Chromium-Sandbox im Flatpak-Käfig,
  Renderer ohne Node, Electron-Fuses, keine Fernsteuerung, keine DevTools, kein Menü; toter Proxy und Anfrage-Filter als zweite Netzschicht.
- **Nachlass-Anhang als PDF** (nur Desktop): Statt Drucken speichert die Desktop-Fassung das Blatt über den Speichern-Dialog als PDF —
  im Käfig gibt es keinen Drucker. Klartext, danach löschen.
- **Zwischenablage am Desktop:** Der kopierte 2FA-Schlüssel ist für KDE als Passwort markiert (Klipper übernimmt ihn nicht in den Verlauf) und
  wird beim Sperren und Beenden gelöscht. Mit der Maus markierter Text wird bewusst nicht überwacht (anders als in Alien Pass): der Tresor
  zeigt keine Passwörter.
- **Sperren am Desktop:** Strg+L sperrt sofort. Minimieren gilt als Hintergrund, ein Fensterwechsel leert nur getippte Passphrasen. Bei
  Bildschirmsperre und Ruhezustand sperrt die App nicht von selbst (im Flatpak erfährt sie davon nichts) — Systemsperre plus kurze
  Inaktivitäts-Sperre nutzen. Kein Fingerabdruck, kein Schutz vor Bildschirmfotos, die Browser-Engine liefert die App selbst mit.
- **Verteilung:** Bundle + `SHA256SUMS` + `SHA256SUMS.asc` im Codeberg-Release, GPG-signierte Prüfsumme mit dem Release-Schlüssel von
  Alien Investor (`100F 9E25 BFAE A807 DBC3 57D7 50C0 D785 83BF CB81`, `alien-investor-release-key.asc` im Repo und auf alien-investor.org).
  Nicht auf Flathub, Update = deinstallieren + neu installieren (Daten bleiben). Anleitung im README.
- **Browser und Android:** Handbuch um den Desktop-Abschnitt ergänzt (nur in der Desktop-Fassung sichtbar); Speichern-Fehler nennt jetzt
  auch „Datei nicht schreibbar“. Sonst unverändert.
- **Taskleiste:** Das Fenster trägt ein eigenes Icon und ist dem Starter zugeordnet (Alien Pass v1.8 zeigt dort noch ein Standard-Icon; Korrektur folgt).
- Intern: Weiche `DESK` in `app.js` (Tresor-Zugriff nur über `vaultGet/vaultSet/vaultDel`, Hintergrund über `onHidden/onShown`), Hülle in
  `desktop/` (Klartext, auditierbar), Suiten `verify-desk.mjs` (Stub-Brücke) und `verify-desktop.mjs` (echte Hülle).

## v3.2 — 2026-09-23

Pflege-Update für den Fingerabdruck der Android-App (Wartungsstand aus Alien Pass v1.8 übernommen). Am Tresor-Format,
an der Verschlüsselung und an deinen Daten ändert sich nichts. Die Web-Version bekommt nur die neuen Handbuch-Texte.

- **Android: Schalter „Auch nach einem Neustart des Handys mit Fingerabdruck entsperren“** (ab Werk aus). Bisher verlangte die App nach jedem
  Neustart einmal die Passphrase — GrapheneOS startet ab Werk nach 18 Stunden Sperre von selbst neu, wer den Zähler kürzer stellt, tippte sie
  entsprechend oft. Der Haken lässt sich nur beim Aktivieren des Fingerabdrucks setzen; die Wahl steckt im Fingerabdruck-Slot selbst, ist dort
  mitauthentisiert und nur durch Deaktivieren und erneutes Aktivieren änderbar. Unverändert: Passphrase nach einem Passphrase-Wechsel, Warnung
  bei neuem Fingerabdruck im System, „Jetzt sperren“ als Riegel. Die Einstellungen und das Handbuch erklären, wovor der Neustart-Zwang schützt
  und was der Haken davon aufgibt.
  **Nach dem Update** verlangt die App einmal die Passphrase, als wäre das Handy neu gestartet worden, und richtet den Fingerabdruck danach
  von selbst wieder ein: Die Neustart-Erkennung nutzt jetzt den Boot-Zähler von Android statt der Kernel-Kennung, die nicht auf jedem Gerät
  lesbar ist. Ein bestehender Slot passt darum einmalig nicht mehr.
- **Fingerabdruck prüft die Tresordatei vollständiger (intern gefunden, niedrig).** Der Fingerabdruck-Slot ist an den Passphrase-Slot der Datei
  gebunden; bisher deckte der Abgleich nur den verschlüsselten Teil, nicht den Zufallswert daneben. Eine dort veränderte Datei konnte per
  Fingerabdruck still geöffnet und beim nächsten Speichern so zurückgeschrieben werden, bis die Passphrase nicht mehr passte. Jetzt meldet die App
  „Datei geändert“. Das braucht Zugriff auf die App-Daten des Handys — ein Backup von davor stellt alles wieder her. Bestehende Slots laufen weiter.
- **Android: eine von Hand veränderte Fingerabdruck-Slot-Datei** meldet sich als Manipulation mit bleibender Warnung statt als „Sensor
  vorübergehend nicht verfügbar“.
- Kästchen im Neon-Look aus dem Design-Kit (bisher gab es im Tresor keins).
- Intern: Testbatterie um den Schalter, die vollständigere Datei-Prüfung und die Manipulationsmeldung erweitert; der CSV-Import-Test liest jetzt
  eine eingecheckte Demo-Datei. Die Änderungen sind durch das interne Security-Audit run-8 von Alien Pass geprüft, der Tresor übernimmt sie
  wortgleich.

## v3.1.1 — 2026-09-21

Reine Darstellungskorrektur. Am Tresor-Format, an der Verschlüsselung und an deinen Daten ändert sich nichts.

- **Passwortfeld bleibt dunkel, wenn ein Passwortmanager es ausfüllt.** Füllte ein Passwortmanager
  (z.B. Proton Pass) die Passphrase per Autofill ein, legte das System ein helles Feld darüber. Das Feld
  behält jetzt Hintergrund und Schriftfarbe der gewählten Darstellung.

## v3.1 — 2026-09-20

Kleines Pflege-Update aus dem Praxistest. Am Tresor-Format und an der Verschlüsselung ändert sich nichts.

- **Verlauf: kein versehentliches Markieren mehr.** Wer mit dem Finger über die Grafik fuhr, löste die
  Textauswahl des Systems aus (Kopieren/Alles auswählen). Die Grafik ist jetzt davon ausgenommen,
  waagerechtes Wischen bewegt nur noch den Tooltip, senkrechtes Scrollen bleibt wie gewohnt.
- **Verlauf: Legende unter der Grafik.** Im Reiter „Netto investiert“ stehen zwei Linien: durchgezogen
  der **Wert** aus deinen selbst gepflegten Preisen, gestrichelt dein **Einstand**. Die Legende erscheint,
  sobald beide Linien da sind. Die Wertlinie beginnt erst am Tag deines ersten Preisstands.
- **Verlauf: Wertlinie liegt obenauf.** Liegen Wert und Einstand fast gleichauf, verschwand die Wertlinie
  bisher unter den Strichen des Einstands.
- **Nachlass-Blatt: klarerer Verwahrhinweis.** Kopf und Warnhinweise sagen jetzt „getrennt von
  Existenzhinweis **und Zugangsanleitung** verwahren“ (vorher nur „getrennt vom Existenzhinweis“).

## v3.0 — 2026-09-19

> **Vor dem Update ein Backup exportieren** (Export & Sync → Backup erstellen). Beim ersten
> Entsperren nach dem Update stellt der Tresor seine Verschlüsselung um — abgesichert, aber eine
> Einwegtür: Ältere App-Versionen können den umgestellten Tresor danach nicht mehr öffnen.
> Alte `.vault`-Backups bleiben in v3.0 dauerhaft importierbar.

Stärkere Verschlüsselung, Fingerabdruck-Entsperren, Fehlversuchs-Bremse:

- **Argon2id statt PBKDF2.** Der Schlüssel wird jetzt mit Argon2id aus der Passphrase abgeleitet
  (64 MiB Speicher, 3 Durchgänge). Jeder Rateversuch kostet damit Arbeitsspeicher, was Durchprobieren
  auf Grafikkarten und Spezialchips deutlich teurer macht. Argon2id stammt aus der quelloffenen
  Bibliothek hash-wasm (MIT, 4.12.0), fest eingebunden und beim Build per SHA-256 geprüft.
- **Neues Dateiformat mit Datenschlüssel.** Die Daten verschlüsselt ein zufälliger Datenschlüssel,
  die Passphrase schützt nur diesen. Ein Passphrase-Wechsel erneuert beide.
- **Automatische Umstellung.** Ein Tresor aus einer älteren Version wird beim ersten Entsperren
  umgestellt (bei aktiver 2FA erst nach dem Code). Geschrieben wird erst, nachdem die neue Datei zur
  Probe entschlüsselt wurde; bis zum nächsten Entsperren bleibt, wenn der Speicher reicht, eine Sicherungskopie des alten Stands.
  Danach empfiehlt die Übersicht ein frisches Backup im neuen Format.
- **Fingerabdruck-Entsperren** (nur Android-App, optional, in den Einstellungen). Bequem, aber
  erzwingbar und kein zusätzlicher Faktor. Die Passphrase wird wieder verlangt nach jedem Neustart,
  nach einem Passphrase-Wechsel (dann ist der Fingerabdruck aus), nach „Jetzt sperren“ und sobald in
  Android ein neuer Fingerabdruck registriert wird — dann schaltet die App den Fingerabdruck ab und
  zeigt eine Warnung, bis du sie gelesen hast.
- **Fehlversuchs-Bremse.** Ab dem 3. falschen Versuch (Passphrase oder 2FA-Code) wächst eine
  Wartezeit bis 30 Sekunden, auch über einen Neustart der App hinweg.
- **Einzige System-Berechtigung ist jetzt `USE_BIOMETRIC`** (dazu `USE_FINGERPRINT`, von der App auf
  Android bis 8.1 beschränkt). Weiterhin **keine INTERNET-Berechtigung**. Neu: Tresor-Daten werden
  auch beim Handywechsel nicht mitkopiert. Der Build prüft die fertige APK und bricht bei jeder
  anderen Berechtigung ab.
- Verständlichere Fehlermeldungen: eine kaputte oder fremde Datei heißt jetzt „keine gültige
  Tresor-Datei“ statt „falsche Passphrase“; reicht der Speicher für Argon2id nicht, sagt die App das.
- Nach einem Fehlversuch oder beim Wechsel in den Hintergrund bleibt keine getippte Passphrase mehr
  im Eingabefeld stehen.

Geprüft durch zwei interne Security-Audits (davon eines über die gesamte Version) und Gerätetests
auf GrapheneOS.

## v2.12 — 2026-09-19

Vermögensentwicklung im Verlauf-Tab deutlich ausgebaut:

- **Wertlinie neben der Einstandslinie.** Sobald du in der Übersicht Preise pflegst, merkt sich der
  Tresor jede Änderung mit Datum (ein Stand je Tag) und zeichnet daraus den Wert deines Bestands
  über die Zeit — bewertet wird jeder Tag mit dem letzten Preis, den du davor eingetragen hast.
  Die Einstandslinie läuft gestrichelt daneben. **Weiterhin keine Netzabfrage**: die App holt sich
  keinen Kurs, die Kurve ist so dicht wie deine eigene Pflege, und vor deinem ersten Preisstand gibt
  es bewusst keine Wertlinie statt erfundener Zahlen.
- **Zeitraum-Umschalter** YTD · 1J · 3J · 5J · MAX. Der erste Punkt eines Fensters ist der Stand zu
  dessen Beginn, nicht die erste Buchung darin. Zeiträume ohne genug Daten sind ausgegraut.
- **Tooltip beim Antippen** mit Datum, Wert, Einstand und Differenz; auf der Karte oben zusätzlich
  Wert heute samt Gewinn/Verlust absolut und in Prozent.
- Preisstände werden beim Import einer `.vault` zusammengeführt (dein eigener Stand gewinnt), damit
  die Wertlinie einen Gerätewechsel überlebt.
- Nach dem ersten Preisstand sagt der Tresor ehrlich, dass die Wertlinie erst mit dem nächsten
  geänderten Preis entsteht, statt eine Linie anzukündigen, die noch nicht gezeichnet werden kann.
- Wer den Tresor aktualisiert, dessen bereits gepflegte Preise werden beim ersten Entsperren als
  Stand des heutigen Tages übernommen — sonst stünde im Verlauf „trage Preise ein", obwohl welche
  eingetragen sind. Die Hinweise sagen jetzt außerdem dazu, dass die sichtbare Linie der Einstand
  ist und der Wert als zweite Linie dazukommt.

Datenformat additiv erweitert (`priceHistory`), Verschlüsselung und Exporte unverändert. Ältere
Tresore öffnen wie bisher, ohne Migration.

**Sicherheitsrelevante Korrekturen aus dem Audit zu dieser Version:**

- **Sperren räumt jetzt auch die Overlays weg.** Bisher blieb ein geöffneter Nachlass-Anhang nach dem
  Sperren auf dem Schirm stehen — samt Netto-Beständen und dem Vermerk „Klasse B – vertraulich". Weil
  das Druck-CSS beim Drucken alles außer diesem Blatt ausblendet, ließ es sich am gesperrten Tresor
  vorbei sogar ausdrucken. Auslöser war der Normalfall, für den es die Auto-Sperre gibt: Blatt offen,
  Gerät weggelegt. Mit dem Sperren verschwinden jetzt Blatt, Fassungsnummer, Hilfe-Overlay und die
  eingetragenen Preise aus dem Fenster; im gesperrten Zustand ist nichts mehr druckbar.
- **Preisstände werden auf Plausibilität geprüft.** Ein Datum musste bisher nur die Form `JJJJ-MM-TT`
  haben — `9999-99-99` kam durch und zog unbrauchbare Werte durch den ganzen Verlauf, ein Datum in der
  Zukunft blieb für immer der letzte Punkt der Wertlinie und war über die Oberfläche nicht mehr zu
  entfernen. Beide Wege sind dicht: beim Eintragen (falsch gehende Geräteuhr), beim Import und beim
  Anzeigen — Letzteres heilt auch Tresore, in denen schon ein solcher Stand liegt.
- **Der Verlauf stürzt nicht mehr ab, wenn Preise ohne Buchungen gepflegt werden.** Wer zuerst Kurse
  einträgt und erst später bucht, bekam beim Öffnen des Verlaufs eine leere Fläche statt des Charts,
  dauerhaft bis zur ersten Buchung.
- **Ein gescheitertes Speichern beim `.vault`-Import wird zurückgerollt.** Bisher blieben die fremden
  Buchungen im Speicher stehen, während die App „Import fehlgeschlagen (falsche Passphrase oder
  Datei?)" meldete — die nächste beliebige Aktion hätte sie dauerhaft festgeschrieben. Jetzt wird
  zurückgerollt und der Speicherfehler beim Namen genannt.

## v2.11 — 2026-09-16

Auge im Passwortfeld (wie Alien Pass v1.5.1): Statt des Kästchens „Passphrase anzeigen“ (weiß mit blauem Haken im Android-Standard) sitzt jetzt rechts in jedem Passphrase-Feld ein Auge — beim Einrichten, Entsperren, Backup-Import und Passphrase-Wechsel. Jedes Auge zeigt nur sein eigenes Feld, Tastatur und Cursor bleiben beim Antippen im Feld. Neu: Beim Sperren gehen alle Felder wieder zu, bisher blieb ein angehaktes Kästchen stehen.

Nur Oberfläche — Datenformat, Verschlüsselung und Export sind unverändert.

## v2.10 — 2026-09-16

Eigene Auswahlfelder im Neon-Look (wie Alien Pass v1.5): Währung, KYC, Stückelung, Form, Einheit und Auto-Sperre klappten in der App als graue Android-Systemliste auf, die sich nicht gestalten lässt. Jetzt öffnet sich darunter ein eigenes Menü im Stil der App, die aktuelle Auswahl ist markiert. Schließen per Auswahl, Klick daneben oder Escape. Beim Sperren werden offene Menüs geschlossen.

Technisch bleibt das native Auswahlfeld unsichtbar als Wertspeicher erhalten — Erfassen, Bearbeiten, Export und das Datenformat sind unverändert. Das Datumsfeld öffnet weiter den Datumsdialog des Systems.

## v2.9.1 — 2026-09-13

Wartungsrelease, Robustheit beim Speichern (Querfund aus dem Sicherheitsaudit des Ausgaben-Trackers). Das Speichern merkt sich jetzt Schlüssel, Salt und Tresor-Stand vor dem Verschlüsseln und prüft sie danach:
- Wird der Tresor während des Verschlüsselns gesperrt, schreibt die App nichts. Vorher hätte sie einen Blob mit leerem Salt speichern können, der sich nicht mehr entschlüsseln lässt.
- Wird die Passphrase währenddessen geändert, bleibt der neu verschlüsselte Stand erhalten. Der ältere Schreibvorgang überschreibt ihn nicht mehr mit dem alten Schlüssel, sondern verschlüsselt mit dem neuen neu.
- Passphrase ändern: Salt und Schlüssel werden erst nach der Schlüsselableitung gemeinsam getauscht. Vorher konnte eine Einstellungsänderung während der Ableitung (einige Sekunden) einen Blob aus altem Schlüssel und neuem Salt speichern. Wird der Tresor währenddessen gesperrt, bricht der Wechsel ab, und schlägt das Speichern fehl, gilt weiter die alte Passphrase.
- Nach dem Sperren rollen Erfassen, Löschen und CSV-Import keine Einträge mehr im Arbeitsspeicher zurück (dort liegt dann ein anderer oder gar kein Tresor).

Mit der aktuellen Verschlüsselung war der Fall praktisch nicht erreichbar, trotzdem jetzt abgesichert. Kein neues Feature, keine Datenformat-Änderung.

## v2.9 — 2026-09-13

Versionsnummer sichtbar: Ganz unten in den Einstellungen steht jetzt „Sachwert-Tresor v2.9 · AES-256-GCM · PBKDF2-SHA256 (600k)" — einheitlich mit Alien Pass. Die Nummer kommt aus der Datei `VERSION` (Build setzt sie, Roundtrip-Test prüft den Abgleich).

## v2.8 — 2026-08-28

Nachlass-Anhang in der App: Der Teilen-Dialog bekam neben der `.txt`-Datei nur den Kurztext „Sachwert-Tresor Backup" mit — Drucker-Apps nehmen den Text statt der Datei und druckten deshalb ein leeres Blatt mit diesem Titel (Autor-Fund). Jetzt wird der Blattinhalt selbst als Text mitgegeben: Drucker-Apps drucken das Blatt direkt, Datei-Ziele (Proton Drive, Dateien) erhalten weiterhin die Datei. Hinweistext im Overlay entsprechend angepasst (DE/EN).

## v2.7 — 2026-08-28

Layout-Korrektur im Nachlass-Anhang (nur CSS): Die Zeile „Quelle" und andere lange Werte brachen im Blatt nicht um und liefen auf schmalen Bildschirmen aus dem Rahmen (die allgemeine Tabellenregel `nowrap` galt auch dort). Werte und Listenpunkte brechen jetzt innerhalb der Box um, die Beschriftungsspalte hat eine feste Breite.

## v2.6 — 2026-08-28

Neu: **Nachlass-Anhang** (Export & Sync). Ein Blatt mit den aktuellen Netto-Beständen für das Erben-Paket, im Aufbau des Nachlassplaners (alien-investor.org/nachlassplaner.html):
- Bitcoin netto in BTC und Sats, Gold und Silber als Netto-Feingewicht (g und oz) plus Stückelung (Stückzahl × Gewicht je Stück, Form, Feinheit), abgeleitet aus Käufen minus Verkäufen und Entnahmen.
- Kopf mit Fassungsnummer, Datum, „Ersetzt Fassung vom", Vernichtungsvermerk und Hinweisen in Erben-Sprache. Klasse B (vertraulich), getrennt vom Existenzhinweis zu verwahren.
- **Nur Mengen.** Keine Preise, keine Händler, keine Standorte: Der Nachlassplaner bleibt absichtlich blind für Beträge, dieses Blatt liegt ihm als Anlage bei. Orte gehören handschriftlich in den Planer.
- Ausgabe als Druck (Desktop, schwarz auf weiß, A4) oder als `.txt`-Datei (Handy, transient über „Teilen"). Die zuletzt benutzte Fassungsnummer merkt sich der Tresor.
- Zweisprachig (DE/EN), keine neuen Datenfelder, kein Netz.

## v2.5 — 2026-08-15

Layout-Korrekturen auf schmalen Bildschirmen (nur CSS, keine Funktionsänderung):
- **Kopfzeile:** Der Schriftzug „Sachwert-Tresor" lief auf Handy-Breiten unter den Sprach- und den Hilfe-Button. Er hält jetzt Abstand zu beiden Eckbuttons und passt unter 520 px einzeilig dazwischen; die Tagline rutscht nicht mehr in die Buttonzeile.
- **Karten-Texte:** Lange Datei- und Spaltennamen (`manual_buys.csv`, `date,btc_amount,eur_amount,note,kyc`) hatten keine Umbruchstelle und ragten aus der Karte heraus — betraf vor allem „Export & Sync" auf Englisch. Absätze, Listen und `code`-Stellen brechen jetzt innerhalb der Box um.

## v2.4 — 2026-08-14

Security-Audit run-2 Fixes (gap-fokussiert; run-1-Fixes re-validiert):
- **KDF-Agilität repariert:** `persist()` schrieb hart `blob.iter=ITER`, obwohl die Leseseite `blob.iter` honoriert — hätte bei einem künftigen ITER-Anstieg bestehende Tresore beim ersten Speichern unentschlüsselbar gemacht. Jetzt wird `KEY_ITER` (der echte Iterationswert des Schlüssels) mitgeführt und geschrieben; Lese-/Schreibpfad symmetrisch.
- **Import-DoS geschlossen:** `deriveKey` begrenzt die honorierte Iterationszahl (`clampIter`, 1…10 Mio, sonst ITER) — eine fremde `.vault` kann keine unbegrenzte PBKDF2-Rechenlast mehr erzwingen.
- **CSV-Import Rollback:** schlägt `persist()` fehl (Speicher voll), werden die neu importierten Zeilen aus dem RAM zurückgerollt (wie bei Einzeleintrag/Löschen) — keine Anzeige/Speicher-Divergenz mehr.
- **Native-Exporte gehärtet:** entschlüsselte CSV-Exporte und das 2FA-QR landen jetzt im app-internen `CACHE` (nicht world-readable) und werden nur transient geteilt, statt dauerhaft im öffentlichen `Documents`-Ordner. Verschlüsseltes `.vault`-Backup bleibt in `Documents`.
- **Build-Härtung robuster:** `patch-hardening.mjs` prüft die Manifest-Invarianten (allowBackup=false, kein INTERNET) jetzt unbedingt und bricht den Build bei Drift ab.

## v2.3 — 2026-08-14

Sicherheits-Audit-Fixes (Cloudflare security-audit Skill, run-1):
- **CSV-Formel-Injection behoben:** Das `form`-Feld wurde als einziges Freitextfeld im Edelmetall-Export roh geschrieben — jetzt durch `csvCell()` neutralisiert. `csvCell()` fängt zusätzlich führendes `-`, TAB und CR ab (waren Lücken).
- **2FA-Import abgesichert:** Eine importierte `.vault` kann 2FA nur noch nach ausdrücklicher Bestätigung aktivieren (verhindert Aussperren durch ein fremdes Aegis-Secret); die Übernahme wird in der Meldung angezeigt.
- **Passphrase-Mindestlänge 8 → 12** bei Einrichtung und Passphrase-Wechsel (Meter-Schwellen angepasst). Bestehende Tresore entsperren unverändert.
- **KDF-Agilität:** `deriveKey` honoriert jetzt `blob.iter` — ITER kann künftig erhöht werden, ohne alte Tresore/Backups zu bricken (rückwärtskompatibel, alle vorhandenen Blobs tragen iter=600000).
- **Härtung:** `escapeHtml` escaped jetzt auch `'` (latenter Footgun bei künftigen innerHTML-Attributen).

## v2.2 — 2026-08-02

Sats-Anzeige + weitere Härtung: strengere CSP ohne Inline-Script, Backup-Erinnerung,
Passphrase-Stärke-Anzeige, Robustheits-Fixes.

- **Neu: BTC oder Sats.** Anzeige-Einheit in der Übersicht umschaltbar (wirkt auf
  Übersicht, Bestände und Verlauf-Chart); beim Erfassen eigener Umschalter, um die
  Menge wahlweise in BTC oder Sats einzugeben — getippte Werte werden beim
  Umschalten mitkonvertiert. Gespeichert und exportiert wird weiterhin BTC, das
  Steuertool-Format bleibt unverändert.
- **Härtung: kein Inline-Script mehr.** Der komplette App-Code liegt jetzt in
  `app.js`, alle Klick-Handler laufen über Event-Delegation — die CSP verbietet
  Inline-Script vollständig (`script-src 'self'`, ohne `unsafe-inline`).
  Zusammen mit `connect-src 'none'` bleibt damit auch eingeschleustem Markup
  keine Ausführungsfläche.
- **Neu: Backup-Erinnerung.** Die Übersicht warnt, wenn noch nie ein Backup
  erstellt wurde oder das letzte Backup älter als 14 Tage ist und seitdem neue
  Buchungen dazukamen. Rein lokal, keine Netzabfrage.
- **Neu: Passphrase-Stärke-Anzeige** beim Einrichten und Ändern — heuristisch
  (Länge/Wortfolge), nur Orientierung, kein Zwang.
- **Robuster:** Schlägt das Speichern fehl (z.B. Speicher voll), wird die
  Änderung auch in der Anzeige zurückgenommen (kein Auseinanderlaufen von
  Anzeige und Datenbestand); Tresore aus einer neueren App-Version lösen beim
  Entsperren einen Hinweis aus.

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
