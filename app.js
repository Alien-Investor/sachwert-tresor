"use strict";
/* Theme-Init vor dem ersten Render (app.js lädt synchron im <head>) */
(function(){var t=localStorage.getItem('alien-theme');if(t==='soft')document.documentElement.setAttribute('data-theme','soft');
  if(window.AlienDesktop)document.documentElement.classList.add('desk');})();   // Desktop-Hülle (Electron im Flatpak): schaltet .only-desk/.no-desk, vor dem ersten Render

/* ============================================================
   Sachwert-Tresor — alles client-side, kein Netz, kein Tracking
   ============================================================ */
const LS_KEY = 'ai-sachwert-vault';
const APP_VERSION = '3.6.1';   // Anzeige unten in den Einstellungen; muss VERSION_NAME entsprechen (build-www.sh setzt es aus VERSION, roundtrip-test.mjs prüft es)
const enc = new TextEncoder(), dec = new TextDecoder();

/* ============================ i18n ============================
   Deutsch = Original im HTML (data-i18n / -html / -ph). Englisch aus I18N.
   Dynamische JS-Strings (Toasts, Labels) aus T (beide Sprachen) via t(). */
const I18N = {
  "tagline":"Bitcoin · Gold · Silver — local & encrypted",
  "lbl.passphrase":"Passphrase","lbl.date":"Date","lbl.unit":"Unit",
  "setup.title":"Set up your vault",
  "setup.intro":"Choose a strong passphrase. It encrypts all data directly on this device (AES-256-GCM, key via Argon2id). <strong>There is no backdoor and no reset</strong> — if you forget the passphrase, the data is gone.",
  "setup.repeat":"Repeat passphrase","setup.ph1":"min. 12 characters, better a word sequence",
  "setup.create":"Create vault",
  "setup.aegishint":"You can enable Aegis 2FA after setup in the settings.",
  "lock.title":"Unlock vault","lock.unlock":"Unlock","dlg.cancel":"Cancel",
  "totp.title":"Second factor","totp.intro":"Enter the current 6-digit code from your <strong>Aegis 2FA manager</strong>.","totp.confirm":"Confirm",
  "btn.cancel":"Cancel",
  "tab.dash":"Overview","tab.add":"Add","tab.list":"Holdings","tab.verlauf":"History","tab.export":"Export & Sync","tab.settings":"Settings",
  "dash.valTitle":"Current value (manual, offline)",
  "dash.valIntro":"No price lookup over the network (OpSec). Enter current prices yourself — the value is computed locally.",
  "dash.metalUnit":"Precious-metal unit","dash.oz":"Ounce (oz)","dash.g":"Gram (g)","dash.btcUnit":"Bitcoin unit","dash.btcPrice":"BTC price €/BTC",
  "add.buy":"＋ Buy","add.sell":"－ Sell","add.withdraw":"↗ Withdrawal",
  "add.tBtc":"₿ Bitcoin","add.tGold":"Au Gold","add.tSilver":"Ag Silver",
  "add.kycNo":"noKYC (private / P2P / cash)","add.kycYes":"KYC broker (appears in tax report)",
  "add.count":"Count","add.denom":"Denomination (weight per piece)","add.denomOther":"Other…",
  "add.curLabel":"Currency",
  "add.eurRef":"EUR equivalent on transaction date (optional, from your statement — for the tax-tool export)",
  "add.form":"Form","add.formCoin":"Coin","add.formBar":"Bar","add.formOther":"Other",
  "add.weightPer":"Weight per piece","add.unitG":"Gram","add.unitOz":"Ounce (31.1035 g)","add.unitKg":"Kilogram",
  "add.fineness":"Fineness (‰)","add.dealer":"Dealer","add.dealerPh":"Coin dealer, Pro Aurum ...",
  "add.noteLabel":"Note (optional)","add.notePh":"Free text, e.g. mintage / trade ID",
  "list.title":"Holdings","list.fAll":"All","list.fBtc":"Bitcoin","list.fGold":"Gold","list.fSilver":"Silver",
  "list.empty":"No entries yet. Get started in the “Add” tab.",
  "verlauf.title":"Wealth development",
  "verlauf.intro":"Calculated from your entries — <strong>no network lookup</strong>. Shows your invested capital and, as soon as you keep prices, the value calculated from them over time.",
  "verlauf.sInvested":"Net invested","verlauf.sBtc":"Bitcoin","verlauf.sGold":"Gold","verlauf.sSilver":"Silver",
  "verlauf.empty":"At least two entries are needed to show a history.",
  "verlauf.r1":"1Y","verlauf.r3":"3Y","verlauf.r5":"5Y",
  "exp.taxTitle":"Tax-tool export (BTC)",
  "exp.taxIntro":"Generates CSVs in the format of your BTC tax tool — you just import them there. <code>manual_buys.csv</code> = all BTC buys (KYC flag), <code>manual_sales.csv</code> = all BTC sells (noKYC flag). Withdrawals are not sales and stay vault-internal. Entries in USD/CHF are only included if an EUR equivalent is recorded in the entry (edit entry) — the tax tool calculates in EUR.",
  "exp.metalTitle":"Precious-metal inventory (CSV)",
  "exp.metalIntro":"Gold & silver holdings as a table (date, form, fineness, weight, price, dealer).",
  "exp.importTitle":"CSV import (BTC buys / sells)",
  "exp.importIntro":"Loads many entries at once in vault format: <code>manual_buys.csv</code> (buys) or <code>manual_sales.csv</code> (sells) — header <code>date,btc_amount,eur_amount,note,kyc</code> or <code>…,no_kyc</code>. For your own lists just use this format (date, BTC amount, EUR). Duplicates are skipped automatically.",
  "exp.importBtn":"Import CSV",
  "exp.backupTitle":"Backup & Sync (encrypted vault file)",
  "exp.backupIntro":"The <code>.vault</code> file is fully encrypted. Put it in your <strong>Syncthing</strong> folder — it syncs P2P between desktop and GrapheneOS, without cloud. On the other device, load it via “Restore”. <strong>Importing merges</strong> (new entries are added, nothing is overwritten), and each device keeps its own passphrase.",
  "exp.backupWarn":"⚠ Without a backup your vault is lost if you reinstall the app or switch devices. Export regularly — ideally straight into the Syncthing folder.",
  "exp.backupCreate":"Create backup","exp.backupRestore":"Restore backup",
  "exp.importPassPrompt":"Enter the passphrase of the selected backup file:","exp.importPassPh":"Passphrase of the backup file","exp.importVaultBtn":"Import",
  "set.totpTitle":"Aegis 2FA (TOTP)",
  "set.totpOffIntro":"Enable a second factor. You enter the key <strong>once into Aegis</strong> (manually or via QR reader). The key is stored encrypted in the vault and adds protection on unlock.",
  "set.totpEnable":"Enable 2FA",
  "set.totpSetup1":"Add in <strong>Aegis</strong> — three ways, all possible without a camera:",
  "set.totpSetup2":"• <strong>With camera</strong> (e.g. desktop screen): scan the QR.<br>• <strong>Without camera, QR:</strong> save “QR as image” → in Aegis “+” → QR scan → import from gallery/image.<br>• <strong>Without camera, manual:</strong> “Copy key” → in Aegis “Add entry manually” → type <em>TOTP</em> → paste.",
  "set.copyKey":"Copy key","set.saveQR":"Save QR as image","set.copyQR":"Copy QR","set.otpauth":"otpauth link",
  "set.totpSetup3":"2) Aegis now shows a 6-digit code. Enter it to confirm:","set.activate":"Activate",
  "set.totpOnText":"2FA is active. On unlock, an Aegis code is additionally required. It applies only to this device — backups do not carry it.","set.totpDisable":"Disable 2FA",
  "set.cpTitle":"Change passphrase","set.cpCur":"Current passphrase","set.cpNew":"New passphrase","set.cpRepeat":"Repeat","set.cpBtn":"Change",
  "set.themeTitle":"Appearance","set.themeDark":"Black (Neon)","set.themeSoft":"Soft (Navy)",
  "set.secTitle":"Security","set.autolock":"Auto-lock after inactivity",
  "set.al0":"Off","set.al1":"1 minute","set.al5":"5 minutes","set.al15":"15 minutes","set.al30":"30 minutes",
  "lock.bio":"Unlock with fingerprint",
  "set.bioTitle":"Fingerprint unlock (Android)",
  "set.bioOffIntro":"Unlocks the vault with the device fingerprint instead of the passphrase. <strong>Honestly:</strong> a fingerprint is convenient, but it can be forced — at a border, or by someone holding your hand. Android binds the key to every strong biometric of the device: where a strong face unlock is enrolled (some stock Pixels; not on GrapheneOS), that opens the vault too, after a confirmation tap. The passphrase remains the real protection: it is required after every restart of the phone (as long as the box below is unticked), after a passphrase change and as soon as a new fingerprint is enrolled in the system. Technically, a random key held by the Android Keystore unlocks the data key; none of it ends up in backups.",
  "set.bioPass":"Passphrase to confirm",
  "set.bioEnable":"Enable fingerprint",
  "set.bioKeep":"Also unlock with the fingerprint after a restart of the phone (off by default)",
  "set.bioKeepNote":"By default the app asks for the passphrase once after every restart. That protects in exactly one case: someone knows or forces your device PIN and can force your finger — a restart then helps, because the app asks for the passphrase afterwards. GrapheneOS reboots by default once the phone stays locked for 18 hours in a row (adjustable from 10 minutes to 72 hours); whoever sets that counter short or often leaves the phone lying around types the passphrase accordingly often. With this box ticked the fingerprint keeps working across a restart. Unchanged: passphrase after a passphrase change, a warning when a new fingerprint is enrolled in the system, 'Lock now' as the bolt. Changeable only by disabling and enabling again.",
  "set.bioOnText":"Active. The fingerprint is enough to unlock — until the next restart, passphrase change or new fingerprint in the system. 'Lock now' is the deliberate bolt: the next start then requires the passphrase, afterwards the fingerprint works again. Applies to this device only.",
  "set.bioOnTextKeep":"Active, across a restart of the phone as well — chosen that way when enabling. The fingerprint is enough to unlock until the passphrase is changed or a new fingerprint is enrolled in the system. 'Lock now' is the deliberate bolt: the next start then requires the passphrase, afterwards the fingerprint works again. Changing this is only possible by disabling and enabling again. Applies to this device only.",
  "set.bioDisable":"Disable fingerprint",
  "set.lockNow":"Lock now","set.wipe":"Delete local data",
  "set.wipeNote":"“Delete local data” removes the vault only on <em>this</em> device (localStorage). Exported <code>.vault</code> files remain.",
  "set.wipeNoteDesk":"“Delete local data” removes the vault file only on <em>this</em> computer. Exported <code>.vault</code> files remain.",
  "foot.line1":"Alien Investor · Sachwert-Tresor · 100% local · no cloud · no telemetry",
  "foot.line2":"Encryption: AES-256-GCM · Argon2id (64 MiB) · WebCrypto · TOTP RFC 6238",
  "foot.donate":"Charge energy · Donate",
  "help.title":"Manual","help.closeX":"Close ✕","help.close":"Close",
  "exp.nlTitle":"Estate appendix (holdings sheet for the heir package)",
  "exp.nlIntro":"One sheet with your current <strong>net holdings</strong> (Bitcoin, gold, silver with denominations) laid out like the <strong>Estate Planner</strong>: version number, date, destruction note. Quantities only, no prices, no dealers, no locations. The planner is deliberately blind to amounts; this sheet is attached to it as a class B annex.",
  "exp.nlWarn":"⚠ This sheet states holdings in plain text. Keep it confidential, separate from the existence notice and the access guide. Destroy the old version.",
  "exp.nlOpen":"Create holdings sheet",
  "nl.title":"Estate appendix",
  "nl.warn":"⚠ Class B, confidential: this sheet states holdings in plain text. Keep it separate from the existence notice and the access guide, destroy the old version. Locations do not belong here; they go handwritten into the Estate Planner.",
  "nl.fassungLbl":"Version","nl.print":"Print","nl.printDesk":"Save as PDF","nl.save":"Save as file (.txt)",
  "nl.howtoDesk":"The sheet is saved as a PDF via the save dialog (plain text): print it, then delete the file. Raise the version number before every printout.",
  "nl.howto":"Desktop: print. Phone: the Share dialog opens; pick a printer app (it prints the sheet directly) or a file target, print there and delete the file afterwards. Raise the version number before every printout.",
  "help.h1":"What is the Sachwert-Tresor?",
  "help.p1":"A <strong>local, encrypted vault</strong> for your Bitcoin, gold and silver holdings. Runs fully <strong>offline</strong> — no cloud, no server, no telemetry, no price lookups over the network. Your data never leaves the device in plaintext.",
  "help.warn":"⚠ There is no reset and no backdoor. If you forget your passphrase, the data is irretrievably lost. Make regular backups.",
  "help.h2":"First steps",
  "help.l2":"<li><strong>Passphrase</strong> — it encrypts the entire vault. Remember it well, note it down safely.</li><li>Optional <strong>2FA</strong> (Aegis/TOTP) as a second hurdle: Settings → Enable 2FA.</li><li><strong>Auto-lock</strong> on inactivity is configurable in the settings. It also applies while the file picker is open — a file chosen there is not lost, the import continues after unlocking.</li>",
  "help.h3":"Adding entries",
  "help.l3":"<li><strong>Bitcoin:</strong> buy / sell / withdrawal — amount, paid (EUR, USD or CHF), source/destination, KYC flag. Enter the amount in <strong>BTC or sats</strong> (toggle above the field); the display unit is set in the overview.</li><li><strong>Gold/Silver:</strong> count × denomination (e.g. 5 × 1 oz), form (coin/bar), fineness, dealer.</li><li><strong>KYC flag:</strong> marks buys via a KYC broker — important for the clean separation from the tax tool.</li><li><strong>Withdrawal</strong> = transfer/spend without a sale: reduces holdings but is not a taxable sale.</li><li>Duplicates (same type + date + amount) are warned and marked with ⚠.</li>",
  "help.h4":"Overview & values",
  "help.p4":"Net holdings per asset class (buys − sells − withdrawals) plus invested cost. You enter current prices <strong>manually</strong> (deliberately no network lookup) → from this, current value and profit/loss are computed. The History tab shows wealth development.",
  "help.h5":"Backup & Sync (important!)",
  "help.p5desk":"Your holdings live encrypted in a file on <em>this</em> computer: <code>~/.var/app/org.alieninvestor.tresor/data/sachwert-tresor/vault.aisv</code>. It survives updates (uninstall + reinstall) and is lost only with “Delete local data” or <code>flatpak uninstall --delete-data</code>. Here too: <strong>without a <code>.vault</code> backup the holdings are irretrievably gone</strong>.",
  "help.p5":"Your holdings live encrypted in this device's local storage (localStorage) — in the <strong>app</strong> in protected app storage (survives restarts and updates, lost only on “Clear app data” or uninstall), in the <strong>browser</strong> in the browser profile (removed when you clear “cookies and site data” — not by clearing the cache alone). Either way: <strong>without a <code>.vault</code> backup the holdings are irretrievably gone</strong>. The app is significantly more persistent — recommended for long-term use.",
  "help.l5":"<li><strong>Create backup</strong> (Export & Sync) → encrypted <code>.vault</code> file. Put it in your Syncthing folder.</li><li><strong>Syncthing</strong> syncs the file P2P between your devices — without cloud.</li><li><strong>Restore backup</strong> on the other device → choose the file → enter the <strong>file's passphrase</strong> (the source device's, not necessarily the local one).</li><li><strong>Merge:</strong> the import <strong>merges</strong> (new entries are added, your local passphrase stays). Later edits and deletions do <em>not</em> sync — otherwise correct entries identically on both devices.</li><li><strong>If the app locks while the file picker is open</strong> (auto-lock), the chosen file is not lost: the lock screen shows “File chosen — unlock to import”, and after unlocking the import continues with exactly this file. Applies to <code>.vault</code> backups and CSV.</li>",
  "help.h6":"CSV import",
  "help.p6":"Export & Sync → Import CSV loads <code>manual_buys.csv</code> (buys) / <code>manual_sales.csv</code> (sells) in vault format. Duplicates are skipped — safe to import multiple times. <strong>Broker/exchange CSVs, by contrast, go directly into the BTC tax tool</strong> (it has its own broker parsers) — not here.",
  "help.h7":"Tax-tool export",
  "help.p7":"Export & Sync generates <code>manual_buys.csv</code> / <code>manual_sales.csv</code> exactly in the BTC tax tool format (KYC buys marked, noKYC separated) plus <code>edelmetalle.csv</code> for the metals. The tax tool calculates in EUR: entries in USD/CHF only make it into the export if an EUR equivalent from the transaction date is recorded in the entry (from your statement) — otherwise the export leaves them out and shows a warning.",
  "help.h8":"2FA and backups",
  "help.p8":"The 2FA hurdle applies <strong>only to this device</strong>. A backup never carries it along (since v3.4): restoring a <code>.vault</code> file merges entries and price history, but never switches 2FA on or off. Set up 2FA separately on every device you want it on. That way a backup is always the way out if Aegis is gone: reinstall, import the backup, no code required.",
  "help.p8b":"<strong>Perspective:</strong> The Aegis code is an additional hurdle when unlocking on this device — <em>not</em> a second encryption factor. The encryption itself is protected by the passphrase alone: anyone who obtains the vault data or a <code>.vault</code> file needs the passphrase (not the code). Choose it accordingly strong.",
  "help.h9":"Security",
  "help.l9":"<li>AES-256-GCM via native WebCrypto. The key is derived from your passphrase with <strong>Argon2id</strong> (64 MiB of memory, 3 passes): every guess costs memory, which makes brute-forcing on GPUs and specialised chips expensive. Argon2id comes from the open-source library hash-wasm (MIT), bundled and checked against a pinned SHA-256 at build time.</li><li>Vaults and <code>.vault</code> backups from versions before 3.0 keep opening. The vault on the device is switched over automatically on the first unlock.</li><li>No network requests, no trackers, no external CDNs. Everything offline. The Android app has no INTERNET permission; its only system permission is for the fingerprint.</li><li>After 3 wrong attempts a growing wait kicks in (up to 30 seconds) — a bolt against guessing on the device, not cryptographic protection.</li><li>The <code>.vault</code> file is encrypted — even if it ends up somewhere, nothing is readable without the passphrase.</li>",
  "help.hDesk":"Linux desktop (Flatpak)",
  "help.lDesk":"<li><strong>No network, enforced by the system.</strong> The Flatpak has no network permission and no access to your files. Backup, CSV export, estate sheet and import go through the system file dialog, which only grants the chosen file. Verifiable with <code>flatpak info --show-permissions org.alieninvestor.tresor</code>.</li><li><strong>Separate stores:</strong> desktop, phone app and browser do not know each other — sync via <code>.vault</code> backups (e.g. Syncthing); the same applies to a 2FA secret.</li><li><strong>Ctrl+L</strong> locks immediately. “Background” means minimised or hidden — switching windows does not lock, but it clears typed passphrases. On screen lock and suspend the app does not lock by itself: use the system lock plus a short inactivity lock.</li><li><strong>Clipboard:</strong> the copied 2FA key is marked as a password for KDE (Klipper keeps it out of its history) and is cleared on lock and on quit. Only the copy button sets that mark; Ctrl+C on selected text copies via Chromium without it and is not cleared. Text selected with the mouse is not tracked — under X11 every program can read clipboard and keyboard.</li><li><strong>Plain-text files:</strong> CSV exports and the estate sheet (<code>.txt</code> or PDF) are unencrypted — delete them after use. No fingerprint, no protection against screenshots. The app ships its browser engine (Electron) itself; security updates for it arrive with a new app version.</li>",
  "help.h10":"Fingerprint (Android app)",
  "help.p10":"In Settings you can switch on unlocking by fingerprint (confirmed with the passphrase). <strong>Honestly:</strong> it is convenient, but it can be forced, and it is no additional protection — just a second way to the same key. The passphrase is required again after every restart of the phone (as long as the box is unticked), after a passphrase change (fingerprint unlock is then off and must be re-enabled), after 'Lock now' and as soon as a new fingerprint is enrolled in Android. In that last case the app switches fingerprint unlock off and shows a warning — if that was not you, check the fingerprints in Android settings. The restart rule is program code, not a cryptographic guarantee. If Aegis 2FA is on, the code is still required after the fingerprint.",
  "help.p10b":"<strong>The 'across a restart' switch (off by default):</strong> when enabling, you can tick that the fingerprint keeps working across a restart. The restart rule protects in one case only: someone knows or forces your device PIN and can force your finger — a restart then helps, because the app asks for the passphrase afterwards. GrapheneOS reboots by default once the phone stays locked for 18 hours in a row (adjustable from 10 minutes to 72 hours); whoever sets that counter short or often leaves the phone lying around types the passphrase accordingly often. With the box ticked, only the system's device-PIN requirement remains after a restart; the app then asks for the passphrase only after a passphrase change, on a new fingerprint and after 'Lock now'. Changing this is only possible by disabling and enabling again. When in doubt: restart the phone, then only the passphrase counts (if the box is unticked)."
};
// Dynamische JS-Strings (beide Sprachen)
const T = {
  "pw.toggle":{de:"Anzeigen / verbergen",en:"Show / hide"},
  "msg.keyCopied":{de:"Schlüssel kopiert",en:"Key copied"},
  "msg.otpauthCopied":{de:"otpauth-Link kopiert",en:"otpauth link copied"},
  "add.titleBuy":{de:"Kauf erfassen",en:"Add buy"},
  "add.titleSell":{de:"Verkauf erfassen",en:"Add sell"},
  "add.titleWd":{de:"Entnahme erfassen",en:"Add withdrawal"},
  "add.titleEdit":{de:"Eintrag bearbeiten",en:"Edit entry"},
  "add.btnAdd":{de:"＋ Eintragen",en:"＋ Add"},
  "add.btnSave":{de:"Speichern",en:"Save"},
  "ov.now":{de:"jetzt",en:"now"},
  "ov.peak":{de:"Höchststand",en:"Peak"},
  "ov.datapoints":{de:"Datenpunkte",en:"data points"},
  "ov.datapoint":{de:"Datenpunkt",en:"data point"},
  "ov.value":{de:"Wert heute",en:"Value today"},
  "ov.invested":{de:"Einstand",en:"Cost basis"},
  "ov.diff":{de:"Differenz",en:"Difference"},
  "add.eurBuy":{de:"Bezahlt ({cur}, gesamt inkl. Gebühr)",en:"Paid ({cur}, total incl. fee)"},
  "add.eurSell":{de:"Erhalten ({cur}, netto)",en:"Received ({cur}, net)"},
  "add.amtBtc":{de:"Menge BTC",en:"BTC amount"},
  "add.amtSat":{de:"Menge Sats",en:"Sats amount"},
  "add.srcBuy":{de:"Quelle / Broker",en:"Source / broker"},
  "add.srcSell":{de:"Ziel / Käufer (optional)",en:"Destination / buyer (optional)"},
  "add.kycQ":{de:"KYC?",en:"KYC?"},
  "add.sellFrom":{de:"Verkauf aus welchem Bestand?",en:"Sell from which holdings?"},
  "price.gold":{de:"Gold €/",en:"Gold €/"},
  "price.silver":{de:"Silber €/",en:"Silver €/"},
  "stat.btc":{de:"Bitcoin (Bestand)",en:"Bitcoin (holdings)"},
  "stat.gold":{de:"Gold fein (Bestand)",en:"Gold fine (holdings)"},
  "stat.silver":{de:"Silber fein (Bestand)",en:"Silver fine (holdings)"},
  "stat.invested":{de:"Netto investiert",en:"Net invested"},
  "stat.investedSub":{de:"Buchungen",en:"entries"},
  "stat.realized":{de:"realisiert",en:"realized"},
  "stat.invShort":{de:"Investiert",en:"Invested"},
  "val.btcNow":{de:"Bitcoin aktuell",en:"Bitcoin now"},
  "val.goldNow":{de:"Gold aktuell",en:"Gold now"},
  "val.silverNow":{de:"Silber aktuell",en:"Silver now"},
  "val.totalNow":{de:"Gesamt aktuell",en:"Total now"},
  "val.vsInvested":{de:"ggü. netto investiert",en:"vs. net invested"},
  "col.date":{de:"Datum",en:"Date"},
  "col.type":{de:"Typ",en:"Type"},
  "col.dir":{de:"Vorgang",en:"Action"},
  "col.amount":{de:"Menge",en:"Amount"},
  "col.eur":{de:"Betrag",en:"Value"},
  "col.src":{de:"Quelle/Ziel",en:"Source/dest."},
  "col.actions":{de:"",en:""},
  "dir.buy":{de:"Kauf",en:"Buy"},
  "dir.sell":{de:"Verkauf",en:"Sell"},
  "dir.withdraw":{de:"Entnahme",en:"Withdrawal"},
  "toast.buyAdded":{de:"Kauf eingetragen",en:"Buy added"},
  "toast.sellAdded":{de:"Verkauf eingetragen",en:"Sell added"},
  "toast.wdAdded":{de:"Entnahme eingetragen",en:"Withdrawal added"},
  "toast.updated":{de:"Eintrag aktualisiert",en:"Entry updated"},
  "toast.deleted":{de:"Eintrag gelöscht",en:"Entry deleted"},
  "toast.saved":{de:"Gespeichert",en:"Saved"},
  "toast.exported":{de:"Exportiert",en:"Exported"},
  "toast.failed":{de:"Fehlgeschlagen",en:"Failed"},
  "err.dateMissing":{de:"Datum fehlt.",en:"Date is missing."},
  "err.eurInvalid":{de:"Gültigen Betrag eingeben.",en:"Enter a valid amount."},
  "val.noBaseHint":{de:"≈: {n} Fremdwährungs-Buchung(en) ohne EUR-Gegenwert fehlen in der EUR-Vergleichsbasis — Eintrag bearbeiten und EUR-Gegenwert ergänzen.",en:"≈: {n} foreign-currency entries without an EUR equivalent are missing from the EUR comparison base — edit the entry to add one."},
  "verlauf.priceHint":{de:"Wertlinie aus {n} selbst eingetragenen Preisständen seit {d} — keine Netzabfrage. Die Kurve ist so dicht, wie du Preise pflegst.",en:"Value line from {n} self-entered price points since {d} — no network lookup. The curve is as dense as your price keeping."},
  "verlauf.priceFirst":{de:"Die Linie zeigt deinen Einstand. Erster Preisstand gemerkt ({d}) — die zweite Linie mit dem Wert kommt dazu, sobald du einen geänderten Preis einträgst. Der Tresor rechnet nur mit deinen eigenen Ständen.",en:"The line shows your cost basis. First price point saved ({d}) — the second line with the value appears once you enter a changed price. The vault only uses your own entries."},
  "verlauf.priceNone":{de:"Die Linie zeigt deinen Einstand. Für eine zweite Linie mit dem Wert trage in der Übersicht Preise ein — jede Änderung merkt sich der Tresor mit Datum.",en:"The line shows your cost basis. For a second line with the value, enter prices in the overview — the vault remembers every change with its date."},
  "verlauf.priceMissing":{de:"{n} Bestand/Bestände ohne Preis fehlen in der Wertlinie.",en:"{n} holdings without a price are missing from the value line."},
  "verlauf.noBaseHint":{de:"{n} Fremdwährungs-Buchung(en) ohne EUR-Gegenwert nicht enthalten (Eintrag bearbeiten → EUR-Gegenwert ergänzen).",en:"{n} foreign-currency entries without an EUR equivalent are not included (edit the entry to add one)."},
  "exp.fxSkipped":{de:"{n} USD/CHF-Buchung(en) ohne EUR-Gegenwert nicht im Export enthalten — Eintrag bearbeiten und EUR-Gegenwert ergänzen.",en:"{n} USD/CHF entries without an EUR equivalent were left out — edit the entry and add the EUR value."},
  "err.btcMissing":{de:"BTC-Menge fehlt.",en:"BTC amount is missing."},
  "err.countMissing":{de:"Stückzahl fehlt (mind. 1).",en:"Count is missing (min. 1)."},
  "err.weightMissing":{de:"Gewicht je Stück fehlt.",en:"Weight per piece is missing."},
  "confirm.delete":{de:"Diesen Eintrag wirklich löschen?",en:"Really delete this entry?"},
  "confirm.wipe":{de:"Lokalen Tresor auf DIESEM Gerät löschen? Exportierte .vault-Dateien bleiben.",en:"Delete the local vault on THIS device? Exported .vault files remain."},
  // Knöpfe des Rückfrage-Dialogs (v3.5): je Frage ein eigener Knopf statt eines nackten „OK“
  "dlg.ok":{de:"OK",en:"OK"},"dlg.cancel":{de:"Abbrechen",en:"Cancel"},"dlg.delete":{de:"Löschen",en:"Delete"},"dlg.disable":{de:"Deaktivieren",en:"Disable"},
  "dlg.wipe":{de:"Tresor löschen",en:"Delete vault"},"dlg.addAnyway":{de:"Trotzdem eintragen",en:"Add anyway"},
  "toast.undo":{de:"Rückgängig",en:"Undo"},"toast.restored":{de:"Eintrag wiederhergestellt",en:"Entry restored"},"toast.undoGone":{de:"Der Eintrag ist bereits wieder da.",en:"The entry is already back."},
  "msg.merged":{de:"Zusammengeführt",en:"Merged"},
  "msg.entriesNew":{de:"neue Einträge",en:"new entries"},
  "msg.total":{de:"gesamt",en:"total"},
  "msg.passKept":{de:"Deine lokale Passphrase bleibt unverändert.",en:"Your local passphrase stays unchanged."},
  "msg.importBad":{de:"Import fehlgeschlagen (falsche Passphrase oder Datei?).",en:"Import failed (wrong passphrase or file?)."},
  "msg.notValidVault":{de:"Keine gültige .vault-Datei.",en:"Not a valid .vault file."},
  "msg.enterPass":{de:"Bitte Passphrase eingeben.",en:"Please enter a passphrase."},
  "msg.upToDate":{de:"Bereits aktuell",en:"Already up to date"},
  "add.kycBuyNo":{de:"noKYC (privat / P2P / Bargeld)",en:"noKYC (private / P2P / cash)"},
  "add.kycBuyYes":{de:"KYC-Broker (taucht im Finanzamt-Report auf)",en:"KYC broker (appears in tax report)"},
  "add.kycSellNo":{de:"noKYC-Bestand (nur interner Report)",en:"noKYC holdings (internal report only)"},
  "add.kycSellYes":{de:"KYC-Bestand (Finanzamt-Report)",en:"KYC holdings (tax report)"},
  "col.detail":{de:"Detail",en:"Detail"},
  "pill.nokycHold":{de:"noKYC-Bestand",en:"noKYC holdings"},
  "pill.kycHold":{de:"KYC-Bestand",en:"KYC holdings"},
  "pill.gold":{de:"Gold",en:"Gold"},"pill.silver":{de:"Silber",en:"Silver"},
  "pill.dupQ":{de:"Dublette?",en:"Duplicate?"},
  "pill.dupTitle":{de:"Gleicher Vorgang, Datum und Menge existiert mehrfach",en:"Same action, date and amount exists more than once"},
  "series.invested":{de:"Netto investiert",en:"Net invested"},
  "series.value":{de:"Wert",en:"Value"},
  "series.btc":{de:"Bitcoin-Bestand",en:"Bitcoin holdings"},
  "series.gold":{de:"Gold-Bestand",en:"Gold holdings"},
  "series.silver":{de:"Silber-Bestand",en:"Silver holdings"},
  "preview.totalPrefix":{de:"→ Gesamt: ",en:"→ Total: "},"preview.gross":{de:"brutto",en:"gross"},
  "dash.pricesHint":{de:"Trage oben Preise ein, um den aktuellen Wert zu sehen.",en:"Enter prices above to see the current value."},
  "toast.autolockPrefix":{de:"Auto-Lock: ",en:"Auto-lock: "},"toast.autolockOff":{de:"Auto-Lock aus",en:"Auto-lock off"},"unit.min":{de:"Min",en:"min"},
  "toast.passChanged":{de:"Passphrase geändert",en:"Passphrase changed"},
  "msg.importSaveFailed":{de:"Entschlüsselt, aber Speichern fehlgeschlagen — nichts übernommen. Speicher voll?",en:"Decrypted, but saving failed — nothing was imported. Storage full?"},
  "copy.manual":{de:"Manuell kopieren",en:"Copy manually"},
  "tip.edit":{de:"Bearbeiten",en:"Edit"},"tip.del":{de:"Löschen",en:"Delete"},
  "stat.investedLbl":{de:"Investiert",en:"Invested"},"stat.realizedLbl":{de:"Realisiert",en:"Realized"},
  "toast.autolocked":{de:"Automatisch gesperrt",en:"Automatically locked"},
  "toast.deletedShort":{de:"Gelöscht",en:"Deleted"},
  "exp.noBuys":{de:"Keine BTC-Käufe vorhanden.",en:"No BTC buys."},
  "exp.noSales":{de:"Keine BTC-Verkäufe vorhanden.",en:"No BTC sells."},
  "exp.noMetals":{de:"Keine Edelmetall-Buchungen vorhanden.",en:"No precious-metal entries."},
  "exp.savedShareSfx":{de:' gespeichert — über „Teilen" ablegen.',en:" saved — share it via the Share dialog."},
  "exp.vaultSavedNative":{de:' — über „Teilen" in deinen Syncthing-Ordner legen.',en:" — share it into your Syncthing folder."},
  "exp.vaultSavedWeb":{de:"Verschlüsselte Datei gespeichert. In den Syncthing-Ordner legen.",en:"Encrypted file saved. Put it in your Syncthing folder."},
  "exp.vaultSavedDesk":{de:"{n} gespeichert (verschlüsselt). In den Syncthing-Ordner legen.",en:"{n} saved (encrypted). Put it in your Syncthing folder."},
  "exp.savedDesk":{de:" gespeichert (Klartext — nach Gebrauch löschen).",en:" saved (plain text — delete it after use)."},
  "exp.backupSavedPre":{de:"Backup gespeichert (",en:"Backup saved ("},
  "nl.sheetTitle":{de:"Nachlass-Anhang – Bestandsliste",en:"Estate appendix – holdings sheet"},
  "nl.klasse":{de:"Klasse B – vertraulich – getrennt von Existenzhinweis und Zugangsanleitung verwahren",en:"Class B – confidential – keep separate from the existence notice and the access guide"},
  "nl.fassung":{de:"Fassung",en:"Version"},
  "nl.stand":{de:"Stand",en:"As of"},
  "nl.replaces":{de:"Ersetzt Fassung vom",en:"Replaces version dated"},
  "nl.source":{de:"Quelle",en:"Source"},
  "nl.sourceVal":{de:"Sachwert-Tresor (nur Mengen, keine Werte, keine Standorte)",en:"Sachwert-Tresor (quantities only, no values, no locations)"},
  "nl.netHold":{de:"Netto-Bestand",en:"Net holdings"},
  "nl.netFine":{de:"Netto-Feingewicht",en:"Net fine weight"},
  "nl.silver":{de:"Silber",en:"Silver"},
  "nl.denomHead":{de:"Stückelung (Stückzahl × Gewicht je Stück, Form, Feinheit):",en:"Denominations (count × weight per piece, form, fineness):"},
  "nl.noDenom":{de:"Keine Stückelung ableitbar (Buchungen ohne Stückzahl).",en:"No denominations derivable (entries without piece count)."},
  "nl.heirHead":{de:"Hinweise für den Erben",en:"Notes for the heir"},
  "nl.h1":{de:"Diese Liste ist eine Momentaufnahme zum angegebenen Stand, kein Nachweis. Maßgeblich ist, was an den Orten aus dem Nachlassplaner tatsächlich vorliegt.",en:"This list is a snapshot as of the stated date, not proof. What counts is what is actually found at the locations listed in the Estate Planner."},
  "nl.h2":{de:"Standorte, Geräte und Zugänge stehen absichtlich nicht auf diesem Blatt. Sie stehen handschriftlich im Nachlassplaner (Bögen Wallet-Inventar, Standorte, Lagerung).",en:"Locations, devices and access details are deliberately not on this sheet. They are handwritten in the Estate Planner (wallet inventory, locations, storage sheets)."},
  "nl.h3":{de:"Bitcoin: Der Bestand liegt in den Wallets aus dem Inventar. Erst lesen, dann handeln. Nichts verschieben, bevor die Wiederherstellung verstanden ist.",en:"Bitcoin: the holdings sit in the wallets from the inventory. Read first, act later. Move nothing before recovery is understood."},
  "nl.h4":{de:"Bewertung zum Stichtag (Tageskurs am Todestag) nimmt der Steuerberater vor. Anschaffungsdaten für die Steuer liegen im Tresor und im Steuertool-Export.",en:"Valuation as of the reference date (day of death) is done by the tax advisor. Acquisition data for tax purposes is in the vault and in the tax-tool export."},
  "nl.h5":{de:"Liegt eine neuere Fassung vor, gilt nur diese. Ältere Blätter vernichten.",en:"If a newer version exists, only that one applies. Destroy older sheets."},
  "nl.destroy":{de:"Alte Fassung vernichtet am (Datum, Unterschrift):",en:"Old version destroyed on (date, signature):"},
  "nl.savedWeb":{de:" gespeichert. Ausdrucken, danach die Datei löschen (Klartext).",en:" saved. Print it, then delete the file (plain text)."},
  "nl.pdfSaved":{de:" gespeichert (PDF). Ausdrucken, danach die Datei löschen (Klartext).",en:" saved (PDF). Print it, then delete the file (plain text)."},
  "toast.qrDesk":{de:"Am Desktop: QR mit der Aegis-Kamera scannen oder Schlüssel kopieren",en:"On the desktop: scan the QR with the Aegis camera or copy the key"},
  "csv.resultPre":{de:"CSV-Import",en:"CSV import"},"csv.new":{de:"neu",en:"new"},"csv.dupsSkipped":{de:"Dubletten übersprungen",en:"duplicates skipped"},"csv.badRows":{de:"fehlerhafte Zeilen",en:"invalid rows"},
  "lbl.buys":{de:"Käufe",en:"Buys"},"lbl.sells":{de:"Verkäufe",en:"Sells"},
  "err.cpShort":{de:"Neue Passphrase: mind. 12 Zeichen.",en:"New passphrase: min. 12 characters."},
  "err.cpMismatch":{de:"Neue Passphrasen stimmen nicht überein.",en:"New passphrases do not match."},
  "err.cpWrong":{de:"Aktuelle Passphrase falsch.",en:"Current passphrase is wrong."},
  "toast.qrSaved":{de:"QR als Bild gespeichert",en:"QR saved as image"},"toast.qrSaveFail":{de:"QR-Speichern fehlgeschlagen",en:"Saving QR failed"},
  "toast.qrCopied":{de:"QR ins Clipboard kopiert",en:"QR copied to clipboard"},"toast.copyFail":{de:"Kopieren fehlgeschlagen",en:"Copy failed"},
  "toast.noQr":{de:"Kein QR vorhanden",en:"No QR available"},"toast.clipUnavail":{de:"Clipboard nicht verfügbar — nutze „QR als Bild“",en:"Clipboard unavailable — use “Save QR as image”"},
  "err.setupShort":{de:"Passphrase zu kurz (mind. 12 Zeichen).",en:"Passphrase too short (min. 12 characters)."},
  "err.setupMismatch":{de:"Passphrasen stimmen nicht überein.",en:"Passphrases do not match."},
  "err.wrongPass":{de:"Falsche Passphrase.",en:"Wrong passphrase."},
  "err.fileFormat":{de:"Keine gültige Tresor-Datei.",en:"Not a valid vault file."},
  "err.fileNewer":{de:"Diese Datei stammt aus einer neueren App-Version. Bitte die App aktualisieren.",en:"This file comes from a newer app version. Please update the app."},
  "err.fileBounds":{de:"Die Schlüsselparameter dieser Datei liegen außerhalb der erlaubten Grenzen.",en:"The key parameters of this file are outside the permitted limits."},
  "err.fileLarge":{de:"Die Datei ist zu groß.",en:"The file is too large."},
  "err.tooMany":{de:"Zu viele Zeilen oder Buchungen (höchstens 40.000 Zeilen, 10.000 Buchungen).",en:"Too many rows or entries (at most 40,000 rows, 10,000 entries)."},
  "msg.readErr":{de:"Datei konnte nicht gelesen werden — bitte erneut wählen.",en:"File could not be read — please choose it again."},
  "err.noArgon2":{de:"Die Verschlüsselung (Argon2id) lässt sich in diesem Browser nicht starten. Am Tresor wurde nichts verändert.",en:"The encryption (Argon2id) cannot start in this browser. Nothing in the vault was changed."},
  "bio.promptTitle":{de:"Sachwert-Tresor",en:"Sachwert-Tresor"},
  "bio.promptUnlock":{de:"Tresor entsperren",en:"Unlock vault"},
  "bio.promptEnroll":{de:"Fingerabdruck-Entsperren aktivieren",en:"Enable fingerprint unlock"},
  "bio.promptRearm":{de:"Nach dem Neustart: Fingerabdruck neu bestätigen",en:"After restart: confirm fingerprint again"},
  "bio.usePass":{de:"Passphrase",en:"Passphrase"},
  "bio.afterReboot":{de:"Nach dem Neustart einmal die Passphrase eingeben — danach gilt der Fingerabdruck wieder.",en:"After the restart, enter the passphrase once — the fingerprint works again afterwards."},
  "bio.reset":{de:"Fingerabdruck-Entsperren wurde zurückgesetzt (neuer Fingerabdruck im System oder Schlüssel ungültig). In den Einstellungen neu aktivieren.",en:"Fingerprint unlock was reset (new fingerprint enrolled or key invalid). Re-enable it in Settings."},
  "bio.lockout":{de:"Zu viele Fehlversuche — der Sensor ist vorübergehend gesperrt. Bitte Passphrase.",en:"Too many attempts — the sensor is temporarily locked. Use the passphrase."},
  "bio.cancelled":{de:"Fingerabdruck abgebrochen — Entsperren bleibt bei der Passphrase",en:"Fingerprint cancelled — unlocking stays with the passphrase"},
  "bio.failed":{de:"Fingerabdruck nicht eingerichtet (Fehler im Keystore)",en:"Fingerprint not set up (keystore error)"},
  "bio.on":{de:"Fingerabdruck-Entsperren aktiv",en:"Fingerprint unlock active"},
  "bio.off":{de:"Fingerabdruck-Entsperren deaktiviert",en:"Fingerprint unlock disabled"},
  "bio.rearmed":{de:"Fingerabdruck wieder aktiv",en:"Fingerprint active again"},
  "bio.naEnrolled":{de:"Im System ist kein Fingerabdruck eingerichtet (Android-Einstellungen → Sicherheit).",en:"No fingerprint enrolled in the system (Android settings → Security)."},
  "bio.naHardware":{de:"Dieses Gerät hat keinen Fingerabdrucksensor der Klasse „stark“ (Android-Einstufung).",en:"This device has no fingerprint sensor of Android's 'strong' class."},
  "bio.naNow":{de:"Fingerabdrucksensor derzeit nicht verfügbar.",en:"Fingerprint sensor currently unavailable."},
  "bio.wrapMismatch":{de:"Der Passphrase-Schlüssel der Tresordatei wurde verändert — Fingerabdruck verweigert. Bitte Passphrase; falls sie nicht mehr passt, das letzte Backup zurückspielen.",en:"The vault file's passphrase key was altered — fingerprint refused. Use the passphrase; if it no longer works, restore the last backup."},
  "bio.tampered":{de:"Der Fingerabdruck-Slot wurde verändert — Fingerabdruck verworfen. Bitte die Passphrase eingeben und den Fingerabdruck in den Einstellungen bewusst neu aktivieren.",en:"The fingerprint slot was altered — fingerprint discarded. Enter the passphrase and deliberately re-enable the fingerprint in Settings."},
  "bio.aborted":{de:"Fingerabdruck nicht aktiviert — Vorgang durch Sperre oder Passphrase-Wechsel abgebrochen",en:"Fingerprint not enabled — interrupted by lock or passphrase change"},
  "bio.busy":{de:"Bitte erst den laufenden Fingerabdruck-Vorgang abschließen.",en:"Finish the pending fingerprint step first."},
  "bio.rearmRefused":{de:"Fingerabdruck NICHT wieder aktiviert: Seit dem Einrichten wurde im System ein Fingerabdruck registriert. Warst du das nicht selbst, prüfe die Fingerabdrücke in den Android-Einstellungen. Neu aktivieren geht in den Einstellungen.",en:"Fingerprint NOT re-enabled: a fingerprint was enrolled in the system since setup. If that was not you, check the fingerprints in Android settings. You can re-enable it in Settings."},
  "bio.alert":{de:"⚠ Fingerabdruck-Entsperren wurde abgeschaltet: Seit dem Einrichten wurde in Android ein Fingerabdruck neu registriert. Warst du das nicht selbst, prüfe sofort die Fingerabdrücke in den Android-Einstellungen (Sicherheit) und entferne fremde. Danach kannst du den Fingerabdruck in den Einstellungen bewusst neu aktivieren.",en:"⚠ Fingerprint unlock was switched off: a fingerprint was newly enrolled in Android since setup. If that was not you, check the fingerprints in Android settings (Security) right away and remove unknown ones. Afterwards you can deliberately re-enable fingerprint unlock in Settings."},
  "bio.alertOk":{de:"Gelesen",en:"Got it"},
  "bio.held":{de:"Bewusst gesperrt: Diesmal ist die Passphrase nötig — danach gilt der Fingerabdruck wieder.",en:"Locked deliberately: the passphrase is required this time — the fingerprint works again afterwards."},
  "confirm.bioDisable":{de:"Fingerabdruck-Entsperren wirklich deaktivieren?",en:"Really disable fingerprint unlock?"},
  "toast.passChangedBio":{de:"Passphrase geändert, Datenschlüssel erneuert — Fingerabdruck deaktiviert, in den Einstellungen neu aktivieren",en:"Passphrase changed, data key rotated — fingerprint disabled, re-enable it in Settings"},
  "busy.checking":{de:"Prüfe…",en:"Checking…"},
  "err.wait":{de:"Zu viele Fehlversuche — bitte {s} s warten.",en:"Too many failed attempts — please wait {s} s."},
  "err.kdfFailed":{de:"Die Schlüsselableitung (Argon2id) ist gescheitert — vermutlich reicht der Speicher nicht. Am Tresor wurde nichts verändert.",en:"Key derivation (Argon2id) failed — probably not enough memory. Nothing in the vault was changed."},
  "err.setupFailed":{de:"Tresor konnte nicht angelegt werden.",en:"Could not create the vault."},
  "err.migrateFailed":{de:"Umstellung der Verschlüsselung fehlgeschlagen — der Tresor ist unverändert im alten Format erhalten.",en:"Switching the encryption failed — the vault is preserved unchanged in the old format."},
  "toast.migrated":{de:"Verschlüsselung auf Argon2id umgestellt",en:"Encryption switched to Argon2id"},
  "busy.migrating":{de:"Verschlüsselung wird umgestellt…",en:"Switching encryption…"},
  "busy.creating":{de:"Erstelle…",en:"Creating…"},
  "bk.fresh":{de:"⚠ Die Verschlüsselung wurde auf Argon2id umgestellt. Deine alten Backups bleiben lesbar — ein frisches Backup im neuen Format ist trotzdem empfohlen.",en:"⚠ The encryption was switched to Argon2id. Your old backups remain readable — a fresh backup in the new format is still recommended."},
  "err.totp6":{de:"6-stelligen Code eingeben.",en:"Enter the 6-digit code."},
  "err.totpBad":{de:"Code falsch oder abgelaufen.",en:"Code wrong or expired."},
  "err.totpSetupBad":{de:"Code stimmt nicht. In Aegis prüfen.",en:"Code doesn't match. Check in Aegis."},
  "toast.vaultCreated":{de:"Tresor erstellt",en:"Vault created"},
  "toast.totpOn":{de:"2FA aktiviert",en:"2FA enabled"},"toast.totpOff":{de:"2FA deaktiviert",en:"2FA disabled"},
  "confirm.totpDisable":{de:"2FA wirklich deaktivieren?",en:"Really disable 2FA?"},
  "busy.decrypting":{de:"Entschlüssele…",en:"Decrypting…"},
  "busy.changing":{de:"Ändere…",en:"Changing…"},
  "csv.failPre":{de:"CSV-Import fehlgeschlagen: ",en:"CSV import failed: "},
  "imp.deferred":{de:"Datei gewählt — zum Importieren entsperren.",en:"File chosen — unlock to import."},
  "csv.errEmpty":{de:"Datei leer oder ohne Datenzeilen.",en:"File empty or without data rows."},
  "csv.errFormat":{de:"Unbekanntes Format. Erwarte Kopfzeile: date,btc_amount,eur_amount,note,kyc (oder …,no_kyc).",en:"Unknown format. Expected header: date,btc_amount,eur_amount,note,kyc (or …,no_kyc)."},
  "err.saveFailed":{de:"SPEICHERN FEHLGESCHLAGEN — Änderung NICHT gesichert (Speicher voll oder Datei nicht schreibbar?)",en:"SAVING FAILED — change NOT persisted (storage full or file not writable?)"},
  "err.storeRead":{de:"Tresor-Datei nicht lesbar — nichts überschrieben. Datei prüfen oder ein Backup wiederherstellen.",en:"Vault file not readable — nothing overwritten. Check the file or restore a backup."},
  "err.wipeFailed":{de:"Löschen fehlgeschlagen — Tresor-Datei nicht entfernt",en:"Delete failed — vault file not removed"},
  "about":{de:"Sachwert-Tresor v{v} · AES-256-GCM · Argon2id · 100 % lokal",en:"Sachwert-Tresor v{v} · AES-256-GCM · Argon2id · 100 % local"},
  "err.vaultNewer":{de:"Hinweis: Dieser Tresor stammt aus einer neueren App-Version — bitte App aktualisieren.",en:"Note: this vault was created by a newer app version — please update the app."},
  "bk.never":{de:"⚠ Noch kein Backup erstellt — geht dieses Gerät verloren, ist der Tresor weg. Export & Sync → Backup erstellen.",en:"⚠ No backup yet — if this device is lost, the vault is gone. Export & Sync → Create backup."},
  "bk.stale":{de:"⚠ Letztes Backup vor {d} Tagen — seitdem {n} neue Buchung(en). Export & Sync → Backup erstellen.",en:"⚠ Last backup {d} days ago — {n} new entries since. Export & Sync → Create backup."},
  "pass.s0":{de:"zu kurz (mind. 12 Zeichen)",en:"too short (min. 12 characters)"},
  "pass.s1":{de:"okay — länger ist besser",en:"okay — longer is better"},
  "pass.s2":{de:"stark",en:"strong"},
  "pass.s3":{de:"sehr stark",en:"very strong"}
};
// URL-Param ?lang=de|en überschreibt localStorage (sprachfeste Links) — in der
// App (Capacitor/file://) ist location.search leer, dann greift die alte Kette.
const _qsLang = new URLSearchParams(window.location.search).get('lang');
let LANG = (_qsLang==='de'||_qsLang==='en') ? _qsLang
  : (localStorage.getItem('ai-tresor-lang') || ((navigator.language||'de').toLowerCase().indexOf('de')===0?'de':'en'));
const _i18nCache = new WeakMap();
function tr(key){ const e=T[key]; return e?(e[LANG]!==undefined?e[LANG]:e.de):key; }
function applyI18n(){
  document.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-ph]').forEach(el=>{
    let c=_i18nCache.get(el); if(!c){ c={}; _i18nCache.set(el,c); }
    [['data-i18n','textContent'],['data-i18n-html','innerHTML'],['data-i18n-ph','placeholder']].forEach(([attr,prop])=>{
      const key=el.getAttribute(attr); if(!key) return;
      if(c[prop]===undefined) c[prop]=el[prop];           // Original (DE) merken
      const en=I18N[key];
      el[prop]=(LANG==='en'&&en!==undefined)?en:c[prop];
    });
  });
  document.documentElement.setAttribute('lang',LANG);
  const lb=document.getElementById('lang-btn'); if(lb) lb.textContent=(LANG==='de'?'DE':'EN');
  document.querySelectorAll('.pw-eye').forEach(b=>{ b.title=tr('pw.toggle'); });
  if(typeof App!=='undefined'&&App.syncCombos) App.syncCombos();   // Optionen tragen data-i18n → Knopfbeschriftung nachziehen
}
function setLang(l){ LANG=l; try{localStorage.setItem('ai-tresor-lang',l);}catch(_){ } applyI18n(); if(typeof App!=='undefined'&&App.relabel) App.relabel(); }

/* ---------- base64 / bytes ---------- */
function bufToB64(buf){let b='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);return btoa(b);}
function b64ToBuf(b64){const s=atob(b64);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer;}

/* ---------- Base32 (RFC 4648, für TOTP-Secret) ---------- */
const B32A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes){let bits=0,val=0,out='';for(const b of bytes){val=(val<<8)|b;bits+=8;while(bits>=5){out+=B32A[(val>>>(bits-5))&31];bits-=5;}}if(bits>0)out+=B32A[(val<<(5-bits))&31];return out;}
function base32Decode(str){str=str.toUpperCase().replace(/=+$/,'').replace(/\s/g,'');let bits=0,val=0;const out=[];for(const c of str){const idx=B32A.indexOf(c);if(idx<0)continue;val=(val<<5)|idx;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&0xff);bits-=8;}}return new Uint8Array(out);}

/* ---------- Lesepfad Alt-Format (AISV1: PBKDF2 -> AES-GCM) — NIE ENTFERNEN ----------
   Seit v3.0 wird nur noch gelesen: nicht umgestellte Tresore und alte .vault-Backups müssen für immer
   aufgehen. Einen Schreibpfad für AISV1 gibt es bewusst nicht mehr (siehe persist/migrateToV2). */
const ITER = 600000;
// iter aus dem Blob honorieren (KDF-Agilität) — aber begrenzen: eine importierte/gespeicherte .vault
// darf keine unbegrenzte Iterationszahl erzwingen (sonst PBKDF2-DoS beim Import). 0/NaN/String/zu groß → ITER.
const clampIter = it => (Number.isInteger(it) && it>0 && it<=10000000) ? it : ITER;
async function deriveKey(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:clampIter(iter),hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function decryptBlob(blob, key){
  const pt = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b64ToBuf(blob.iv))}, key, b64ToBuf(blob.ct));
  return JSON.parse(dec.decode(pt));
}

/* === VAULT-FORMAT BEGIN === */
/* Dateiformat AISV2 + Schlüsselhierarchie (seit v3.0). Alles hier ist top-level und steht
   ZWISCHEN den Sentinels: roundtrip-test.mjs wertet genau diese Region aus, statt die Krypto
   ein zweites Mal nachzubauen (eine Kopie driftet, diese Region nicht). Nicht in den App-IIFE
   verschieben und die Sentinel-Kommentare nicht umbenennen.

   KEK = Argon2id(Passphrase) verpackt den zufälligen DEK (AES-GCM wrapKey mit AAD).
   Die AAD bindet magic/ver/KDF-Parameter/Salt + Rolle (wrap|body|bio), kanonisch aus den
   DEKODIERTEN Werten erzeugt, auf Lese- UND Schreibpfad dieselbe Funktion. Folge: ein
   veränderter Header oder eine vertauschte Rolle macht die Entschlüsselung unmöglich. */
const MAGIC='AISV2', FILE_VER=1;
const KDF_DEFAULT={m:65536,t:3,p:1};                                   // 64 MiB, 3 Durchgänge — Parität zu Alien Pass
const KDF_BOUNDS={mMin:8192,mMax:262144,tMin:1,tMax:16,pMin:1,pMax:4,budget:786432};
const MAX_FILE_BYTES=20*1024*1024;
const MAX_ENTRIES=10000, MAX_CSV_ROWS=4*MAX_ENTRIES;   // Deckel wie Alien Pass (Audit run-6 #1): Dubletten und unbrauchbare Zeilen dürfen mitzählen, darum das Vierfache
function rand(n){ return crypto.getRandomValues(new Uint8Array(n)); }
function b64Bytes(s){ if(typeof s!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null; try{ return new Uint8Array(b64ToBuf(s)); }catch(_){ return null; } }
function passBytes(p){ return enc.encode(String(p).normalize('NFKC')); }   // NFKC: dieselbe Passphrase, gleich getippt, ergibt denselben Schlüssel
function kdfOk(k){ const B=KDF_BOUNDS; return !!k && Number.isInteger(k.m)&&Number.isInteger(k.t)&&Number.isInteger(k.p)
  && k.m>=B.mMin&&k.m<=B.mMax && k.t>=B.tMin&&k.t<=B.tMax && k.p>=B.pMin&&k.p<=B.pMax && k.m*k.t<=B.budget; }
function aad(kdf, role){ return enc.encode(`${MAGIC}|${FILE_VER}|argon2id|${kdf.m}|${kdf.t}|${kdf.p}|${bufToB64(kdf.salt)}|${role}`); }
async function argon2Raw(pass, kdf){
  if(!kdfOk(kdf)) throw new Error('kdfbounds');
  if(!globalThis.hashwasm||typeof globalThis.hashwasm.argon2id!=='function') throw new Error('noargon2');
  const raw=await globalThis.hashwasm.argon2id({password:pass, salt:kdf.salt, parallelism:kdf.p, iterations:kdf.t, memorySize:kdf.m, hashLength:32, outputType:'binary'});
  if(pass instanceof Uint8Array) pass.fill(0);
  return raw;
}
async function deriveKek(pass, kdf){
  const raw=await argon2Raw(pass, kdf);
  const key=await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['wrapKey','unwrapKey']);
  raw.fill(0); return key;
}
function newDek(){ return crypto.subtle.generateKey({name:'AES-GCM',length:256}, true, ['encrypt','decrypt']); }
// Rolle 'wrap' = Passphrase-Slot in der Datei; 'bio' = Fingerabdruck-Slot (liegt außerhalb der Datei,
// hängt aber am selben Header). Die Rollentrennung erzwingt die AAD, nicht eine Konvention.
async function wrapDek(dek, kek, kdf, role){ const iv=rand(12); const ct=new Uint8Array(await crypto.subtle.wrapKey('raw', dek, kek, {name:'AES-GCM', iv, additionalData:aad(kdf,role||'wrap')})); return {iv, ct}; }
function unwrapDek(wrap, kek, kdf, extractable, role){ return crypto.subtle.unwrapKey('raw', wrap.ct, kek, {name:'AES-GCM', iv:wrap.iv, additionalData:aad(kdf,role||'wrap')}, {name:'AES-GCM',length:256}, !!extractable, ['encrypt','decrypt']); }
/* Fingerabdruck-Slot: 32 Byte Zufall (nur der Android-Keystore gibt sie nach Fingerabdruck heraus) werden als nicht
   extrahierbarer Wrap-Schlüssel importiert; der Blob {iv,ct,w} liegt unter 'ai-sachwert-bio' und wird NIE exportiert. */
function bioKey(raw){ if(!(raw instanceof Uint8Array)||raw.length!==32) throw new Error('biokey'); return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['wrapKey','unwrapKey']); }
// `w` = b64 des Passphrase-Wrap-Ciphertexts, für den der Slot erzeugt wurde: doBio übernimmt f.wrap nur, wenn es dazu passt —
// sonst könnte ein manipulierter wrap per Fingerabdruck-Sitzung stillschweigend weitergeschrieben werden (Alien-Pass-Audit run-3 #3)
// `wi` (v3.2, Alien-Pass-Audit run-8 #1) = b64 der Wrap-IV, OPTIONAL: Slots von ≤ v3.1.1 tragen nur `w` und laufen unverändert weiter; neue Slots binden
// IV + Ciphertext, damit eine gekippte IV nicht ungeprüft in die Sitzung und mit dem nächsten persist() in Datei und Backups wandert.
function parseBioBlob(raw){ if(typeof raw!=='string'||raw.length>512) return null; let o; try{ o=JSON.parse(raw); }catch(_){ return null; } if(!o||typeof o!=='object') return null; const iv=b64Bytes(o.iv), ct=b64Bytes(o.ct), w=b64Bytes(o.w); if(!(iv&&iv.length===12&&ct&&ct.length===48&&w&&w.length===48)) return null;
  if(o.wi===undefined||o.wi===null) return {iv,ct,w:o.w,wi:null}; const wi=b64Bytes(o.wi); return (wi&&wi.length===12)?{iv,ct,w:o.w,wi:o.wi}:null; }
function serializeBioBlob(blob, wrapCt, wrapIv){ if(!(wrapCt instanceof Uint8Array)||wrapCt.length!==48) throw new Error('bioblob'); if(wrapIv!==undefined&&!(wrapIv instanceof Uint8Array&&wrapIv.length===12)) throw new Error('bioblob');
  const o={iv:bufToB64(blob.iv), ct:bufToB64(blob.ct), w:bufToB64(wrapCt)}; if(wrapIv) o.wi=bufToB64(wrapIv); return JSON.stringify(o); }
// Passt der Passphrase-Slot der Datei zum Fingerabdruck-Blob? Ciphertext immer, IV nur wenn der Blob sie kennt (Übergang ≤ v3.1.1)
function bioWrapOk(blob, wrap){ return !!blob&&!!wrap&&blob.w===bufToB64(wrap.ct)&&(!blob.wi||blob.wi===bufToB64(wrap.iv)); }
async function encryptBody(obj, dek, kdf){ const iv=rand(12); const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(kdf,'body')}, dek, enc.encode(JSON.stringify(obj)))); return {iv,ct}; }
async function decryptBody(body, dek, kdf){ const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:body.iv,additionalData:aad(kdf,'body')}, dek, body.ct); return JSON.parse(dec.decode(pt)); }
function serializeFile(kdf, wrap, body){
  return JSON.stringify({magic:MAGIC, ver:FILE_VER,
    kdf:{name:'argon2id', m:kdf.m, t:kdf.t, p:kdf.p, salt:bufToB64(kdf.salt)},
    wrap:{iv:bufToB64(wrap.iv), ct:bufToB64(wrap.ct)},
    body:{iv:bufToB64(body.iv), ct:bufToB64(body.ct)}});
}
// Prüft Struktur + Grenzen VOR jeder KDF-Arbeit. Wirft Error('format'|'newer'|'kdfbounds'|'toolarge').
function parseFile(raw){
  if(typeof raw!=='string') throw new Error('format');
  if(raw.length>MAX_FILE_BYTES) throw new Error('toolarge');
  let f; try{ f=JSON.parse(raw); }catch(_){ throw new Error('format'); }
  if(!f||typeof f!=='object'||f.magic!==MAGIC) throw new Error('format');
  if(f.ver!==FILE_VER) throw new Error((Number.isInteger(f.ver)&&f.ver>FILE_VER)?'newer':'format');
  const k=f.kdf; if(!k||typeof k!=='object'||k.name!=='argon2id') throw new Error('format');
  const kdf={m:k.m, t:k.t, p:k.p, salt:b64Bytes(k.salt)};
  if(!kdf.salt||kdf.salt.length!==16) throw new Error('format');
  if(!kdfOk(kdf)) throw new Error('kdfbounds');
  const wrap={iv:b64Bytes(f.wrap&&f.wrap.iv), ct:b64Bytes(f.wrap&&f.wrap.ct)};
  const body={iv:b64Bytes(f.body&&f.body.iv), ct:b64Bytes(f.body&&f.body.ct)};
  if(!wrap.iv||wrap.iv.length!==12||!wrap.ct||wrap.ct.length!==48) throw new Error('format');
  if(!body.iv||body.iv.length!==12||!body.ct||body.ct.length<16) throw new Error('format');
  return {kdf, wrap, body};
}
// Sieht ein Blob wie eine Datei aus der Zeit vor AISV2 aus? (Lesepfad Alt-Format — nie entfernen.)
function looksLegacy(o){ return !!o && typeof o==='object' && typeof o.ct==='string' && typeof o.salt==='string' && typeof o.iv==='string'; }
/* === VAULT-FORMAT END === */

/* ---------- TOTP (RFC 6238, HMAC-SHA1) ---------- */
async function totp(secretB32, forTime){
  const key = base32Decode(secretB32);
  const ck = await crypto.subtle.importKey('raw', key, {name:'HMAC',hash:'SHA-1'}, false, ['sign']);
  let counter = Math.floor((forTime||(Date.now()/1000))/30);
  const cb = new ArrayBuffer(8); const dv = new DataView(cb);
  dv.setUint32(4, counter>>>0); dv.setUint32(0, Math.floor(counter/0x100000000));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, cb));
  const off = sig[19] & 0xf;
  const bin = ((sig[off]&0x7f)<<24)|((sig[off+1]&0xff)<<16)|((sig[off+2]&0xff)<<8)|(sig[off+3]&0xff);
  return String(bin % 1000000).padStart(6,'0');
}
async function totpValid(secret, input){
  const now = Date.now()/1000;
  for(const d of [-1,0,1]){ if(await totp(secret, now + d*30) === input) return true; }
  return false;
}

/* ============================================================
   App state
   ============================================================ */
const App = (function(){
  // Sitzung (seit v3.0): DEK verschlüsselt den Body, KDF+WRAP sind der Passphrase-Slot, unter dem er verpackt liegt.
  // DEK/KDF/WRAP sind EINE Schlüsselgeneration: nur gemeinsam in einem synchronen Schritt tauschen, KDF und WRAP
  // nie mutieren (neue Generation = neues Objekt) — persist() erkennt einen Wechsel am Objektvergleich.
  let DEK = null, KDF = null, WRAP = null;
  let VAULT = null;      // decrypted object
  // Entschlüsselt, aber noch nicht in der Sitzung: wartet auf den Aegis-Code bzw. (Alt-Format) auf die Umstellung.
  // {vault, dek,kdf,wrap} oder {legacy:true, vault, kdf, kek, raw}. Vor dem Gate liegt NICHTS in DEK/VAULT.
  let pendingUnlock = null;
  let addType = 'btc', addDir = 'buy', listFilter = 'all', chartSeries = 'invested', chartRange = 'max', editId = null;
  let addBtcUnit = 'btc';   // Eingabe-Einheit im Erfassen-Formular (btc|sat) — gespeichert wird immer BTC

  // Desktop-Hülle (Linux, Electron im Flatpak, seit v3.3 — Muster Alien Pass v1.7): Brücke aus desktop/preload.js. Ohne Hülle
  // (Browser, Android) ist DESK null und alles läuft wie bisher. Der Tresor liegt am Desktop als Datei statt im localStorage —
  // alle Zugriffe auf LS_KEY NUR über diese drei Helfer (synchron, werfen bei Fehlern; Invarianten: DESKTOP-INVARIANTEN.md).
  const DESK = window.AlienDesktop || null;
  function vaultGet(){ return DESK ? DESK.store.read() : localStorage.getItem(LS_KEY); }
  function vaultSet(s){ if(DESK) DESK.store.write(s); else localStorage.setItem(LS_KEY, s); }
  function vaultDel(){ if(DESK) DESK.store.del(); else localStorage.removeItem(LS_KEY); }

  const $ = id => document.getElementById(id);
  const show = (id) => $(id).classList.remove('hidden');
  const hide = (id) => $(id).classList.add('hidden');
  function screen(name){['setup','lock','totp','app'].forEach(s=>$('screen-'+s).classList.add('hidden'));$('screen-'+name).classList.remove('hidden');}
  // Toast, optional mit einem Knopf (v3.5, Kit-Baustein aus Alien Pass v1.9: „Rückgängig“ nach dem Löschen): toast(msg,{action:{label,fn},ms}).
  // Der Knopf trägt ohne Aktion keinen Text (Suiten lesen #toast per textContent). hideToast() räumt Text und Aktion — auch beim Sperren
  // (clearRendered), damit kein „Rückgängig“ in eine gesperrte App hinein wirkt; toastAction prüft zusätzlich VAULT.
  const UNDO_MS=6000;   // so lange steht „Rückgängig“ nach dem Löschen im Toast
  let toastFn=null;
  function toast(msg, opt){ const t=$('toast'); if(!t) return; opt=opt||{}; $('toast-msg').textContent=msg; const b=$('toast-btn'); toastFn=opt.action?opt.action.fn:null;
    b.textContent=opt.action?opt.action.label:''; b.classList.toggle('hidden',!opt.action); t.classList.remove('hidden'); clearTimeout(t._t); t._t=setTimeout(hideToast, opt.ms||2200); }
  function hideToast(){ const t=$('toast'); if(!t) return; clearTimeout(t._t); t.classList.add('hidden'); $('toast-msg').textContent=''; $('toast-btn').textContent=''; $('toast-btn').classList.add('hidden'); toastFn=null; }
  function toastAction(){ const fn=toastFn; hideToast(); if(typeof fn==='function'&&VAULT) fn(); }
  /* ---------- Rückfrage als eigener DOM-Dialog (v3.5, Vorlage Alien Pass v1.9) statt confirm(): der Android-Systemdialog erbt FLAG_SECURE nicht —
     ein Screenshot bei offener Löschnachfrage zeigte den Dialogtext, während die App dahinter schwarz war (Querfund Alien Notes, Gerätetest 25.09.2026).
     ask(msg,{ok,danger}) liefert ein Promise<boolean>; nur ein Dialog zur Zeit (eine zweite Frage gilt sofort als abgelehnt); Escape/Hintergrund
     = Abbrechen; Tab pendelt zwischen den Knöpfen; clearRendered() schließt ihn beim Sperren mit false, und JEDER Aufrufer prüft nach dem await
     seinen Zustand neu (VAULT? Eintrag noch da? editId gleich?). Text nur per textContent (pre-line macht Absätze aus \n\n). Kein Eingabefeld —
     der Tresor hat keinen prompt()-Ersatz nötig (Unterschied zu Alien Pass). ---------- */
  let dlgResolve=null, dlgPrev=null;
  function ask(msg, opt){ opt=opt||{}; if(dlgResolve) return Promise.resolve(false);
    return new Promise(res=>{ dlgResolve=res; dlgPrev=document.activeElement; $('dlg-msg').textContent=msg;
      const b=$('dlg-ok'); b.textContent=tr(opt.ok||'dlg.ok'); b.classList.toggle('danger',!!opt.danger); $('dlg').classList.remove('hidden'); $('dlg-cancel').focus(); }); }
  function dialogClose(v){ const r=dlgResolve; if(!r) return; dlgResolve=null;
    $('dlg').classList.add('hidden'); $('dlg-msg').textContent=''; $('dlg-ok').classList.remove('danger');
    const f=dlgPrev; dlgPrev=null; if(f&&document.contains(f)&&typeof f.focus==='function'){ try{ f.focus(); }catch(_){} } r(!!v); }
  function dialogOk(){ dialogClose(true); }
  function dialogCancel(){ dialogClose(false); }
  function dialogOpen(){ return !!dlgResolve; }
  function dialogKey(ev){ if(!dlgResolve) return false;
    if(ev.key==='Escape'){ dialogCancel(); return true; }
    if(ev.key==='Tab'){ const ring=[$('dlg-cancel'),$('dlg-ok')]; const i=ring.indexOf(document.activeElement); ring[(i+(ev.shiftKey?-1:1)+ring.length)%ring.length].focus(); return true; }
    return false; }
  function err(id,msg){const e=$(id);if(!msg){e.classList.add('hidden');return;}e.textContent=msg;e.classList.remove('hidden');}

  const VAULT_VERSION=1;   // Schema-Version dieser App — Vaults aus neueren Versionen lösen eine Warnung aus
  function emptyVault(){return {version:VAULT_VERSION, entries:[], totp:null, prices:{btc:'',gold:'',silver:''}, priceHistory:[], unit:'oz', btcUnit:'btc', autolock:5};}
  const PRICE_HIST_MAX=2000;   // Deckel fuer VAULT.priceHistory (~5 Jahre taeglich)
  const OZ_G = 31.1034768;  // Troy-Unze in Gramm
  const SATS = 1e8;         // Anzeige/Eingabe wahlweise in Sats — Datenmodell + Exporte bleiben BTC
  function btcUnit(){return VAULT&&VAULT.btcUnit==='sat'?'sat':'btc';}
  const fmtBtc=v=>btcUnit()==='sat'?fmtNum(Math.round((v||0)*SATS),0)+' sats':fmtNum(v,8)+' ₿';

  /* ---------- persistence ---------- */
  // Schlüsselgeneration VOR dem await pinnen und danach prüfen (Querfund Ausgaben-Tracker-Audit run-1 #12):
  // ein lock() während des Verschlüsselns darf nie einen Blob mit fremdem Header schreiben.
  // Gesperrt → Fehler mit .locked (Aufrufer rollen dann NICHT zurück — VAULT ist weg bzw. frisch entsperrt).
  // Passphrase inzwischen gewechselt (gleicher VAULT) → dieser Blob ist veraltet: mit dem aktuellen Schlüssel neu verschlüsseln.
  // Voraussetzung: DEK/KDF/WRAP werden überall nur gemeinsam in einem synchronen Schritt getauscht (doSetup, changePass, openSession).
  // Einziger Schreibpfad: persist() schreibt ausschließlich AISV2 — kein Modus erzeugt noch das Alt-Format.
  function lockedErr(){ const e=new Error('vault locked'); e.locked=true; return e; }
  async function persist(){
    const dek=DEK, kdf=KDF, wrap=WRAP, vault=VAULT;
    if(!dek||!kdf||!wrap||!vault) throw lockedErr();
    const body = await encryptBody(vault, dek, kdf);
    if(!DEK||VAULT!==vault) throw lockedErr();
    if(DEK!==dek||KDF!==kdf||WRAP!==wrap) return persist();
    try{ vaultSet(serializeFile(kdf, wrap, body)); }
    catch(e){ toast(tr('err.saveFailed')); throw e; }   // Erfolgs-Toasts der Aufrufer (.then) bleiben so aus
  }
  function fileErrMsg(e){ const c=e&&e.message; return tr(c==='newer'?'err.fileNewer':c==='kdfbounds'?'err.fileBounds':c==='toolarge'?'err.fileLarge':c==='noargon2'?'err.noArgon2':'err.fileFormat'); }
  const FILE_ERRS=['format','newer','kdfbounds','toolarge','noargon2'];
  // Nur ein fehlgeschlagenes AES-GCM-Auspacken/Entschlüsseln (OperationError) heißt „falsche Passphrase“. Alles andere —
  // vor allem Argon2 ohne genug Speicher (RangeError/RuntimeError) — bekommt eine eigene Meldung, sonst glaubt der Nutzer
  // bei richtiger Passphrase an Datenverlust und die Fehlversuchs-Bremse zählt falsch (Audit run-4, Hinweis 1).
  const isWrongPass=e=>!!e&&e.name==='OperationError';
  function openErrMsg(e, wrongKey){ return e&&FILE_ERRS.includes(e.message)?fileErrMsg(e):isWrongPass(e)?tr(wrongKey):e&&e.name==='InvalidCharacterError'?tr('err.fileFormat'):tr('err.kdfFailed'); }
  // Tresor-Text öffnen (lokaler Speicher wie importierte .vault). Struktur + Grenzen werden VOR jeder KDF-Arbeit geprüft.
  // AISV2 → {vault, dek, kdf, wrap}. Alt-Format (AISV1/PBKDF2, auch frühe Backups) → {legacy:true, vault}.
  // Wirft Error(FILE_ERRS) bei kaputter/fremder Datei, sonst den Entschlüsselungsfehler (= falsche Passphrase).
  async function openVaultText(raw, pass, wantX){
    let f;
    try{ f=parseFile(raw); }
    catch(e){
      if(!e||e.message!=='format') throw e;
      let o; try{ o=JSON.parse(raw); }catch(_){ throw e; }
      if(!looksLegacy(o)) throw e;
      // Lesepfad Alt-Format — nie entfernen: alte .vault-Backups und nicht umgestellte Tresore hängen daran.
      const k=await deriveKey(pass, new Uint8Array(b64ToBuf(o.salt)), o.iter);
      return {legacy:true, vault:await decryptBlob(o, k)};
    }
    const kek=await deriveKek(passBytes(pass), f.kdf);
    const dek=await unwrapDek(f.wrap, kek, f.kdf, false);   // Sitzungsschlüssel nicht extrahierbar
    const dekX=wantX?await unwrapDek(f.wrap, kek, f.kdf, true):null;   // nur zum Neu-Bewaffnen des Fingerabdruck-Slots nach Neustart
    return {legacy:false, vault:await decryptBody(f.body, dek, f.kdf), dek, kdf:f.kdf, wrap:f.wrap, dekX};
  }
  // Umstellung Alt-Format → AISV2 (einmalig, nach dem Aegis-Gate). Der alte Blob ist der einzige lesbare Ciphertext:
  // erst komplett bauen, dann aus dem SERIALISIERTEN Text zurücklesen und vergleichen, erst dann überschreiben.
  const PRE3_KEY='ai-sachwert-vault-pre3';   // Sicherungskopie des Alt-Blobs (gleiche Passphrase), gelöscht beim nächsten AISV2-Entsperren
  async function migrateToV2(p){
    const dekX=await newDek();
    const wrap=await wrapDek(dekX, p.kek, p.kdf);
    const dek=await unwrapDek(wrap, p.kek, p.kdf, false);
    const s=serializeFile(p.kdf, wrap, await encryptBody(p.vault, dek, p.kdf));
    const f=parseFile(s);                                          // Read-back: genau das, was gleich im Speicher steht
    const back=await decryptBody(f.body, await unwrapDek(f.wrap, p.kek, f.kdf, false), f.kdf);
    if(JSON.stringify(back)!==JSON.stringify(p.vault)) throw new Error('readback');
    if(pendingUnlock!==p) throw lockedErr();                       // zwischendurch gesperrt: nichts schreiben
    if(vaultGet()!==p.raw) throw new Error('changed');            // Speicher hat sich unter uns geändert
    // pre3 nur, wenn Platz ist (Audit run-4 #1): Alt-Blob + Kopie brauchen kurz 2N — ab etwa dem halben Speicherlimit
    // scheiterte sonst JEDE Umstellung und der Tresor ging in v3.0 nie mehr auf. Der Read-back oben hat die neue Datei
    // bereits bewiesen; setItem ersetzt atomar (die Desktop-Datei ebenso: Temp + rename), bei jedem Fehler steht der Alt-Blob unverändert.
    // PRE3 bleibt bewusst im localStorage: am Desktop ist dieser Pfad unerreichbar (die Datei enthält nie einen AISV1-Blob).
    try{ localStorage.setItem(PRE3_KEY, p.raw); }catch(_){ dropPre3(); }
    try{ vaultSet(s); }
    catch(e){ dropPre3();                                          // Grenzfall: pre3 passte, blockiert aber den etwas größeren AISV2-Blob
      vaultSet(s); }                                               // zweiter Fehlschlag wirft: Alt-Blob steht unverändert
    return {dek, kdf:p.kdf, wrap};
  }
  function dropPre3(){ try{ localStorage.removeItem(PRE3_KEY); }catch(_){ } }

  /* ---------- Fehlversuchs-Bremse (seit v3.0, Muster Alien Pass) ----------
     Ab dem 3. Fehlversuch min(30,(n-2)*2) s Wartezeit, geprüft VOR jeder KDF-Arbeit. Überlebt einen Neustart unter
     'ai-sachwert-lock' (nichts Geheimes darin). Ein Komfort-Riegel gegen Tipp-Hämmern, KEIN Krypto-Schutz — wer die
     App-Daten löscht, löscht ihn mit; die Kostenbremse gegen Durchprobieren ist Argon2id. Es zählen nur echte
     Fehlversuche (falsche Passphrase, falscher 2FA-Code), keine kaputten Dateien und keine Argon2-Speicherfehler. */
  const LOCK_KEY='ai-sachwert-lock';
  let failCount=0, lockedUntil=0;
  // Der Zähler wird bei JEDEM Fehlversuch gespeichert und nur durch einen Erfolg (clearFails) gelöscht — kein Ablauf nach Zeit:
  // am entsperrten Handy kontrolliert ein Angreifer die Uhr. Vorher galt der Eintrag nur während einer laufenden Wartezeit, und
  // jeder App-Neustart danach begann wieder bei 0 — die Wartezeit wuchs nie über 2 s (Audit run-5 #2).
  function saveLockState(){ try{ if(failCount>0) localStorage.setItem(LOCK_KEY, JSON.stringify({f:failCount,u:lockedUntil})); else localStorage.removeItem(LOCK_KEY); }catch(_){ } }
  // Übernehmen: Zähler als Maximum aus RAM und Speicher (auch nach abgelaufener Wartezeit; zweiter Tab), Wartezeit höchstens
  // 30 s voraus — ein Eintrag weit in der Zukunft (Uhr zurückgestellt, Müll) wird gekappt statt verworfen. Unplausibles → ignoriert.
  function loadLockState(){ try{ const o=JSON.parse(localStorage.getItem(LOCK_KEY)||'null'); const n=Date.now();
    if(o&&Number.isInteger(o.f)&&o.f>0&&o.f<100000){ failCount=Math.max(failCount,o.f);
      if(Number.isFinite(o.u)&&o.u>n) lockedUntil=Math.max(lockedUntil,Math.min(o.u,n+30000)); } }catch(_){ } }
  function noteFail(){ failCount++; if(failCount>=3) lockedUntil=Date.now()+Math.min(30,(failCount-2)*2)*1000; saveLockState(); }
  function clearFails(){ failCount=0; lockedUntil=0; saveLockState(); }
  function waitMsg(){ const now=Date.now(); return now<lockedUntil ? tr('err.wait').replace('{s}',Math.ceil((lockedUntil-now)/1000)) : ''; }

  /* ---------- Argon2-Vorabprüfung ----------
     Known-Answer-Test mit kleinen Parametern (~10 ms). Fehlt hash-wasm oder rechnet es falsch, wird NICHTS am Tresor
     angefasst und der Sperrbildschirm sagt warum — statt eines „falsche Passphrase“, das nach Datenverlust aussieht. */
  const KAT_HEX='0d70cea2a4ad12ea2e8089e36c39ea57d8b696b61c76ee283c178d13bd2ba882';
  let argonReady=null;
  function argonCheck(){
    if(!argonReady) argonReady=(async()=>{ try{
      const raw=await argon2Raw(enc.encode('sachwert-tresor-kat'), {m:8192,t:1,p:1,salt:enc.encode('sachwert-tresor!')});
      return Array.from(raw,b=>b.toString(16).padStart(2,'0')).join('')===KAT_HEX;
    }catch(_){ return false; } })();
    return argonReady;
  }

  /* ---------- boot ---------- */
  function boot(){
    let raw=null;
    // Lesefehler ≠ „kein Tresor“ (Desktop-Datei): nie „Tresor anlegen“ anbieten, sonst überschriebe die App den echten Tresor
    try{ raw = vaultGet(); }
    catch(_){ screen('lock'); err('lock-err', tr('err.storeRead')); loadLockState(); return; }
    if(!raw){ screen('setup'); setTimeout(()=>$('setup-pass1').focus(),100); bioDrop(true); }   // ohne Tresor kein Fingerabdruck-Slot
    else { screen('lock'); setTimeout(()=>$('lock-pass').focus(),100); bioProbe(bioAuto); }   // bioAuto setzt erst afterGate() wieder (nach „Jetzt sperren“ kein Auto-Prompt)
    loadLockState();
    argonCheck().then(ok=>{ if(!ok) err(raw?'lock-err':'setup-err', tr('err.noArgon2')); });
    // theme buttons reflect current
    const soft = document.documentElement.getAttribute('data-theme')==='soft';
    $('th-dark').classList.toggle('on',!soft); $('th-soft').classList.toggle('on',soft);
  }

  /* ---------- setup ---------- */
  async function doSetup(){
    if(doSetup._busy) return;
    pendingFile=null;   // ein Verweis gehört zum alten Tresor, nie zu einem neu eingerichteten (run-6 #5)
    err('setup-err');
    const p1=$('setup-pass1').value, p2=$('setup-pass2').value;
    if(p1.length<12) return err('setup-err',tr('err.setupShort'));
    if(p1!==p2) return err('setup-err',tr('err.setupMismatch'));
    const btn=$('setup-btn'), orig=btn.textContent;
    doSetup._busy=true; btn.disabled=true; btn.textContent=tr('busy.creating');
    try{
      if(!await argonCheck()) return err('setup-err',tr('err.noArgon2'));
      const kdf={m:KDF_DEFAULT.m, t:KDF_DEFAULT.t, p:KDF_DEFAULT.p, salt:rand(16)};
      const kek=await deriveKek(passBytes(p1), kdf);
      const wrap=await wrapDek(await newDek(), kek, kdf);
      const dek=await unwrapDek(wrap, kek, kdf, false);          // Sitzungsschlüssel nicht extrahierbar
      DEK=dek; KDF=kdf; WRAP=wrap; VAULT=emptyVault();           // gemeinsam tauschen (siehe persist)
      await persist();
    }catch(e){ DEK=KDF=WRAP=VAULT=null; return err('setup-err',tr('err.setupFailed')); }
    finally{ doSetup._busy=false; btn.disabled=false; btn.textContent=orig; }
    $('setup-pass1').value=$('setup-pass2').value='';
    enterApp();
    toast(tr('toast.vaultCreated'));
  }

  /* ---------- unlock ---------- */
  async function doUnlock(){
    if(doUnlock._busy||openSession._busy) return;   // verhindert Doppel-Entsperren bei mehrfachem Enter/Klick
    err('lock-err');
    if(DEK||pendingUnlock) return;
    let raw; try{ raw = vaultGet(); }catch(_){ return err('lock-err', tr('err.storeRead')); }   // Lesefehler: gesperrt bleiben, nichts anlegen
    if(!raw) return boot();
    loadLockState();                               // Stand eines anderen Tabs übernehmen
    const wait=waitMsg(); if(wait){ $('lock-pass').value=''; maskInputs(); return err('lock-err',wait); }   // Bremse VOR jeder KDF-Arbeit
    const btn=$('unlock-btn'), orig=btn.textContent;
    doUnlock._busy=true; btn.disabled=true; btn.textContent=tr('busy.decrypting'); renderBioGate();   // Fingerabdruck-Knopf solange aus
    const gen=bioGen;                              // gewinnt zwischendurch der Fingerabdruck, verfällt dieses Ergebnis (Alien Pass Audit run-3 #1)
    try{
      if(!await argonCheck()) return err('lock-err',tr('err.noArgon2'));   // ohne Argon2 nichts anfassen (auch kein Alt-Tresor)
      const pass=$('lock-pass').value;
      const r=await openVaultText(raw, pass, bioNeedsRearm&&!!BIO&&bioMarker());
      if(r.legacy){
        // Alt-Format: den neuen KEK schon jetzt ableiten (frischer Salt), solange die Passphrase da ist.
        // Geschrieben wird erst nach dem Aegis-Gate in openSession() — mit Passphrase allein nichts umschreiben.
        r.kdf={m:KDF_DEFAULT.m, t:KDF_DEFAULT.t, p:KDF_DEFAULT.p, salt:rand(16)};
        r.kek=await deriveKek(passBytes(pass), r.kdf); r.raw=raw;
      }
      if(gen!==bioGen||DEK||pendingUnlock){ $('lock-pass').value=''; maskInputs(); return; }   // eine andere Pforte hat die Sitzung schon geöffnet
      bioRearmDek=r.dekX||null; delete r.dekX;
      pendingUnlock=r;
    }catch(e){
      $('lock-pass').value=''; maskInputs();                                     // Eingabe nie stehen lassen (Audit run-4 #2)
      if(gen!==bioGen||DEK||pendingUnlock) return;                               // verspäteter Fehlversuch darf keine offene Sitzung stören
      if(isWrongPass(e)) noteFail();                                             // nur echte Fehlversuche bremsen
      return err('lock-err', openErrMsg(e,'err.wrongPass'));
    }
    finally{ doUnlock._busy=false; btn.disabled=false; btn.textContent=orig; renderBioGate(); }
    afterGate();
  }
  // Nach bestandener Passphrase: Aegis-Wartestellung oder direkt in die Sitzung
  function afterGate(){
    $('lock-pass').value=''; bioMsg(''); bioAuto=true; setBioHold(false);   // Passphrase/Fingerabdruck bestanden: Riegel gelöst
    const v=pendingUnlock&&pendingUnlock.vault; if(!v) return;
    if((v.version||1)>VAULT_VERSION) setTimeout(()=>toast(tr('err.vaultNewer')),600);   // nur warnen, nicht blockieren
    if(v.totp && v.totp.enabled){ screen('totp'); $('totp-code').value=''; err('totp-err'); resetIdle(); setTimeout(()=>$('totp-code').focus(),100); return; }   // Idle-Sperre gilt auch in der Wartestellung
    openSession();
  }
  async function doTotp(){
    const p=pendingUnlock; if(!p||doTotp._busy||openSession._busy) return;
    err('totp-err');
    const code = $('totp-code').value.trim();
    loadLockState();
    const wait=waitMsg(); if(wait){ $('totp-code').value=''; return err('totp-err',wait); }
    if(!/^\d{6}$/.test(code)) return err('totp-err',tr('err.totp6'));
    doTotp._busy=true;
    try{ if(!await totpValid(p.vault.totp.secret, code)){ $('totp-code').value=''; noteFail(); return err('totp-err',tr('err.totpBad')); } }
    finally{ doTotp._busy=false; }
    if(pendingUnlock!==p) return;                    // zwischendurch gesperrt
    $('totp-code').value='';
    await openSession();
  }
  // Gemeinsamer Abschluss beider Pforten: erst hier kommt der Schlüssel in die Sitzung (und wird ggf. umgestellt)
  async function openSession(){
    const p=pendingUnlock; if(!p||openSession._busy) return;
    if(p.legacy){
      const btns=[$('unlock-btn'),$('totp-btn')], labels=btns.map(b=>b.textContent);
      openSession._busy=true; btns.forEach(b=>{ b.disabled=true; b.textContent=tr('busy.migrating'); });
      p.vault.needsFreshBackup=true;                 // Hüllenfeld: Export-Tab empfiehlt ein frisches Backup
      let g;
      try{ g=await migrateToV2(p); }
      catch(e){ if(!(e&&e.locked)){ lock(); toast(tr('err.migrateFailed')); } return; }
      finally{ openSession._busy=false; btns.forEach((b,i)=>{ b.disabled=false; b.textContent=labels[i]; }); }
      if(pendingUnlock!==p) return;                  // nach dem Schreiben gesperrt: Datei ist umgestellt, Sitzung bleibt zu
      DEK=g.dek; KDF=g.kdf; WRAP=g.wrap; VAULT=p.vault; pendingUnlock=null; clearFails();
      enterApp(); setTimeout(()=>toast(tr('toast.migrated')),300);
      return;
    }
    DEK=p.dek; KDF=p.kdf; WRAP=p.wrap; VAULT=p.vault; pendingUnlock=null; clearFails();
    dropPre3();                                      // AISV2 lässt sich öffnen: die Sicherungskopie des Alt-Blobs wird nicht mehr gebraucht
    enterApp();
  }

  /* ---------- Auto-Lock bei Inaktivität ---------- */
  let idleTimer=null, lastActivity=0;
  function clearIdle(){ if(idleTimer){clearTimeout(idleTimer); idleTimer=null;} }
  function resetIdle(){
    clearIdle();
    const v=VAULT||(pendingUnlock&&pendingUnlock.vault);
    if(!v) return;                                   // nur entsperrt oder in der Aegis-Wartestellung
    const mins = v.autolock==null?5:v.autolock;
    if(!mins) return;                                // 0 = Auto-Lock aus
    idleTimer=setTimeout(()=>{ clearIdle(); lock(); toast(tr('toast.autolocked')); }, mins*60000);
  }
  function activity(){ if(!DEK&&!pendingUnlock) return; const n=Date.now(); if(n-lastActivity<5000) return; lastActivity=n; resetIdle(); }

  function enterApp(){ screen('app'); tab('dash'); renderAll(); resetIdle(); adoptPrices(); runPendingFile();
    if(bioRearmDek){ const d=bioRearmDek; bioRearmDek=null; bioArm(d, KDF, WRAP, true).then(ok=>{ if(ok) toast(tr('bio.rearmed')); if(VAULT) renderSettings(); }); } }   // if(VAULT): während der Neu-Einrichtung gesperrt → sonst TypeError (Kurz-Review, Test [20] B)   // nach Neustart: Slot mit frischem Zufall neu bewaffnen
  // Tresore von vor v2.12 haben gepflegte Preise (VAULT.prices), aber noch keine datierte Historie.
  // Ohne das stuende im Verlauf "Trage Preise ein", obwohl welche eingetragen SIND — der erste Stand
  // entstuende erst beim naechsten Anfassen eines Preisfelds. Der heutige Stand ist keine Erfindung:
  // es sind die selbst eingetragenen Preise, datiert auf den Tag, an dem wir sie erstmals sehen.
  function adoptPrices(){
    if(!VAULT) return;
    const h=VAULT.priceHistory;
    if(Array.isArray(h) && h.length) return;             // Historie laeuft schon
    snapPrices();                                        // prueft selbst auf leere Preise und auf die Uhr
  }
  // Nach dem Sperren darf nichts Entschlüsseltes im (versteckten) DOM lesbar bleiben
  function clearRendered(){
    ['dash-stats','dash-value','chart-head','chart-wrap','export-msg','setup-meter','cp-meter','bio-alert'].forEach(id=>{const el=$(id);if(el)el.innerHTML='';});   // bio-alert: Rückmeldung Alien Pas
    { const bk=$('bio-keep'); if(bk) bk.checked=false; }   // „auch nach Neustart“ nie stehen lassen (ab Werk aus)s H3
    const t=$('list-tbl'); t.querySelector('thead').innerHTML=''; t.querySelector('tbody').innerHTML=''; closeMenus();
    resetAddForm();
    // Overlays liegen als direkte body-Kinder ueber den screen-*-Containern: boot() blendet sie NICHT aus.
    // Ohne das blieb das Nachlass-Blatt (Klasse B) nach dem Sperren auf dem Schirm stehen — und weil das
    // Druck-CSS alles ausser #nachlass-overlay ausblendet, war es am gesperrten Tresor vorbei druckbar.
    closeNachlass(); closeHelp(); dialogClose(false); hideToast();   // offene Rückfrage verfällt (Aufrufer sieht false), Toast samt „Rückgängig“ weg (v3.5)
    chartState=null;                                     // aus Klartext abgeleitete Zeitreihe nicht im Heap lassen
    ['f-src-btc','f-src-metal','f-date','import-pass','totp-code','totp-verify','cp-cur','cp1','cp2',
     'nl-fassung','price-btc','price-gold','price-silver'].forEach(i=>{const el=$(i);if(el)el.value='';});
    $('totp-secret').textContent=''; App._otpauth='';
    const q=$('totp-qr'); if(q&&q.width){const cx=q.getContext('2d');cx.clearRect(0,0,q.width,q.height);}
    pendingSecret=null; pendingImportBlob=null; hide('import-pass-box'); hide('totp-setup'); err('bio-err');
  }
  function lock(){ clearIdle(); DEK=null; KDF=null; WRAP=null; VAULT=null; pendingUnlock=null;
    bioGen++; bioRearmDek=null; bioArmed=false; bioNeedsRearm=false;   // laufende Fingerabdruck-Vorgänge verfallen (Generation)
    if(DESK) DESK.clip.clear().catch(()=>{});                            // eigene Kopie (TOTP-Geheimnis) aus der Zwischenablage nehmen
    clearRendered(); maskInputs(); boot(); }
  // „Jetzt sperren“ = die EINZIGE bewusste Nutzer-Sperre: setzt den Riegel (nächster Start nur mit Passphrase). Idle-Timer,
  // Hintergrund und interne Aufrufe bleiben bei lock() und setzen nie einen Riegel.
  function lockNow(){ if(BIO&&(bioArmed||bioBlob())) setBioHold(true); bioAuto=false; lock(); }
  // Abbruch am Aegis-Gate: kein Riegel, aber auch kein Auto-Prompt (sonst Schleife Fingerabdruck → Gate → Abbruch → Fingerabdruck)
  function cancelTotp(){ bioAuto=false; lock(); }
  // Auge im Passwortfeld (statt „anzeigen“-Kästchen, Muster Alien Pass): Knopf mit data-showpass=<Feld-ID>, Zustand in aria-pressed
  function setEye(b,on){ b.setAttribute('aria-pressed',on?'true':'false'); b.dataset.showpass.split(',').forEach(id=>{ const f=$(id); if(f) f.type=on?'text':'password'; }); }
  function togglePass(_,b){ if(b) setEye(b,b.getAttribute('aria-pressed')!=='true'); }
  function maskInputs(){ document.querySelectorAll('[data-showpass]').forEach(b=>setEye(b,false)); }
  // Getippte Passphrasen und Codes nie stehen lassen, wenn die App in den Hintergrund geht — auch im gesperrten Zustand
  // (Audit run-4 #2, Port von Alien Pass run-2 F1). Nebenwirkung wie dort: halb ausgefüllte Formulare sind danach leer.
  function clearGateInputs(){ ['lock-pass','setup-pass1','setup-pass2','import-pass','totp-code','cp-cur','cp1','cp2','bio-pass'].forEach(id=>{ const n=$(id); if(n) n.value=''; }); maskInputs(); }
  function enhancePassFields(){ document.querySelectorAll('input[type=password]').forEach(inp=>{ if(!inp.id||inp.closest('.pw-wrap')) return;
    const w=document.createElement('div'), b=document.createElement('button'); w.className='pw-wrap'; b.className='pw-eye'; b.type='button';
    b.dataset.showpass=inp.id; b.setAttribute('aria-pressed','false'); b.title=tr('pw.toggle'); inp.parentNode.insertBefore(w,inp); w.append(inp,b); }); }
  ['click','keydown','touchstart','scroll','mousemove'].forEach(ev=>
    document.addEventListener(ev, activity, {passive:true}));
  // Backgrounding: setTimeout pausiert in eingefrorenen WebViews — beim Zurückkehren
  // die tatsächlich verstrichene Zeit prüfen und ggf. sofort sperren.
  // onHidden/onShown: ein Rumpf für beide Quellen — visibilitychange (Android/Browser) und die Desktop-Hülle (DESK.onBackground: dort
  // ist die Page Visibility API durch backgroundThrottling:false abgeschaltet, der Hauptprozess meldet minimiert/versteckt selbst).
  // Riegel bgAway gegen doppelte Signale (minimize + hide feuern beide) — sonst rückte hiddenAt nach vorn und die Wegzeit schrumpfte.
  let hiddenAt=0, bgAway=false;
  function onHidden(){
    clearGateInputs();                               // vor jeder Sitzungsprüfung: gilt gerade im gesperrten Zustand
    if(bgAway) return; bgAway=true;
    const v=VAULT||(pendingUnlock&&pendingUnlock.vault);
    if(v) hiddenAt=Date.now();
  }
  function onShown(){
    bgAway=false;
    if(!DEK&&!pendingUnlock){ if(bioArmed&&bioAuto&&!$('screen-lock').classList.contains('hidden')) doBio(); return; }   // zurück auf dem Sperrbildschirm
    const v=VAULT||(pendingUnlock&&pendingUnlock.vault);
    if(!v) return;
    const mins = v.autolock==null?5:v.autolock;
    const away=hiddenAt?Date.now()-hiddenAt:0; hiddenAt=0;
    if(mins && away>mins*60000){ lock(); toast(tr('toast.autolocked')); }
    else resetIdle();
  }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) onHidden(); else onShown(); });
  // Desktop: 'blur' (Fensterwechsel) ist KEIN Hintergrund — feuert auch bei Systemdialogen (Portal-Dateidialog) → nur Gate-Hygiene
  if(DESK&&typeof DESK.onBackground==='function') DESK.onBackground(h=>{ if(h==='blur') clearGateInputs(); else if(h) onHidden(); else onShown(); });
  if(DESK&&typeof DESK.onLock==='function') DESK.onLock(()=>{ if(DEK||pendingUnlock) lock(); });   // Ruhezustand/Bildschirmsperre (im Flatpak tot, s. DESKTOP-INVARIANTEN.md)
  // Desktop-Tastenkürzel: Strg+L = „Jetzt sperren“ (nur mit Hülle, nur entsperrt oder in der Aegis-Wartestellung)
  function deskKey(ev){ if(!DESK||!ev.ctrlKey||ev.altKey||ev.metaKey) return false;
    if((ev.key==='l'||ev.key==='L')&&(DEK||pendingUnlock)){ lockNow(); return true; }
    if(dlgResolve) return true;   // offene Rückfrage: kein Strg-Kürzel daran vorbei (nur Sperren) — Muster Alien Pass v1.9
    return false; }

  /* ---------- tabs ---------- */
  function tab(name){
    if(name!=='add' && editId) exitEditMode();    // Bearbeiten abbrechen, wenn man den Tab verlässt
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
    document.querySelectorAll('.tabview').forEach(v=>v.classList.add('hidden'));
    $('tab-'+name).classList.remove('hidden');
    if(name==='dash') renderDash();
    if(name==='list') renderList();
    if(name==='verlauf') renderVerlauf();
    if(name==='settings') renderSettings();
    if(name==='add'){ if(!$('f-date').value) $('f-date').value=todayStr(); refreshAddLabels(); }
  }
  function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

  /* ---------- add entry ---------- */
  function setAddType(t){addType=t;document.querySelectorAll('#add-type button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
    $('fields-btc').classList.toggle('hidden',t!=='btc');
    $('fields-metal').classList.toggle('hidden',t==='btc');
    refreshAddLabels(); if(t!=='btc') updateMetalPreview();}
  function setAddDir(d){addDir=d;document.querySelectorAll('#add-dir button').forEach(b=>b.classList.toggle('on',b.dataset.d===d));refreshAddLabels();}
  function refreshAddLabels(){
    const isSell=addDir==='sell', isWd=addDir==='withdraw';
    $('add-title').textContent = editId?tr('add.titleEdit'):(isSell?tr('add.titleSell'):isWd?tr('add.titleWd'):tr('add.titleBuy'));
    $('f-eur-wrap').classList.toggle('hidden', isWd);
    $('f-cur-wrap').classList.toggle('hidden', isWd);
    const cur=$('f-cur').value;
    $('f-eur-label').textContent = (isSell?tr('add.eurSell'):tr('add.eurBuy')).replace('{cur}',cur);
    $('f-eurref-wrap').classList.toggle('hidden', isWd||cur==='EUR');
    $('f-src-btc-label').textContent = (isSell||isWd)?tr('add.srcSell'):tr('add.srcBuy');
    // KYC-Auswahl je nach Richtung beschriften (Steuertool: Kauf=kyc, Verkauf=no_kyc)
    $('f-kyc-wrap').classList.toggle('hidden', isWd);
    if(!isWd){
      $('f-kyc-label').textContent = isSell?tr('add.sellFrom'):tr('add.kycQ');
      const sel=$('f-kyc');
      sel.options[0].text = isSell?tr('add.kycSellNo'):tr('add.kycBuyNo');
      sel.options[1].text = isSell?tr('add.kycSellYes'):tr('add.kycBuyYes');
    }
    refreshBtcInputUI(); syncCombos();   // KYC-Texte und Währung/Stückelung (resetAddForm) → Knopfbeschriftungen
  }
  // Eingabe-Umschalter BTC/Sats: vorhandener Feldwert wird beim Umschalten mitkonvertiert
  function setInputBtcUnit(u){
    if(u!==addBtcUnit){
      const f=$('f-btc'), v=parseFloat(f.value);
      if(!isNaN(v)) f.value = u==='sat' ? String(Math.round(v*SATS)) : String(+(v/SATS).toFixed(8));
      addBtcUnit=u;
    }
    refreshBtcInputUI();
  }
  function refreshBtcInputUI(){
    const sat=addBtcUnit==='sat';
    $('f-btcu-btc').classList.toggle('on',!sat); $('f-btcu-sat').classList.toggle('on',sat);
    $('f-btc-label').textContent=tr(sat?'add.amtSat':'add.amtBtc');
    const f=$('f-btc'); f.placeholder=sat?'263717':'0.00263717'; f.step=sat?'1':'any';
  }
  function toGrams(qty,unit){qty=parseFloat(qty)||0;if(unit==='oz')return qty*31.1034768;if(unit==='kg')return qty*1000;return qty;}
  function unitFactor(u){return u==='oz'?31.1034768:u==='kg'?1000:1;}
  // Gewicht je Stück + Einheit aus Dropdown (oder Custom-Feldern)
  function readDenom(){
    const d=$('f-denom').value;
    if(d==='custom') return {qty:parseFloat($('f-qty').value), unit:$('f-unit').value};
    const p=d.split('|'); return {qty:parseFloat(p[0]), unit:p[1]};
  }
  function onDenomChange(){ $('f-custom-wrap').classList.toggle('hidden', $('f-denom').value!=='custom'); updateMetalPreview(); }
  function updateMetalPreview(){
    const el=$('metal-preview'); if(!el) return;
    const {qty,unit}=readDenom(); const count=parseInt($('f-count').value);
    if(!(qty>0)||!(count>0)){ el.textContent=''; return; }
    const u=VAULT&&VAULT.unit||'oz', g=toGrams(qty,unit)*count;
    const tot=u==='oz'?g/OZ_G:g;
    el.textContent=`${tr('preview.totalPrefix')}${count} × ${fmtNum(qty,unit==='g'?0:4)} ${unit} = ${fmtNum(tot,u==='oz'?4:2)} ${u} (${tr('preview.gross')})`;
  }
  function resetAddForm(){
    ['f-eur','f-eurref','f-btc','f-qty','f-fine','f-note'].forEach(i=>$(i).value='');
    addBtcUnit=btcUnit();               // Eingabe-Einheit folgt der Anzeige-Einstellung
    $('f-count').value='1'; $('f-denom').value='1|oz'; $('f-cur').value='EUR';
    $('f-custom-wrap').classList.add('hidden'); updateMetalPreview(); refreshAddLabels();
  }
  function onCurChange(){ refreshAddLabels(); }

  /* ---------- eigene Auswahlfelder (v2.10, Muster Alien Pass v1.5) ----------
     Die aufgeklappte System-Liste der WebView ist grau und nicht gestaltbar. Das native <select> bleibt als
     unsichtbarer Wertspeicher (.combo-native): alle .value-Leser und die data-change-Delegation gelten unverändert.
     Darüber Knopf #cb-<id> + Menü #cm-<id>. Optionen ausschließlich per textContent. */
  function closeMenus(){ document.querySelectorAll('.combo-menu').forEach(m=>{ m.classList.add('hidden'); m.replaceChildren(); }); }
  function syncCombo(id){ const sel=$(id), lab=$('cb-'+id); if(!sel||!lab) return; const o=sel.options[sel.selectedIndex]; lab.textContent=o?o.textContent:''; }
  function syncCombos(){ document.querySelectorAll('.combo-native').forEach(sel=>syncCombo(sel.id)); }
  function toggleCombo(id){ const menu=$('cm-'+id), sel=$(id); if(!menu||!sel) return;
    const wasOpen=!menu.classList.contains('hidden'); closeMenus(); if(wasOpen) return;
    for(const o of sel.options){ const b=document.createElement('button'); b.className='combo-opt'+(o.value===sel.value?' on':'');
      b.textContent=o.textContent; b.dataset.action='chooseOpt'; b.dataset.arg=o.value; b.dataset.sel=id; menu.appendChild(b); }
    menu.classList.remove('hidden'); }
  function chooseOpt(value, elx){ const sel=$(elx&&elx.dataset.sel); closeMenus();
    // nur echte Optionen eines Wertspeichers (fremder Wert → selectedIndex -1 → z.B. Auto-Sperre still aus); gleicher Wert → kein change (sonst persist + Toast)
    if(!sel||!sel.classList.contains('combo-native')||!Array.from(sel.options).some(o=>o.value===value)||sel.value===value) return;
    sel.value=value; syncCombo(sel.id);
    sel.dispatchEvent(new Event('change',{bubbles:true})); }   // die bestehende change-Delegation übernimmt von hier
  async function addEntry(){
    err('add-err');
    const date=$('f-date').value;
    const isWd=addDir==='withdraw';
    const eur=isWd?0:parseFloat($('f-eur').value);
    const cur=(!isWd && ['USD','CHF'].indexOf($('f-cur').value)>=0)?$('f-cur').value:'EUR';
    if(!date) return err('add-err',tr('err.dateMissing'));
    if(!isWd && !(eur>=0)) return err('add-err',tr('err.eurInvalid'));
    const e={id: editId||cryptoId(), type:addType, dir:addDir, date, eur, cur, note:$('f-note').value.trim()};
    if(cur!=='EUR'){ const r=parseFloat($('f-eurref').value); if(r>0) e.eurRef=r; }
    if(addType==='btc'){
      let amt=parseFloat($('f-btc').value);
      if(addBtcUnit==='sat') amt=Math.round(amt)/SATS;   // Sats-Eingabe → intern immer BTC
      if(!(amt>0)) return err('add-err',tr('err.btcMissing'));
      e.btc=amt; e.source=$('f-src-btc').value.trim();
      if(addDir==='buy') e.kyc=$('f-kyc').selectedIndex===1;
      if(addDir==='sell') e.noKyc=$('f-kyc').selectedIndex===0;
    }else{
      const {qty, unit}=readDenom();
      const count=parseInt($('f-count').value);
      if(!(count>0)) return err('add-err',tr('err.countMissing'));
      if(!(qty>0)) return err('add-err',tr('err.weightMissing'));
      e.count=count; e.qty=qty; e.unit=unit;
      e.grams=toGrams(qty,unit)*count;               // Gesamt-Bruttogewicht = Stückzahl × Gewicht je Stück
      e.form=$('f-form').value; e.fineness=parseFloat($('f-fine').value)||null;
      e.source=$('f-src-metal').value.trim();
    }
    // Dubletten-Warnung (kein hartes Blockieren — echte Doppel-DCA am selben Tag soll möglich bleiben; sich selbst beim Bearbeiten ausnehmen)
    const dup=findDuplicate(e, editId);
    if(dup){
      const what=e.type==='btc'?fmtBtc(e.btc):e.count+'× '+fmtNum(e.qty,4)+' '+e.unit;
      const dirL=tr('dir.'+entryDir(e));
      const prev=dup.eur?' ('+fmtMoney(dup.eur,entryCur(dup))+(dup.source?', '+dup.source:'')+')':(dup.source?' ('+dup.source+')':'');
      const msg = LANG==='en'
        ? `Possible duplicate\n\nOn ${e.date} a ${dirL} of ${what}${prev} already exists.\n\nReally add it a second time?`
        : `Mögliches Duplikat\n\nAm ${e.date} ist bereits ein ${dirL} über ${what}${prev} erfasst.\n\nWirklich ein zweites Mal eintragen?`;
      const eid=editId;
      if(!(await ask(msg,{ok:'dlg.addAnyway'}))) return;
      if(!VAULT||editId!==eid) return;   // Sperre oder Abbruch während der Frage: das Formular ist nicht mehr dieser Stand
    }
    const wasEdit=!!editId;
    let undo=null;
    if(wasEdit){ const i=VAULT.entries.findIndex(x=>x.id===editId); if(i>=0){ undo=VAULT.entries[i]; VAULT.entries[i]=e; } }
    else VAULT.entries.push(e);
    persist().then(()=>{
      resetAddForm();
      if(wasEdit){ exitEditMode(); toast(tr('toast.updated')); tab('list'); }
      else { toast(addDir==='sell'?tr('toast.sellAdded'):addDir==='withdraw'?tr('toast.wdAdded'):tr('toast.buyAdded')); renderDash(); }
    }).catch(ex=>{
      if(ex&&ex.locked) return;   // inzwischen gesperrt: nichts zurückrollen (VAULT ist nicht mehr dieser Stand)
      // persist() zeigt bereits den Fehler-Toast — hier nur den RAM-Zustand zurückrollen (Anzeige == Speicher)
      if(wasEdit){ const i=VAULT.entries.findIndex(x=>x.id===e.id); if(i>=0&&undo) VAULT.entries[i]=undo; }
      else VAULT.entries.pop();
      renderDash();
    });
  }
  function exitEditMode(){ editId=null; $('add-btn').textContent=tr('add.btnAdd'); hide('add-cancel'); refreshAddLabels(); }
  function cancelEdit(){ resetAddForm(); exitEditMode(); tab('list'); }
  function editEntry(id){
    const e=VAULT.entries.find(x=>x.id===id); if(!e) return;
    editId=id;
    tab('add');                                   // wechselt Tab; setzt Datum nur falls leer
    setAddDir(entryDir(e)); setAddType(e.type);
    $('f-date').value=e.date;
    $('f-note').value=e.note||'';
    $('f-eur').value=(entryDir(e)==='withdraw')?'':(e.eur!=null?e.eur:'');
    $('f-cur').value=entryCur(e);
    $('f-eurref').value=e.eurRef!=null?e.eurRef:'';
    refreshAddLabels();
    if(e.type==='btc'){
      $('f-btc').value=e.btc!=null?(addBtcUnit==='sat'?String(Math.round(e.btc*SATS)):e.btc):'';
      $('f-src-btc').value=e.source||'';
      if(entryDir(e)==='buy') $('f-kyc').selectedIndex = e.kyc?1:0;
      else if(entryDir(e)==='sell') $('f-kyc').selectedIndex = e.noKyc?0:1;
    }else{
      $('f-count').value=e.count!=null?e.count:'1';
      const key=(e.qty!=null?e.qty:'')+'|'+(e.unit||'g');
      const denom=$('f-denom'), has=Array.from(denom.options).some(o=>o.value===key);
      if(has){ denom.value=key; $('f-custom-wrap').classList.add('hidden'); $('f-qty').value=''; }
      else { denom.value='custom'; $('f-custom-wrap').classList.remove('hidden'); $('f-qty').value=e.qty!=null?e.qty:''; $('f-unit').value=e.unit||'g'; }
      $('f-form').value=e.form||'Münze'; $('f-fine').value=e.fineness!=null?e.fineness:'';
      $('f-src-metal').value=e.source||'';
      updateMetalPreview();
    }
    syncCombos();
    $('add-title').textContent=tr('add.titleEdit');
    $('add-btn').textContent=tr('add.btnSave');
    show('add-cancel');
    err('add-err');
  }
  function entryDir(e){return e.dir||'buy';}     // Altdaten ohne dir = Kauf
  function entryCur(e){return e.cur==='USD'||e.cur==='CHF'?e.cur:'EUR';}   // Altdaten ohne cur = EUR
  // EUR-Basis einer Buchung (für Steuertool-Export + Wert-Vergleich): EUR direkt,
  // Fremdwährung nur mit erfasstem EUR-Gegenwert vom Buchungstag — sonst null.
  function eurBasis(e){return entryCur(e)==='EUR'?e.eur:(e.eurRef>0?e.eurRef:null);}
  function signedAmt(e,amt){return entryDir(e)==='buy'?amt:-amt;}
  // Dubletten-Erkennung: gleicher Typ + Richtung + Datum + Menge (BTC auf Satoshi, Metall auf 0,1mg genau)
  function amtKey(e){return e.type==='btc'?'b'+(e.btc||0).toFixed(8):'m'+(e.grams||0).toFixed(4);}
  function dupKey(e){return e.type+'|'+entryDir(e)+'|'+e.date+'|'+amtKey(e);}
  function findDuplicate(e,excludeId){const k=dupKey(e);return VAULT.entries.find(x=>x.id!==excludeId&&dupKey(x)===k);}
  function cryptoId(){const a=crypto.getRandomValues(new Uint8Array(8));return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');}
  // Löschen mit eigener Rückfrage (Kennzeile Datum · Richtung · Menge) und „Rückgängig“ im Toast (v3.5): der Tresor hat keinen Papierkorb,
  // deshalb kommt der Eintrag nur für UNDO_MS an seine alte Stelle zurück. Nach dem await: Sperre/Import/zweites Löschen → Eintrag frisch suchen.
  async function delEntry(id){ const e0=VAULT?VAULT.entries.find(x=>x.id===id):null; if(!e0) return;
    const what=e0.type==='btc'?fmtBtc(e0.btc):e0.count+'× '+fmtNum(e0.qty,4)+' '+e0.unit;
    if(!(await ask(tr('confirm.delete')+'\n\n'+e0.date+' · '+tr('dir.'+entryDir(e0))+' · '+what,{ok:'dlg.delete',danger:true}))) return;
    if(!VAULT) return; const e=VAULT.entries.find(x=>x.id===id); if(!e) return; const i=VAULT.entries.indexOf(e);
    const before=VAULT.entries; VAULT.entries=VAULT.entries.filter(x=>x!==e);
    persist().then(()=>{ if(!VAULT) return; renderList();renderDash();toast(tr('toast.deletedShort'),{action:{label:tr('toast.undo'),fn:()=>undoDelete(e,i)},ms:UNDO_MS}); }).catch(ex=>{ if(ex&&ex.locked) return; VAULT.entries=before; renderList(); }); }
  function undoDelete(e,i){ if(!VAULT) return; if(VAULT.entries.some(x=>x.id===e.id)) return toast(tr('toast.undoGone'));
    const before=VAULT.entries; VAULT.entries=before.slice(); VAULT.entries.splice(Math.min(i,VAULT.entries.length),0,e);
    persist().then(()=>{ if(!VAULT) return; renderList();renderDash();toast(tr('toast.restored')); }).catch(ex=>{ if(ex&&ex.locked) return; VAULT.entries=before; renderList(); }); }

  /* ---------- aggregates ---------- */
  const CURS=['EUR','USD','CHF'];
  function totals(){
    // Netto-Bestand = Käufe − Verkäufe − Entnahmen. Beträge werden je Währung getrennt
    // geführt (bewusst keine Kursumrechnung — die App kennt keine Kurse, kein Netz).
    // eurBase = Netto-EUR-Basis (EUR-Buchungen + erfasste EUR-Gegenwerte) für den Wert-Vergleich.
    const zero=()=>({EUR:0,USD:0,CHF:0});
    let btc=0,gold=0,silver=0;
    const inv={btc:zero(),gold:zero(),silver:zero()}, rel={btc:zero(),gold:zero(),silver:zero()};
    const eurBase={btc:0,gold:0,silver:0}, noBase={btc:0,gold:0,silver:0};
    for(const e of VAULT.entries){
      const d=entryDir(e), k=e.type, c=entryCur(e);
      if(k==='btc') btc+=signedAmt(e,e.btc);
      else{
        const fine=e.grams*((e.fineness||1000)/1000);
        if(k==='gold') gold+=signedAmt(e,fine); else silver+=signedAmt(e,fine);
      }
      if(d==='buy'||d==='sell'){
        (d==='buy'?inv:rel)[k][c]+=e.eur;
        const b=eurBasis(e);
        if(b==null) noBase[k]++; else eurBase[k]+=(d==='buy'?b:-b);
      }
    }
    const addObj=(...os)=>{const o=zero();for(const x of os)for(const c of CURS)o[c]+=x[c];return o;};
    const subObj=(a,b)=>{const o=zero();for(const c of CURS)o[c]=a[c]-b[c];return o;};
    const invTot=addObj(inv.btc,inv.gold,inv.silver), relTot=addObj(rel.btc,rel.gold,rel.silver);
    return {btc,gold,silver,inv,rel,invTot,relTot,netTot:subObj(invTot,relTot),
      eurBase,noBase,eurBaseTotal:eurBase.btc+eurBase.gold+eurBase.silver,
      noBaseTotal:noBase.btc+noBase.gold+noBase.silver};
  }
  const CUR_SYM={EUR:'€',USD:'$',CHF:'CHF'};
  const fmtMoney=(n,cur)=>(Number(n)||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(CUR_SYM[cur]||'€');
  const fmtEur = n => fmtMoney(n,'EUR');
  // Beträge je Währung als Liste ("1.200,00 € · 500,00 $") — Währungen ohne Betrag entfallen
  const fmtByCur=o=>{const p=CURS.filter(c=>o&&Math.abs(o[c])>0.004).map(c=>fmtMoney(o[c],c));return p.length?p.join(' · '):fmtEur(0);};
  const anyCur=o=>CURS.some(c=>o&&o[c]>0);
  const fmtNum = (n,d)=> (Number(n)||0).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});

  /* ---------- render dashboard ---------- */
  function renderDash(){
    const t=totals();
    const u=VAULT.unit||'oz';                 // Anzeige-Einheit für Edelmetall
    const inU=g=>u==='oz'?g/OZ_G:g;           // Feingramm -> Anzeige-Einheit
    const uL=u==='oz'?'oz':'g', uDec=u==='oz'?3:2;
    const subInv=(inv,rel)=>`${tr('stat.investedLbl')} ${fmtByCur(inv)}`+(anyCur(rel)?` · ${tr('stat.realizedLbl')} ${fmtByCur(rel)}`:'');
    $('dash-stats').innerHTML=bioAlertHtml()+backupHintHtml()+`
      <div class="stat btc"><div class="k">${tr('stat.btc')}</div><div class="v">${fmtBtc(t.btc)}</div><div class="sub">${subInv(t.inv.btc,t.rel.btc)}</div></div>
      <div class="stat gold"><div class="k">${tr('stat.gold')}</div><div class="v">${fmtNum(inU(t.gold),uDec)} ${uL}</div><div class="sub">${subInv(t.inv.gold,t.rel.gold)}</div></div>
      <div class="stat silver"><div class="k">${tr('stat.silver')}</div><div class="v">${fmtNum(inU(t.silver),uDec)} ${uL}</div><div class="sub">${subInv(t.inv.silver,t.rel.silver)}</div></div>
      <div class="stat total"><div class="k">${tr('stat.invested')}</div><div class="v">${fmtByCur(t.netTot)}</div><div class="sub">${VAULT.entries.length} ${tr('stat.investedSub')}${anyCur(t.relTot)?' · '+tr('stat.realized')+' '+fmtByCur(t.relTot):''}</div></div>`;
    // Einheiten-Toggle + Preis-Labels
    document.querySelectorAll('#metal-unit-seg button').forEach(b=>b.classList.toggle('on',b.dataset.u===u));
    document.querySelectorAll('#btc-unit-seg button').forEach(b=>b.classList.toggle('on',b.dataset.u===btcUnit()));
    $('price-gold-label').textContent=tr('price.gold')+uL; $('price-silver-label').textContent=tr('price.silver')+uL;
    // Preise: intern €/g gespeichert, Anzeige in gewählter Einheit
    const dispG=v=>{const n=parseFloat(v);return isNaN(n)?'':String(u==='oz'?+(n*OZ_G).toFixed(2):+n.toFixed(4));};
    // fokussiertes Feld nicht überschreiben — der Nutzer tippt dort gerade (Debounce-Rerender)
    const setIf=(id,v)=>{const el=$(id);if(document.activeElement!==el)el.value=v;};
    setIf('price-btc',VAULT.prices.btc||''); setIf('price-gold',dispG(VAULT.prices.gold)); setIf('price-silver',dispG(VAULT.prices.silver));
    const pb=parseFloat(VAULT.prices.btc), pg=parseFloat(VAULT.prices.gold), ps=parseFloat(VAULT.prices.silver); // pg/ps = €/g (intern)
    // Vergleichsbasis: netto investierte EUR-Basis der Klasse (EUR-Buchungen + EUR-Gegenwerte);
    // Fremdwährungs-Buchungen ohne EUR-Gegenwert fehlen darin → P/L als ≈ markieren.
    function valCard(label,cls,cur,netInv,approx){if(!(cur>0))return '';const pl=cur-netInv;const sign=pl>=0?'+':'';const col=pl>=0?'var(--neon)':'var(--red)';
      return `<div class="stat ${cls}"><div class="k">${label}</div><div class="v">${fmtEur(cur)}</div><div class="sub" style="color:${col}">${approx?'≈ ':''}${sign}${fmtEur(pl)} (${netInv>0?sign+fmtNum(pl/netInv*100,1)+'%':'–'})</div></div>`;}
    let html='';
    if(pb>0) html+=valCard(tr('val.btcNow'),'btc',t.btc*pb,t.eurBase.btc,t.noBase.btc>0);
    if(pg>0) html+=valCard(tr('val.goldNow'),'gold',t.gold*pg,t.eurBase.gold,t.noBase.gold>0);
    if(ps>0) html+=valCard(tr('val.silverNow'),'silver',t.silver*ps,t.eurBase.silver,t.noBase.silver>0);
    const totCur=(pb>0?t.btc*pb:0)+(pg>0?t.gold*pg:0)+(ps>0?t.silver*ps:0);
    if(pb>0||pg>0||ps>0){const base=t.eurBaseTotal;const pl=totCur-base;const s=pl>=0?'+':'';const c=pl>=0?'var(--neon)':'var(--red)';
      html+=`<div class="stat total"><div class="k">${tr('val.totalNow')}</div><div class="v">${fmtEur(totCur)}</div><div class="sub" style="color:${c}">${t.noBaseTotal>0?'≈ ':''}${s}${fmtEur(pl)} ${tr('val.vsInvested')}</div></div>`;}
    if(html && t.noBaseTotal>0) html+=`<p class="muted" style="grid-column:1/-1;font-size:.78rem;margin:2px 0 0">${tr('val.noBaseHint').replace('{n}',t.noBaseTotal)}</p>`;
    $('dash-value').innerHTML=html||('<p class="muted">'+tr('dash.pricesHint')+'</p>');
  }
  function savePrices(){
    const u=VAULT.unit||'oz';
    const toG=v=>{v=(v||'').trim();if(v==='')return '';const n=parseFloat(v);if(isNaN(n))return '';return String(u==='oz'?n/OZ_G:n);};
    VAULT.prices={btc:$('price-btc').value,gold:toG($('price-gold').value),silver:toG($('price-silver').value)};
    persist();clearTimeout(savePrices._t);savePrices._t=setTimeout(()=>{if(!VAULT)return;snapPrices();renderDash();},400);
  }
  // Datierter Preisstand fuer die Wertlinie. Laeuft NUR aus dem entprellten Timer von savePrices —
  // sonst landete jeder Tastendruck ("5", "58", "580") als eigener Stand in der Historie.
  // Ein Eintrag je Kalendertag, der letzte des Tages gewinnt; unveraenderte Preise erzeugen keinen Punkt.
  function snapPrices(){
    if(!VAULT) return;
    const p=VAULT.prices||{};
    if(!p.btc && !p.gold && !p.silver) return;
    if(!Array.isArray(VAULT.priceHistory)) VAULT.priceHistory=[];
    const h=VAULT.priceHistory, d=todayStr();
    if(!validDay(d)) return;                                 // unbrauchbare Geraeteuhr -> lieber kein Stand
    const snap={d, btc:p.btc||'', gold:p.gold||'', silver:p.silver||''};
    // Den Stand DES TAGES suchen, nicht das letzte Array-Element: nach einem Import steht dort nicht
    // zwingend heute, und die Zusicherung "ein Eintrag je Kalendertag" broeckelte (Audit run-3).
    const i=h.findIndex(x=>x&&x.d===d), last=i>=0?h[i]:(h.length?h[h.length-1]:null);
    const same=a=>a&&a.btc===snap.btc&&a.gold===snap.gold&&a.silver===snap.silver;
    if(same(last)) return;                                   // Preise unveraendert -> kein neuer Punkt
    if(i>=0) h[i]=snap; else h.push(snap);
    h.sort((a,b)=>String(a&&a.d).localeCompare(String(b&&b.d)));
    if(h.length>PRICE_HIST_MAX) h.splice(0,h.length-PRICE_HIST_MAX);
    persist().catch(()=>{});
  }
  function setMetalUnit(u){VAULT.unit=u;persist();renderDash();}
  function setBtcUnit(u){VAULT.btcUnit=(u==='sat'?'sat':'btc');addBtcUnit=VAULT.btcUnit;persist();renderDash();}
  function setAutolock(v){VAULT.autolock=parseInt(v)||0;persist();resetIdle();toast(VAULT.autolock?tr('toast.autolockPrefix')+VAULT.autolock+' '+tr('unit.min'):tr('toast.autolockOff'));}

  /* ---------- render list ---------- */
  function setFilter(f){listFilter=f;document.querySelectorAll('#list-filter button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));renderList();}
  function renderList(){
    const rows=VAULT.entries.filter(e=>listFilter==='all'||e.type===listFilter).sort((a,b)=>b.date.localeCompare(a.date));
    const tb=$('list-tbl').querySelector('tbody'), th=$('list-tbl').querySelector('thead');
    if(!rows.length){$('list-tbl').classList.add('hidden');show('list-empty');return;}
    $('list-tbl').classList.remove('hidden');hide('list-empty');
    // Dubletten zählen (über alle Einträge, nicht nur die gefilterten)
    const dupCount={};VAULT.entries.forEach(e=>{const k=dupKey(e);dupCount[k]=(dupCount[k]||0)+1;});
    th.innerHTML=`<tr><th>${tr('col.date')}</th><th>${tr('col.dir')}</th><th>${tr('col.type')}</th><th>${tr('col.amount')}</th><th>${tr('col.detail')}</th><th>${tr('col.eur')}</th><th>${tr('col.src')}</th><th></th></tr>`;
    tb.innerHTML=rows.map(e=>{
      const d=entryDir(e);
      const isDup=dupCount[dupKey(e)]>1;
      const dirPill = d==='buy'?'<span class="pill dir-buy">＋ '+tr('dir.buy')+'</span>'
        : d==='sell'?'<span class="pill dir-sell">－ '+tr('dir.sell')+'</span>'
        : '<span class="pill dir-wd">↗ '+tr('dir.withdraw')+'</span>';
      const sgn = d==='buy'?'':'−';
      // Alle Eintragsfelder escapen — Einträge können aus importierten .vault-Dateien stammen
      const esc=escapeHtml, idSafe=String(e.id||'').replace(/[^0-9a-zA-Z_-]/g,'');
      let menge,detail,pill;
      if(e.type==='btc'){menge=sgn+fmtBtc(e.btc);
        detail = d==='buy'?(e.kyc?'<span class="pill kyc">KYC</span>':'<span class="pill nokyc">noKYC</span>')
               : d==='sell'?(e.noKyc?'<span class="pill nokyc">'+tr('pill.nokycHold')+'</span>':'<span class="pill kyc">'+tr('pill.kycHold')+'</span>')
               : '';
        pill='<span class="pill btc">BTC</span>';}
      else{const totU=e.grams/unitFactor(e.unit);menge=sgn+fmtNum(totU,e.unit==='g'?2:4)+' '+esc(e.unit);detail=(e.count?esc(String(e.count))+'× ':'')+fmtNum(e.qty,e.unit==='g'?0:4)+' '+esc(e.unit)+(e.form?' '+esc(e.form):'')+(e.fineness?' · '+esc(String(e.fineness))+'‰':'');pill=`<span class="pill ${e.type==='gold'?'gold':'silver'}">${e.type==='gold'?tr('pill.gold'):tr('pill.silver')}</span>`;}
      const eurCell = d==='withdraw'?'<span class="muted">–</span>'
        :fmtMoney(e.eur,entryCur(e))+((entryCur(e)!=='EUR'&&e.eurRef>0)?' <span class="muted" style="font-size:.85em;white-space:nowrap">≈ '+fmtEur(e.eurRef)+'</span>':'');
      const dupBadge = isDup?' <span class="pill dup" title="'+tr('pill.dupTitle')+'"><svg class="ic" viewBox="0 0 24 24" style="width:.85em;height:.85em"><path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg> '+tr('pill.dupQ')+'</span>':'';
      return `<tr${isDup?' class="dup-row"':''}><td>${esc(e.date)}</td><td>${dirPill}</td><td>${pill}</td><td>${menge}</td><td>${detail}${e.note?' · '+esc(e.note):''}${dupBadge}</td><td>${eurCell}</td><td>${esc(e.source||'')}</td><td style="white-space:nowrap"><button class="del-x" title="${tr('tip.edit')}" data-action="editEntry" data-arg="${idSafe}">✎</button> <button class="del-x" title="${tr('tip.del')}" data-action="delEntry" data-arg="${idSafe}">✕</button></td></tr>`;
    }).join('');
  }
  function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  /* ---------- Verlauf / Vermögensentwicklung (reines SVG, keine Netzabfrage) ---------- */
  // Zwei Reihen: der Einstand (kumuliertes Netto-Kapital aus den Buchungen) und — sobald Preisstände
  // vorliegen — der Wert (Bestand × selbst eingetragener Preis aus VAULT.priceHistory). Die App fragt
  // NIE einen Kurs ab (CSP connect-src 'none'); die Wertlinie ist so dicht wie die eigene Preispflege.
  const dayT = d => Date.parse(d+'T12:00:00Z');
  const isoOf = ts => new Date(ts).toISOString().slice(0,10);
  // Ein Datum muss nicht nur die FORM stimmen, sondern auch existieren: '9999-99-99' passt auf die
  // Regex, ergibt aber NaN und zieht NaN-Koordinaten durch den ganzen Chart. Und ein Preisstand aus
  // der Zukunft ergibt fachlich nie Sinn — er bliebe fuer immer der letzte Punkt der Wertreihe
  // (Audit run-3, Fund B-2/C-1: falsch gehende Geraeteuhr oder praeparierte .vault).
  function validDay(d){
    if(typeof d!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const t=dayT(d);
    return isFinite(t) && isoOf(t)===d;
  }
  const notFuture = d => validDay(d) && d<=todayStr();
  let chartState=null;                     // Zeichen-Geometrie für den Tooltip (Pointer -> Datenpunkt)

  function setChartSeries(s){chartSeries=s;document.querySelectorAll('#chart-series button').forEach(b=>b.classList.toggle('on',b.dataset.s===s));renderVerlauf();}
  function setChartRange(r){chartRange=r;renderVerlauf();}
  function seriesMeta(){
    const u=VAULT.unit||'oz', uL=u==='oz'?'oz':'g';
    return {
      invested:{label:tr('series.invested'),color:'var(--neon)',fmt:v=>fmtEur(v)},
      btc:{label:tr('series.btc'),color:'var(--btc)',fmt:v=>fmtBtc(v)},
      gold:{label:tr('series.gold'),color:'var(--gold)',fmt:v=>fmtNum(u==='oz'?v/OZ_G:v,u==='oz'?3:2)+' '+uL},
      silver:{label:tr('series.silver'),color:'var(--silver)',fmt:v=>fmtNum(u==='oz'?v/OZ_G:v,u==='oz'?3:2)+' '+uL},
    }[chartSeries];
  }
  function cumSeries(){
    // kumulative Zeitreihe aus den Buchungen (nach Datum sortiert). Werte intern: invested in EUR-Basis
    // (Fremdwährung nur mit EUR-Gegenwert — sonst übersprungen und gezählt), Metall in Feingramm.
    const evs=VAULT.entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
    let cum=0, skippedFx=0; const pts=[];
    for(const e of evs){
      const d=entryDir(e); let delta=0;
      if(chartSeries==='invested'){                                  // Entnahme bewegt kein Kapital
        if(d==='buy'||d==='sell'){ const b=eurBasis(e); if(b==null) skippedFx++; else delta=(d==='buy'?b:-b); }
      }
      else if(chartSeries===e.type){
        const amt = e.type==='btc'? e.btc : e.grams*((e.fineness||1000)/1000);
        delta = signedAmt(e, amt);
      }
      cum+=delta; pts.push({t:dayT(e.date), val:cum, date:e.date});
    }
    // bei mehreren Buchungen am selben Tag nur den letzten Kumulwert je Tag behalten
    const byDay=new Map(); for(const p of pts) byDay.set(p.date,p);
    return {pts:Array.from(byDay.values()).sort((a,b)=>a.t-b.t), skippedFx};
  }
  function holdSeries(){
    // kumulierte Netto-Bestände je Buchungstag über alle drei Typen (Metalle in Feingramm)
    const evs=VAULT.entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
    const acc={btc:0,gold:0,silver:0}; const byDay=new Map();
    for(const e of evs){
      const amt = e.type==='btc'? e.btc : e.grams*((e.fineness||1000)/1000);
      acc[e.type]+=signedAmt(e, amt);
      byDay.set(e.date,{t:dayT(e.date), date:e.date, btc:acc.btc, gold:acc.gold, silver:acc.silver});
    }
    return Array.from(byDay.values()).sort((a,b)=>a.t-b.t);
  }
  function priceSnaps(){
    // Lesepfad-Riegel: heilt auch Tresore, in denen schon ein unsinniger Stand liegt.
    const h=Array.isArray(VAULT.priceHistory)?VAULT.priceHistory:[];
    return h.filter(s=>s&&notFuture(s.d)).slice().sort((a,b)=>a.d.localeCompare(b.d));
  }
  function valueSeries(){
    // Stichtage = Preisstände + Buchungstage ab dem ersten Preisstand + heute.
    // Bewertet wird mit dem letzten bekannten Preis vor oder an diesem Tag (der Preis hält).
    const snaps=priceSnaps();
    if(!snaps.length) return {pts:[], missing:0, first:''};
    const hold=holdSeries();
    if(!hold.length) return {pts:[], missing:0, first:''};   // ohne Buchungen gibt es keinen Bestand und damit keinen Wert
    const days=new Set(snaps.map(s=>s.d));
    for(const h of hold) if(h.date>=snaps[0].d) days.add(h.date);
    days.add(todayStr());
    let hi=-1, si=-1, cur={btc:0,gold:0,silver:0}; const pts=[];
    for(const d of Array.from(days).sort()){
      while(hi+1<hold.length && hold[hi+1].date<=d){ hi++; cur=hold[hi]; }
      while(si+1<snaps.length && snaps[si+1].d<=d) si++;
      if(si<0) continue;                                   // Tag liegt vor dem ersten Preisstand
      const sn=snaps[si];
      const pb=parseFloat(sn.btc)||0, pg=parseFloat(sn.gold)||0, ps=parseFloat(sn.silver)||0;
      pts.push({t:dayT(d), date:d, val:(cur.btc||0)*pb+(cur.gold||0)*pg+(cur.silver||0)*ps});
    }
    // Bestände ohne Preis fehlen still in der Summe -> zählen und darunter ehrlich ausweisen
    const lastSnap=snaps[snaps.length-1], lastHold=hold.length?hold[hold.length-1]:null;
    let missing=0;
    if(lastHold) for(const k of ['btc','gold','silver'])
      if((lastHold[k]||0)>0.0000001 && !(parseFloat(lastSnap[k])>0)) missing++;
    return {pts, missing, first:snaps[0].d};
  }
  function rangeFrom(r){
    const n=new Date();
    if(r==='ytd') return Date.UTC(n.getFullYear(),0,1);
    const y={y1:1,y3:3,y5:5}[r];
    return y?Date.UTC(n.getFullYear()-y, n.getMonth(), n.getDate()):null;   // 'max' = alles
  }
  function clipPts(pts, from){
    // Der erste Punkt eines Fensters ist der Stand ZU BEGINN des Fensters, nicht die erste Buchung
    // darin — sonst startet der Verlauf fälschlich bei null.
    if(from==null || !pts.length) return pts;
    const inside=pts.filter(p=>p.t>=from);
    let before=null; for(const p of pts) if(p.t<from) before=p;
    if(before) inside.unshift({t:from, date:isoOf(from), val:before.val, edge:true});
    return inside;
  }
  function updateRangeButtons(pts){
    document.querySelectorAll('#chart-range button').forEach(b=>{
      const f=rangeFrom(b.dataset.r);
      const n=f==null?pts.length:clipPts(pts,f).length;
      b.disabled = n<2 && b.dataset.r!=='max';
      b.classList.toggle('on', b.dataset.r===chartRange);
    });
  }
  function renderVerlauf(){
    const m=seriesMeta(), {pts,skippedFx}=cumSeries();
    const withValue = chartSeries==='invested';
    const vs = withValue ? valueSeries() : {pts:[], missing:0, first:''};
    const head=$('chart-head'), wrap=$('chart-wrap'), empty=$('chart-empty');
    let from=rangeFrom(chartRange);
    let cp=clipPts(pts,from), cv=clipPts(vs.pts,from);
    if(from!=null && cp.length<2 && cv.length<2){ chartRange='max'; from=null; cp=pts; cv=vs.pts; }
    updateRangeButtons(pts.concat(vs.pts));

    const cur = cp.length? cp[cp.length-1].val : 0;
    const peakPts = (withValue && cv.length>1) ? cv : cp;               // Höchststand der Reihe, die auch gezeichnet wird
    const peak = peakPts.length? Math.max(...peakPts.map(p=>p.val)) : 0;
    let cards=`<div class="stat"><div class="k">${withValue?tr('ov.invested'):m.label+' '+tr('ov.now')}</div><div class="v" style="color:${withValue&&cv.length?'var(--text-mid)':m.color}">${m.fmt(cur)}</div></div>`;
    if(withValue && cv.length){
      const val=cv[cv.length-1].val, pl=val-cur, sg=pl>=0?'+':'', col=pl>=0?'var(--neon)':'var(--red)';
      const pct=cur>0?' ('+sg+fmtNum(pl/cur*100,1)+' %)':'';
      cards+=`<div class="stat total"><div class="k">${tr('ov.value')}</div><div class="v" style="color:var(--neon)">${fmtEur(val)}</div><div class="sub" style="color:${col}">${sg}${fmtEur(pl)}${pct}</div></div>`;
    }
    cards+=`<div class="stat"><div class="k">${tr('ov.peak')}</div><div class="v">${m.fmt(peak)}</div><div class="sub">${peakPts.length} ${tr(peakPts.length===1?'ov.datapoint':'ov.datapoints')}</div></div>`;
    head.innerHTML=cards;

    let hint='';
    if(chartSeries==='invested'&&skippedFx>0) hint+=note(tr('verlauf.noBaseHint').replace('{n}',skippedFx));
    if(withValue){
      if(!vs.pts.length) hint+=note(tr('verlauf.priceNone'));
      else if(cv.length<2) hint+=note(tr('verlauf.priceFirst').replace('{d}',fmtDay(dayT(vs.first))));
      else{
        hint+=note(tr('verlauf.priceHint').replace('{n}',priceSnaps().length).replace('{d}',fmtDay(dayT(vs.first))));
        if(vs.missing>0) hint+=note(tr('verlauf.priceMissing').replace('{n}',vs.missing));
      }
    }
    if(cp.length<2 && cv.length<2){ chartState=null; wrap.innerHTML=hint; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    const lines=[], both=cv.length>1;
    // Nur nicht-leere Reihen zeichnen: eine Reihe ohne Punkte liess buildChartSVG auf p[0] laufen
    // und riss den ganzen Verlauf-Tab mit (Audit run-3, Fund A-1).
    // Reihenfolge: Einstand unten, Wert obenauf — liegen beide fast deckungsgleich, bleibt die
    // durchgezogene Wertlinie sichtbar statt unter den Strichen des Einstands zu verschwinden.
    if(cp.length) lines.push({pts:cp, color:both?'var(--text-mid)':m.color, fill:!both, dash:both, key:'invested'});
    if(both) lines.push({pts:cv, color:'var(--neon)', fill:true,  key:'value'});
    if(!lines.length){ chartState=null; wrap.innerHTML=hint; empty.classList.remove('hidden'); return; }
    const legend = both ? `<div class="chart-legend"><span><i></i>${tr('series.value')}</span><span><i class="dash"></i>${tr('series.invested')}</span></div>` : '';
    wrap.innerHTML = buildChartSVG(lines, m) + '<div id="chart-tip" class="chart-tip hidden"></div>' + legend + hint;
  }
  const note = t => `<p class="muted" style="font-size:.78rem;margin-top:6px">${t}</p>`;
  const fmtDay = ts => {const d=new Date(ts);return String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+String(d.getUTCFullYear()).slice(2);};
  function buildChartSVG(lines, m){
    lines=lines.filter(l=>l&&l.pts&&l.pts.length);        // Riegel gegen jede kuenftige leere Reihe
    const W=600,H=240, pad={l:64,r:14,t:14,b:26};
    const all=lines.reduce((a,l)=>a.concat(l.pts),[]);
    const tMin=Math.min(...all.map(p=>p.t)), tMax=Math.max(...all.map(p=>p.t)), tSpan=(tMax-tMin)||1;
    let vMin=Math.min(0,...all.map(p=>p.val)), vMax=Math.max(...all.map(p=>p.val));
    if(vMax===vMin) vMax=vMin+1;
    const vSpan=vMax-vMin;
    const X=t=>pad.l+(t-tMin)/tSpan*(W-pad.l-pad.r);
    const Y=v=>pad.t+(1-(v-vMin)/vSpan)*(H-pad.t-pad.b);
    chartState={W,H,pad,tMin,tMax,tSpan,lines:lines.map(l=>({key:l.key,pts:l.pts}))};
    // Gridlines + Y-Labels (0, Mitte, Max)
    const yVals=[vMin, vMin+vSpan/2, vMax].filter((v,i,a)=>a.indexOf(v)===i);
    if(vMin<0 && vMax>0 && !yVals.includes(0)) yVals.push(0);
    const eur = chartSeries==='invested';
    let grid='', ylab='';
    for(const v of yVals){ const y=Y(v).toFixed(1);
      grid+=`<line class="chart-grid" x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}"/>`;
      ylab+=`<text class="chart-lbl" x="${pad.l-6}" y="${(+y+3).toFixed(1)}" text-anchor="end">${eur?Math.round(v).toLocaleString('de-DE'):shortNum(chartSeries==='btc'?(btcUnit()==='sat'?v*SATS:v):((VAULT.unit||'oz')==='oz'? v/OZ_G : v))}</text>`;
    }
    let paths='';
    lines.forEach((l,i)=>{
      const p=l.pts;
      // Stufen-Pfad (Wert hält bis zur nächsten Buchung bzw. zum nächsten Preisstand)
      let d=`M ${X(p[0].t).toFixed(1)} ${Y(p[0].val).toFixed(1)}`;
      for(let k=1;k<p.length;k++){ d+=` L ${X(p[k].t).toFixed(1)} ${Y(p[k-1].val).toFixed(1)} L ${X(p[k].t).toFixed(1)} ${Y(p[k].val).toFixed(1)}`; }
      const lastP=p[p.length-1];
      // Die Stufe hält bis zum rechten Rand: eine Reihe ohne neue Buchung endet sonst mitten im Bild,
      // obwohl der Einstand bis heute unverändert gilt.
      if(lastP.t<tMax) d+=` L ${X(tMax).toFixed(1)} ${Y(lastP.val).toFixed(1)}`;
      if(l.fill){
        const cid='cg'+chartSeries+i;
        paths+=`<defs><linearGradient id="${cid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${l.color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${l.color}" stop-opacity="0"/></linearGradient></defs>`;
        paths+=`<path d="${d} L ${X(Math.max(lastP.t,tMax)).toFixed(1)} ${Y(vMin).toFixed(1)} L ${X(p[0].t).toFixed(1)} ${Y(vMin).toFixed(1)} Z" fill="url(#${cid})" stroke="none"/>`;
      }
      paths+=`<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round"${l.dash?' stroke-dasharray="5 4"':''} style="filter:drop-shadow(0 0 4px ${l.color})"/>`;
      paths+=`<circle cx="${X(lastP.t).toFixed(1)}" cy="${Y(lastP.val).toFixed(1)}" r="3.2" fill="${l.color}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${m.label}">
      ${grid}
      <line class="chart-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}"/>
      <line class="chart-axis" x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}"/>
      ${paths}
      <line id="chart-cursor" class="chart-cursor hidden" x1="0" y1="${pad.t}" x2="0" y2="${H-pad.b}"/>
      ${ylab}
      <text class="chart-lbl" x="${pad.l}" y="${H-8}" text-anchor="start">${fmtDay(tMin)}</text>
      <text class="chart-lbl" x="${W-pad.r}" y="${H-8}" text-anchor="end">${fmtDay(tMax)}</text>
    </svg>`;
  }
  // Tooltip: der SVG skaliert mit preserveAspectRatio="none", X und Y werden also unterschiedlich
  // gestreckt. Für die Rückrechnung reicht die X-Achse — gesucht ist der Punkt zum angetippten Tag.
  function chartPoint(ev){
    if(!chartState || !VAULT) return;
    const wrap=$('chart-wrap'), tip=$('chart-tip'), svg=wrap&&wrap.querySelector('svg');
    if(!wrap||!tip||!svg) return;
    const r=svg.getBoundingClientRect(); if(!r.width) return;
    const st=chartState, ux=(ev.clientX-r.left)/r.width*st.W;
    const frac=(ux-st.pad.l)/(st.W-st.pad.l-st.pad.r);
    const t=st.tMin+Math.min(1,Math.max(0,frac))*st.tSpan;
    const vals=[];
    for(const l of st.lines){
      let hit=null; for(const p of l.pts) if(p.t<=t+43200000) hit=p;    // letzter Punkt bis zu diesem Tag
      if(hit) vals.push({key:l.key, p:hit});
    }
    if(!vals.length) return;
    const day=vals.reduce((a,b)=>a.p.t>b.p.t?a:b).p;
    const m=seriesMeta();
    const inv=vals.find(v=>v.key==='invested'), val=vals.find(v=>v.key==='value');
    let html=`<b>${fmtDay(day.t)}</b>`;
    if(val){
      const pl=val.p.val-(inv?inv.p.val:0), sg=pl>=0?'+':'', col=pl>=0?'var(--neon)':'var(--red)';
      html+=`<span>${tr('series.value')}: ${fmtEur(val.p.val)}</span>`;
      if(inv) html+=`<span>${tr('ov.invested')}: ${fmtEur(inv.p.val)}</span><span style="color:${col}">${tr('ov.diff')}: ${sg}${fmtEur(pl)}</span>`;
    } else if(inv) html+=`<span>${m.label}: ${m.fmt(inv.p.val)}</span>`;
    tip.innerHTML=html; tip.classList.remove('hidden');
    const cur=svg.querySelector('#chart-cursor');
    if(cur){ const cx=st.pad.l+(day.t-st.tMin)/st.tSpan*(st.W-st.pad.l-st.pad.r); cur.setAttribute('x1',cx); cur.setAttribute('x2',cx); cur.classList.remove('hidden'); }
    const wr=wrap.getBoundingClientRect();
    const left=Math.min(Math.max(8, ev.clientX-wr.left-tip.offsetWidth/2), Math.max(8, wr.width-tip.offsetWidth-8));
    tip.style.left=left+'px';
  }
  function chartHideTip(){
    const tip=$('chart-tip'); if(tip) tip.classList.add('hidden');
    const cur=document.getElementById('chart-cursor'); if(cur) cur.classList.add('hidden');
  }
  function shortNum(v){const a=Math.abs(v);if(a>=1e6)return (v/1e6).toFixed(1).replace('.',',')+'M';if(a>=1000)return (v/1000).toFixed(1).replace('.',',')+'k';if(a>=1)return v.toFixed(a<10?2:1).replace('.',',');return v.toFixed(3).replace('.',',');}

  /* ---------- CSV export ---------- */
  function downloadFile(name, content, type, bom){
    // BOM hilft Excel bei CSV-Umlauten, hat in der JSON-.vault aber nichts verloren
    // (strenge JSON-Parser brechen daran) -> nur setzen, wenn nicht explizit abgewählt.
    const parts = bom===false ? [content] : ['﻿'+content];
    const blob=new Blob(parts,{type:type||'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  // Steuertool erwartet EUR: Fremdwährungs-Buchungen nur mit erfasstem EUR-Gegenwert
  // exportieren, sonst auslassen und sichtbar warnen (nie stillschweigend falsche Beträge).
  function exportTaxCsv(entries, name, header, flagOf){
    $('export-msg').textContent='';                 // alte Meldung/Warnung nicht stehen lassen
    let csv=header, skipped=0, rows=0;
    for(const e of entries.sort((a,b)=>a.date.localeCompare(b.date))){
      const b=eurBasis(e); if(b==null){skipped++;continue;}
      const note=(e.source?e.source:'')+(e.note?(e.source?' — ':'')+e.note:'');
      csv+=`${e.date},${e.btc.toFixed(8)},${b.toFixed(2)},${csvCell(note)},${flagOf(e)?'ja':''}\n`;
      rows++;
    }
    const warn=skipped?tr('exp.fxSkipped').replace('{n}',skipped):'';
    if(!rows){ $('export-msg').textContent=warn; return toast(tr('toast.failed')); }
    saveCsv(name,csv).then(()=>{ if(warn){const m=$('export-msg'); m.textContent=(m.textContent?m.textContent+' — ':'')+warn;} });
  }
  function exportSteuertool(){
    const buys=VAULT.entries.filter(e=>e.type==='btc'&&entryDir(e)==='buy');
    if(!buys.length)return toast(tr('exp.noBuys'));
    exportTaxCsv(buys,'manual_buys.csv','date,btc_amount,eur_amount,note,kyc\n',e=>e.kyc);
  }
  function exportSales(){
    const sales=VAULT.entries.filter(e=>e.type==='btc'&&entryDir(e)==='sell');
    if(!sales.length)return toast(tr('exp.noSales'));
    exportTaxCsv(sales,'manual_sales.csv','date,btc_amount,eur_amount,note,no_kyc\n',e=>e.noKyc);
  }
  function exportMetals(){
    const m=VAULT.entries.filter(e=>e.type==='gold'||e.type==='silver');
    if(!m.length)return toast(tr('exp.noMetals'));
    let csv='date,vorgang,metall,form,feinheit,stueckzahl,gewicht_je_stueck,einheit,gewicht_g_gesamt,fein_g_gesamt,fein_oz_gesamt,betrag,waehrung,eur_gegenwert,quelle_ziel,notiz\n';
    const dirDe={buy:'Kauf',sell:'Verkauf',withdraw:'Entnahme'};
    for(const e of m.sort((a,b)=>a.date.localeCompare(b.date))){
      const fine=e.grams*((e.fineness||1000)/1000);
      csv+=`${e.date},${dirDe[entryDir(e)]},${e.type==='gold'?'Gold':'Silber'},${csvCell(e.form||'')},${e.fineness||''},${e.count||''},${e.qty},${e.unit},${e.grams.toFixed(3)},${fine.toFixed(3)},${(fine/OZ_G).toFixed(4)},${e.eur.toFixed(2)},${entryCur(e)},${e.eurRef>0?e.eurRef.toFixed(2):''},${csvCell(e.source||'')},${csvCell(e.note||'')}\n`;
    }
    saveCsv('edelmetalle.csv',csv);
  }
  // Formel-Injection neutralisieren (=,+,@ am Zellanfang würde in Excel/Calc als Formel laufen)
  function csvCell(s){s=(s||'').replace(/"/g,'""');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r\t;]/.test(s)?'"'+s+'"':s;}

  /* ---------- vault file export/import (Syncthing) ---------- */
  // Capacitor (native App) erkennen — dann Dateien übers OS speichern/teilen statt Browser-Download.
  const CAP = window.Capacitor || null;
  const isNative = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
  async function nativeSaveAndShare(name, content, dir, shareText){
    const FS = CAP.Plugins && CAP.Plugins.Filesystem;
    if(!FS) throw new Error('Filesystem-Plugin fehlt');
    // dir default DOCUMENTS (verschlüsseltes .vault-Backup, das der Nutzer selbst ablegt).
    // Klartext-Exporte (CSV) + 2FA-QR kommen mit dir='CACHE' (app-intern, nicht world-readable) → nur transient teilen.
    const w = await FS.writeFile({ path:name, data:content, directory:dir||'DOCUMENTS', encoding:'utf8', recursive:true });
    // shareText: Was Empfaenger bekommen, die Text statt Datei nehmen (Drucker-Apps). Default bleibt
    // der Kurztext; der Nachlass-Anhang uebergibt seinen Blattinhalt, sonst druckt die App nur den Titel.
    try{ const SH = CAP.Plugins && CAP.Plugins.Share; if(SH) await SH.share({ title:name, text:(shareText!==undefined?shareText:'Sachwert-Tresor Backup'), url:w.uri }); }catch(_){}
    return w.uri;
  }
  function blobToBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});}
  // CSV-Export native-aware: App -> Filesystem+Share, Web -> Download (mit BOM für Excel-Umlaute).
  const exportErr=e=>(LANG==='en'?'Export failed: ':'Export fehlgeschlagen: ')+((e&&e.message)||e);
  async function saveCsv(name, csv){
    const m=$('export-msg');
    if(isNative){
      try{ const uri=await nativeSaveAndShare(name, '﻿'+csv, 'CACHE');
        if(m) m.textContent=name+' ('+uri+')'+tr('exp.savedShareSfx'); toast(tr('toast.exported'));
      }catch(e){ if(m) m.textContent=exportErr(e); toast(tr('toast.failed')); }
    } else if(DESK){   // Desktop: Speichern-Dialog (Portal), Downloads sind in der Hülle gesperrt. BOM für Excel setzt die App, nie die Hülle.
      try{ const n=await DESK.saveText(name, '﻿'+csv); if(!n) return;   // abgebrochen: still
        if(m) m.textContent=n+tr('exp.savedDesk'); toast(tr('toast.exported'));
      }catch(e){ if(m) m.textContent=exportErr(e); toast(tr('toast.failed')); }
    } else { downloadFile(name, csv); toast(tr('toast.exported')); }
  }
  async function exportVault(){
    if(exportVault._busy) return;
    let stored=null; try{ stored=vaultGet(); }catch(_){}
    if(!stored)return;
    // Backup-Stand für die Erinnerung merken — wandert mit in die Exportdatei. Vorwerte behalten: scheitert das Speichern
    // (oder bricht der Desktop-Dialog ab), kommt der alte Stand zurück, sonst stünde „Backup von heute“ ohne Datei da.
    const hadFresh=VAULT.needsFreshBackup, prevBackup=VAULT.lastBackup, prevCount=VAULT.lastBackupCount, v0=VAULT;
    const revert=()=>{ if(VAULT!==v0) return; if(prevBackup===undefined) delete VAULT.lastBackup; else VAULT.lastBackup=prevBackup;
      if(prevCount===undefined) delete VAULT.lastBackupCount; else VAULT.lastBackupCount=prevCount; if(hadFresh) VAULT.needsFreshBackup=true; };
    VAULT.lastBackup=todayStr(); VAULT.lastBackupCount=VAULT.entries.length; delete VAULT.needsFreshBackup;   // Backup im neuen Format liegt vor
    try{ await persist(); }catch(e){ if(!(e&&e.locked)) revert(); return; }
    let raw; try{ raw=vaultGet(); }catch(_){ revert(); persist().catch(()=>{}); return; }
    const d=todayStr(); const name=`sachwert-tresor-${d}.vault`;
    if(DESK){
      exportVault._busy=true;
      try{ const n=await DESK.saveBackup(name, raw);
        if(!n){ revert(); await persist().catch(()=>{}); $('export-msg').textContent=''; }   // abgebrochen: kein Stempel
        else { $('export-msg').textContent=tr('exp.vaultSavedDesk').replace('{n}',n); toast(tr('toast.saved')); }
      }catch(e){ revert(); await persist().catch(()=>{}); $('export-msg').textContent=(LANG==='en'?'Backup failed: ':'Backup fehlgeschlagen: ')+((e&&e.message)||e); }
      finally{ exportVault._busy=false; if(VAULT===v0) renderDash(); }
      return;
    }
    if(isNative){
      try{ const uri=await nativeSaveAndShare(name, raw);
        $('export-msg').textContent=tr('exp.backupSavedPre')+uri+')'+tr('exp.vaultSavedNative');
        toast(tr('toast.saved'));
      }catch(e){ $('export-msg').textContent=(LANG==='en'?'Backup failed: ':'Backup fehlgeschlagen: ')+((e&&e.message)||e); }
    } else {
      downloadFile(name, raw, 'application/octet-stream', false);
      $('export-msg').textContent=tr('exp.vaultSavedWeb');
    }
  }
  // Minimal-CSV-Parser (RFC-4180-nah: Anführungszeichen, "" als Escape, BOM/CRLF tolerant).
  function parseCsv(text, maxRows){   // maxRows: bricht beim Überschreiten sofort ab ('toomany'), statt erst alles zu parsen (Audit run-6 #1)
    const rows=[]; let i=0, field='', row=[], inq=false;
    text=String(text).replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    while(i<text.length){
      const c=text[i];
      if(inq){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} inq=false;i++;continue;} field+=c;i++;continue; }
      if(c==='"'){inq=true;i++;continue;}
      if(c===','){row.push(field);field='';i++;continue;}
      if(c==='\n'){row.push(field);rows.push(row);row=[];field='';i++; if(maxRows&&rows.length>maxRows) throw new Error('toomany'); continue;}
      field+=c;i++;
    }
    if(field.length||row.length){row.push(field);rows.push(row);}
    return rows.filter(r=>r.length && r.some(x=>x.trim()!==''));
  }
  // CSV-Bulk-Import im Tresor-Eigenformat (manual_buys.csv = Käufe, manual_sales.csv = Verkäufe).
  // CSV nur im Tresor-Format (date,btc_amount,eur_amount,…). Broker-CSVs gehoeren ins Steuertool, nicht hierher.
  function importCsv(ev){
    const f=ev.target.files[0]; if(!f) return;
    if(!VAULT){ deferFile(ev); return; }   // gesperrt (Picker war offen): nur den Verweis merken, nachgeholt in enterApp() (v3.6)
    if(f.size>MAX_FILE_BYTES){ $('export-msg').textContent=tr('err.fileLarge'); ev.target.value=''; return; }   // VOR dem Lesen (Audit run-6 #1)
    const session=VAULT;   // Sitzung pinnen wie doImportVault: Sperre + neues Entsperren während des Lesens → verwerfen (run-6 #6)
    const r=new FileReader();
    r.onerror=()=>{ if(VAULT) $('export-msg').textContent=tr('msg.readErr'); ev.target.value=''; };   // geänderte/ersetzte Datei liest Chromium nicht (run-6 #2)
    r.onload=()=>{
      if(!VAULT||VAULT!==session){ ev.target.value=''; return; }   // währenddessen gesperrt → abbrechen
      try{
        const rows=parseCsv(r.result, MAX_CSV_ROWS);
        if(rows.length<2) throw new Error(tr('csv.errEmpty'));
        const head=rows[0].map(h=>h.trim().toLowerCase());
        const isBuy=head.includes('kyc'), isSale=head.includes('no_kyc');
        if(head[0]!=='date'||head[1]!=='btc_amount'||head[2]!=='eur_amount'||(!isBuy&&!isSale))
          throw new Error(tr('csv.errFormat'));
        const dir=isSale?'sell':'buy';
        let added=0,dups=0,bad=0; const newIds=[], add=[], seen=new Set(VAULT.entries.map(dupKey));   // O(n) statt findDuplicate je Zeile
        for(let n=1;n<rows.length;n++){
          const c=rows[n];
          const date=(c[0]||'').trim(), btc=parseFloat(c[1]), eur=parseFloat(c[2]);
          const note=(c[3]||'').trim(), flag=(c[4]||'').trim().toLowerCase();
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!(btc>0)||!(eur>=0)){ bad++; continue; }
          const e={ id:cryptoId(), type:'btc', dir, date, eur, cur:'EUR', btc, source:note, note:'' };
          if(dir==='buy') e.kyc=(flag==='ja'||flag==='kyc'||flag==='true'||flag==='1');
          else e.noKyc=(flag==='ja'||flag==='no_kyc'||flag==='true'||flag==='1');
          const k=dupKey(e); if(seen.has(k)){ dups++; continue; } seen.add(k); add.push(e);
        }
        if(VAULT.entries.length+add.length>MAX_ENTRIES) throw new Error('toomany');   // Deckel VOR dem Einfügen: nichts halb übernommen
        for(const e of add){ VAULT.entries.push(e); newIds.push(e.id); added++; }
        persist().then(()=>{ renderAll();
          $('export-msg').textContent=`${tr('csv.resultPre')} (${dir==='buy'?tr('lbl.buys'):tr('lbl.sells')}): ${added} ${tr('csv.new')}, ${dups} ${tr('csv.dupsSkipped')}${bad?`, ${bad} ${tr('csv.badRows')}`:''}.`;
          toast(added?(added+' '+(LANG==='en'?'imported':'importiert')):tr('msg.upToDate'));
        }).catch(ex=>{   // Speicherfehler: neue Zeilen aus dem RAM zurückrollen (Anzeige == Speicher, wie addEntry/delEntry)
          if(ex&&ex.locked) return;
          const del=new Set(newIds); VAULT.entries=VAULT.entries.filter(x=>!del.has(x.id)); renderAll();
        });
      }catch(e){ const m=e&&e.message; $('export-msg').textContent=tr('csv.failPre')+(m==='toomany'?tr('err.tooMany'):(m||'Format?')); }
      ev.target.value='';
    };
    r.readAsText(f);
  }
  // Import-Härtung: Einträge aus fremden .vault-Dateien nur mit bekannten Feldern,
  // geprüften Typen und begrenzten Stringlängen übernehmen (kein HTML/JS-Schmuggel).
  function sanitizeEntry(e){
    if(!e || typeof e!=='object') return null;
    if(typeof e.id!=='string' || !/^[0-9a-f]{1,64}$/i.test(e.id)) return null;
    if(['btc','gold','silver'].indexOf(e.type)<0) return null;
    const dir = e.dir==null ? 'buy' : e.dir;                       // Altdaten ohne dir = Kauf
    if(['buy','sell','withdraw'].indexOf(dir)<0) return null;
    if(typeof e.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
    const num=v=>{const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?n:0;};
    const str=(v,max)=>typeof v==='string'?v.slice(0,max):'';
    const out={id:e.id.toLowerCase(), type:e.type, dir, date:e.date, eur:Math.max(0,num(e.eur)),
      cur:(e.cur==='USD'||e.cur==='CHF')?e.cur:'EUR', note:str(e.note,500), source:str(e.source,200)};
    if(out.cur!=='EUR' && num(e.eurRef)>0) out.eurRef=num(e.eurRef);
    if(e.type==='btc'){
      out.btc=num(e.btc); if(!(out.btc>0)) return null;
      if(dir==='buy') out.kyc=!!e.kyc;
      if(dir==='sell') out.noKyc=!!e.noKyc;
    }else{
      out.grams=num(e.grams); if(!(out.grams>0)) return null;
      out.qty=num(e.qty)||out.grams;
      out.unit=['g','oz','kg'].indexOf(e.unit)>=0?e.unit:'g';
      if(e.count!=null && num(e.count)>=1) out.count=Math.floor(num(e.count));
      out.form=str(e.form,50);
      out.fineness=(e.fineness!=null && num(e.fineness)>0 && num(e.fineness)<=1000)?num(e.fineness):null;
    }
    return out;
  }
  // Preisstände aus einer importierten .vault übernehmen — Feld-Whitelist und Typprüfung wie in
  // sanitizeEntry. Ohne das ginge die Wertlinie beim Umzug auf ein neues Gerät verloren.
  function sanitizeSnaps(arr){
    if(!Array.isArray(arr)) return [];
    const num=v=>{const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)&&n>0?String(n):'';};
    const out=[];
    for(const r of arr){
      if(!r||typeof r!=='object') continue;
      if(!notFuture(r.d)) continue;                        // existierendes Datum, nicht in der Zukunft
      const sn={d:r.d, btc:num(r.btc), gold:num(r.gold), silver:num(r.silver)};
      if(!sn.btc&&!sn.gold&&!sn.silver) continue;
      out.push(sn);
    }
    return out;
  }
  function mergeSnaps(local, incoming){
    const byDay=new Map(sanitizeSnaps(local).map(sn=>[sn.d,sn]));
    for(const sn of sanitizeSnaps(incoming)) if(!byDay.has(sn.d)) byDay.set(sn.d,sn);   // lokaler Stand gewinnt
    return Array.from(byDay.values()).sort((a,b)=>a.d.localeCompare(b.d)).slice(-PRICE_HIST_MAX);
  }
  // Einträge zusammenführen: Vereinigung über die eindeutige id (keine Daten gehen verloren)
  function mergeEntries(local, incoming){
    const byId=new Map(local.map(e=>[e.id,e]));
    let added=0;
    for(const raw of (incoming||[])){ const e=sanitizeEntry(raw); if(e&&!byId.has(e.id)){ byId.set(e.id,e); added++; } }
    return {entries:Array.from(byId.values()), added};
  }
  let pendingImportBlob=null;   // Text der gewählten .vault wartet auf Passphrase-Eingabe (prompt() geht in der App-WebView nicht)
  function importVault(ev){
    const f=ev.target.files[0];
    if(f&&!VAULT){ deferFile(ev); return; }   // gesperrt (Picker war offen): nur den Verweis merken, nachgeholt in enterApp() (v3.6)
    ev.target.value='';            // erlaubt erneute Auswahl derselben Datei
    if(!f)return;
    if(f.size>MAX_FILE_BYTES){ $('export-msg').textContent=tr('err.fileLarge'); return; }   // VOR dem Lesen; parseFile prüft sonst erst nach 20 MB (run-6 #1)
    const r=new FileReader();
    r.onerror=()=>{ if(VAULT) $('export-msg').textContent=tr('msg.readErr'); };   // geänderte/ersetzte Datei (Syncthing) → Meldung statt Stille (run-6 #2)
    r.onload=()=>{
      if(!VAULT) return;           // währenddessen gesperrt → abbrechen (clearRendered hat pendingImportBlob geräumt)
      try{
        const text=String(r.result);
        // AISV2 streng prüfen (Grenzen VOR jeder KDF-Arbeit); Alt-Backups bewusst locker (ct+salt), damit frühe Dateien nicht an einem Magic scheitern
        try{ parseFile(text); }
        catch(e){ if(e&&e.message!=='format'){ $('export-msg').textContent=fileErrMsg(e); return; }
          const blob=JSON.parse(text); if(!blob||!blob.ct||!blob.salt) throw 0; }
        pendingImportBlob=text;
        $('import-pass').value='';
        show('import-pass-box');
        $('export-msg').textContent='';
        $('import-pass').focus();
      }catch(e){$('export-msg').textContent=tr('msg.notValidVault');}
    };
    r.readAsText(f);
  }
  function cancelImport(){ pendingImportBlob=null; hide('import-pass-box'); $('import-pass').value=''; }
  async function doImportVault(_, btnEl){
    if(!pendingImportBlob)return;
    const btn=btnEl||null; const orig=btn&&btn.textContent;
    const pass=$('import-pass').value;
    if(!pass){$('export-msg').textContent=tr('msg.enterPass');return;}
    if(btn){btn.disabled=true;btn.textContent=tr('busy.decrypting');}
    const session=VAULT;                   // Import gehört zu DIESER Sitzung (Audit run-4, Hinweis 4)
    try{
      if(!await argonCheck()){ $('export-msg').textContent=tr('err.noArgon2'); return; }
      const v=(await openVaultText(pendingImportBlob, pass)).vault;   // entschlüsselt = Passphrase korrekt (AISV2 oder Alt-Format)
      if(!VAULT||VAULT!==session) return;  // während der Ableitung gesperrt (auch: gesperrt und neu entsperrt)
      // Zusammenführen statt ersetzen — deine lokale Passphrase (DEK/KDF/WRAP) bleibt unverändert
      // Zustand vor dem Zusammenfuehren merken: scheitert persist(), darf die Anzeige nicht fremde
      // Buchungen zeigen, die nie gespeichert wurden — der naechste persist() schriebe sie sonst
      // dauerhaft fest (Audit run-3, Fund B-3; gleiches Muster wie importCsv seit run-2).
      const beforeEntries=VAULT.entries, beforeSnaps=VAULT.priceHistory;
      const {entries, added}=mergeEntries(VAULT.entries, v.entries);
      VAULT.entries=entries;
      VAULT.priceHistory=mergeSnaps(VAULT.priceHistory, v.priceHistory);
      // Die Aegis-Hürde (VAULT.totp) fasst der Import NIE an (seit v3.4, Muster Alien Pass): Sie gilt nur auf diesem Gerät.
      // Bis v3.3 konnte ein Backup sie nach Rückfrage mitbringen — wer den Aegis-Eintrag nicht mehr hatte, sperrte sich damit
      // beim Wiederherstellen selbst aus. Jetzt bleibt ein Backup immer der Notausgang: neu einrichten, importieren, ohne Code.
      try{ await persist(); }
      catch(ex){
        if(!(ex&&ex.locked)){ VAULT.entries=beforeEntries; VAULT.priceHistory=beforeSnaps; renderAll(); }
        $('export-msg').textContent=tr('msg.importSaveFailed');
        return;
      }
      pendingImportBlob=null; hide('import-pass-box'); $('import-pass').value='';
      $('export-msg').textContent=`${tr('msg.merged')}: ${added} ${tr('msg.entriesNew')} (${tr('msg.total')} ${VAULT.entries.length}). ${tr('msg.passKept')}`;
      renderAll();renderDash();toast(added?(added+' '+tr('msg.entriesNew')):tr('msg.upToDate'));
    }catch(e){ if(!(e&&e.locked)&&VAULT===session) $('export-msg').textContent=openErrMsg(e,'msg.importBad'); }
    finally{ if(btn){btn.disabled=false;btn.textContent=orig;} }
  }

  /* ---------- TOTP setup ---------- */
  let pendingSecret=null;
  function totpStart(){
    const bytes=crypto.getRandomValues(new Uint8Array(20));
    pendingSecret=base32Encode(bytes);
    App._otpauth=`otpauth://totp/Sachwert-Tresor:Alien%20Investor?secret=${pendingSecret}&issuer=Sachwert-Tresor&algorithm=SHA1&digits=6&period=30`;
    $('totp-secret').textContent=pendingSecret;
    drawQR($('totp-qr'), App._otpauth);
    hide('totp-off');show('totp-setup');hide('totp-on');
    $('totp-verify').value='';err('totp-setup-err');
  }
  function drawQR(canvas, text){
    if(typeof qrMatrix!=='function'){canvas.style.display='none';return;}
    let m; try{ m=qrMatrix(text); }catch(e){ canvas.style.display='none'; return; }
    canvas.style.display='';
    const quiet=4, n=m.size, scale=8, dim=(n+quiet*2)*scale;
    canvas.width=dim; canvas.height=dim;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,dim,dim);
    ctx.fillStyle='#000';
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m.modules[r][c])ctx.fillRect((c+quiet)*scale,(r+quiet)*scale,scale,scale);
  }
  function saveQR(){
    if(DESK) return toast(tr('toast.qrDesk'));   // Desktop: Knopf ausgeblendet, Downloads gesperrt — die PNG wäre eine bleibende Klartextdatei mit dem TOTP-Geheimnis
    const c=$('totp-qr');
    if(!c||c.style.display==='none'||!c.width)return toast(tr('toast.noQr'));
    // Als Datei speichern (zuverlässig auch auf GrapheneOS) -> in Aegis aus Galerie/Bild importieren
    c.toBlob(async blob=>{
      const fname='sachwert-tresor-2fa-qr.png';
      if(isNative){
        try{ const b64=await blobToBase64(blob);
          const FS=CAP.Plugins&&CAP.Plugins.Filesystem;
          const w=await FS.writeFile({path:fname,data:b64,directory:'CACHE',recursive:true});
          const SH=CAP.Plugins&&CAP.Plugins.Share; if(SH) await SH.share({title:fname,url:w.uri});
          toast(tr('toast.qrSaved'));
        }catch(e){ toast(tr('toast.qrSaveFail')); }
      } else {
        const url=URL.createObjectURL(blob);const a=document.createElement('a');
        a.href=url;a.download=fname;a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        toast(tr('toast.qrSaved'));
      }
    },'image/png');
  }
  function copyQR(){
    if(DESK) return toast(tr('toast.qrDesk'));   // Desktop: navigator.clipboard ist ohne Berechtigung tot; Bild-Kopie läuft nicht über die Brücke
    const c=$('totp-qr');
    if(!c||c.style.display==='none'||!c.width)return toast(tr('toast.noQr'));
    if(!(navigator.clipboard && window.ClipboardItem))return toast(tr('toast.clipUnavail'));
    c.toBlob(blob=>navigator.clipboard.write([new ClipboardItem({'image/png':blob})])
      .then(()=>toast(tr('toast.qrCopied'))).catch(()=>toast(tr('toast.copyFail'))),'image/png');
  }
  async function totpConfirm(){
    err('totp-setup-err');
    const code=$('totp-verify').value.trim();
    if(!await totpValid(pendingSecret,code))return err('totp-setup-err',tr('err.totpSetupBad'));
    VAULT.totp={enabled:true,secret:pendingSecret};
    await persist();pendingSecret=null;renderSettings();toast(tr('toast.totpOn'));
  }
  function totpCancel(){pendingSecret=null;renderSettings();}
  async function totpDisable(){ if(!VAULT||!VAULT.totp||!(await ask(tr('confirm.totpDisable'),{ok:'dlg.disable',danger:true}))) return; if(!VAULT||!VAULT.totp) return;
    const before=VAULT.totp; VAULT.totp=null; try{ await persist(); }catch(e){ if(!(e&&e.locked)&&VAULT) VAULT.totp=before; return; } renderSettings(); toast(tr('toast.totpOff')); }
  /* ---------- Fingerabdruck-Entsperren (nur Android-App, seit v3.0 — Port aus Alien Pass v1.2 inkl. Audit run-3) ----------
     Der DEK wird zusätzlich unter einem 32-Byte-Zufallsschlüssel verpackt (Rolle 'bio', Blob in localStorage, nie in der .vault).
     Den Zufallsschlüssel verwahrt der Android-Keystore, gebunden an einen starken Fingerabdruck (Freigabe pro Nutzung; ein neu
     eingerichteter Fingerabdruck macht ihn ungültig). Nach einem Neustart verweigert das Plugin den Keystore-Teil: Passphrase-Pflicht,
     danach wird der Slot mit frischem Zufall neu bewaffnet. Ehrlich: Regel im Code, keine kryptografische Garantie — siehe Hilfe.
     Invarianten: BIO-INVARIANTEN.md. Fingerabdruck-Fehlversuche zählen NICHT in die Passphrase-Bremse (Android sperrt selbst). */
  const BIO = (isNative && CAP.Plugins && CAP.Plugins.Biometric) ? CAP.Plugins.Biometric : null;   // Plugin aus patch-hardening.mjs; Web: kein Slot
  const BIO_KEY='ai-sachwert-bio', BIO_REARM_KEY='ai-sachwert-bio-rearm', BIO_HOLD_KEY='ai-sachwert-bio-hold';   // Marker (keine Geheimnisse)
  // bioKeep (v3.2) ist NUR Anzeige: die Wahrheit steht im Slot des Plugins und hängt in dessen GCM-AAD (boot+"|keep"). Geändert wird sie
  // ausschließlich durch Deaktivieren + neu Aktivieren — hier wird sie aus status()/enroll() übernommen, nie gesetzt.
  let bioArmed=false, bioNeedsRearm=false, bioRearmDek=null, bioGen=0, bioAuto=true, bioKeep=false;
  function bioBlob(){ try{ return parseBioBlob(localStorage.getItem(BIO_KEY)); }catch(_){ return null; } }
  function bioMarker(){ try{ return localStorage.getItem(BIO_REARM_KEY)==='1'; }catch(_){ return false; } }
  function setBioMarker(on){ try{ if(on) localStorage.setItem(BIO_REARM_KEY,'1'); else localStorage.removeItem(BIO_REARM_KEY); }catch(_){} }
  // Riegel: „Jetzt sperren“ = bewusst gesperrt → beim nächsten Start nur die Passphrase (kein Knopf, kein Prompt); Schlüsselmaterial bleibt,
  // nach der Passphrase gilt der Fingerabdruck ohne Neu-Aktivierung wieder. Überlebt App-Neustart (localStorage).
  function bioHold(){ try{ return localStorage.getItem(BIO_HOLD_KEY)==='1'; }catch(_){ return false; } }
  function setBioHold(on){ try{ if(on) localStorage.setItem(BIO_HOLD_KEY,'1'); else localStorage.removeItem(BIO_HOLD_KEY); }catch(_){} }
  function bioMsg(t){ const n=$('bio-msg'); if(!n) return; n.textContent=t||''; n.classList.toggle('hidden',!t); }
  // Warnung „neuer Fingerabdruck im System“ (Audit run-5 #1): bleibt stehen, bis der Nutzer sie liest oder bewusst neu aktiviert —
  // ein Toast (2,2 s) ging beim Aufbau der Übersicht unter (Gerätetest 19.09.2026). Nur ein Marker, nichts Geheimes.
  const BIO_ALERT_KEY='ai-sachwert-bio-alert';
  function bioAlert(){ try{ return localStorage.getItem(BIO_ALERT_KEY)==='1'; }catch(_){ return false; } }
  function setBioAlert(on){ try{ if(on) localStorage.setItem(BIO_ALERT_KEY,'1'); else localStorage.removeItem(BIO_ALERT_KEY); }catch(_){} if(VAULT){ renderDash(); renderSettings(); } }
  function bioAlertOk(){ setBioAlert(false); }
  function bioAlertHtml(){ return bioAlert() ? '<div class="warn" id="bio-alert-dash" style="grid-column:1/-1">'+escapeHtml(tr('bio.alert'))+'<br><button class="btn ghost sm" style="margin-top:8px" data-action="bioAlertOk">'+escapeHtml(tr('bio.alertOk'))+'</button></div>' : ''; }
  function renderBioGate(){ const b=$('bio-btn'); if(b){ b.classList.toggle('hidden',!bioArmed||bioHold()); b.disabled=!!doUnlock._busy; } }   // Riegel: Knopf verborgen
  // Slot verwerfen: JS-Blob + Marker immer, Keystore-Teil auf Wunsch (bei ungültigem Schlüssel hat das Plugin ihn schon selbst gelöscht).
  // bioGen++ lässt laufende enroll/unlock-Vorgänge verfallen
  function bioDrop(native){ try{ localStorage.removeItem(BIO_KEY); }catch(_){} setBioMarker(false); setBioHold(false); bioArmed=false; bioNeedsRearm=false; bioRearmDek=null; bioKeep=false; bioGen++; if(native&&BIO){ try{ BIO.disable().catch(()=>{}); }catch(_){} } renderBioGate(); }
  // Sperrbildschirm: nativen Zustand abgleichen. auto = Prompt sofort zeigen (nicht nach manuellem Sperren, nie im Hintergrund)
  async function bioProbe(auto){
    bioArmed=false; renderBioGate();
    if(!BIO){ if(bioBlob()||bioMarker()) bioDrop(false); return; }                     // Web-Build: kein Slot, Reste wegräumen
    const gen=bioGen, blob=bioBlob(), marker=bioMarker();
    let st; try{ st=await BIO.status(); }catch(_){ st={enabled:false,reason:'error'}; }
    if(gen!==bioGen||DEK||pendingUnlock) return;
    const reason=st&&st.reason;
    bioKeep=!!(st&&st.enabled&&st.keep);   // nur Anzeige (v3.2): gilt der Slot über einen Neustart hinaus?
    // Neue Registrierung im System schlägt Neustart (Audit run-5 #1): das Plugin prüft den Kanarien-Schlüssel VOR der Boot-Kennung.
    // Kein automatisches Neu-Bewaffnen — der Nutzer aktiviert bewusst neu (und sieht, dass sich etwas geändert hat).
    if(reason==='invalidated'){ bioDrop(false); bioMsg(tr('bio.reset')); setBioAlert(true); return; }
    if(reason==='reboot'||(!blob&&marker&&reason==='none')){                             // Neustart: nativ ist der Slot schon weg; JS-Blob verwerfen, Marker + Kanarie bleiben
      if(blob||reason==='reboot') bioDrop(false); setBioMarker(true); bioNeedsRearm=true; bioMsg(tr('bio.afterReboot')); return; }   // nativ hat status() den Slot schon gelöscht; disable() würde auch die Kanarie löschen (run-5 #1)
    if(!blob){ if(st&&st.enabled){ try{ BIO.disable().catch(()=>{}); }catch(_){} } setBioMarker(false); setBioHold(false); return; }   // Keystore-Rest ohne JS-Blob: aufräumen
    if(st&&st.enabled&&bioHold()){ bioArmed=true; bioNeedsRearm=false; setBioMarker(false); renderBioGate(); bioMsg(tr('bio.held')); return; }   // Riegel: Slot gilt, aber kein Knopf, kein Prompt
    if(st&&st.enabled){ bioArmed=true; bioNeedsRearm=false; setBioMarker(false); renderBioGate(); if(auto&&!document.hidden) doBio(); return; }
    if(reason==='unavailable'||reason==='error'){ bioMsg(tr('bio.naNow')); return; }     // vorübergehend (Keystore beschäftigt): Slot behalten, Passphrase
    bioDrop(false); bioMsg(tr('bio.reset'));                                              // neuer Fingerabdruck / Schlüssel weg: bewusst neu aktivieren
  }
  // Slot (neu) bewaffnen: braucht einen EXTRAHIERBAREN DEK-Handle (WebCrypto-Objekt, nie Rohbytes), der danach fallen gelassen wird;
  // wrap (ct + iv) bindet den Slot an den Passphrase-Slot der Datei
  // keep (v3.2) = „Fingerabdruck auch nach Neustart“: nur beim bewussten Aktivieren wählbar (ab Werk aus), nie beim Rearm — das Plugin
  // schreibt die Wahl in den Slot und authentisiert sie in der AAD; ändern geht nur über Deaktivieren + neu Aktivieren.
  async function bioArm(dekX, kdf, wrap, rearm, keep){
    const gen=bioGen, secret=rand(32), wantKeep=!!keep&&!rearm;
    try{
      const key=await bioKey(secret); const blob=await wrapDek(dekX, key, kdf, 'bio'); const ser=serializeBioBlob(blob, wrap.ct, wrap.iv);   // seit v3.2 mit `wi` (Alien-Pass-Audit run-8 #1)
      // rearm:true → das Plugin richtet nur mit gültigem Kanarien-Schlüssel neu ein (sonst 'invalidated', Audit run-5 #1)
      await BIO.enroll({secret:bufToB64(secret), rearm:!!rearm, keep:wantKeep, title:tr('bio.promptTitle'), subtitle:tr(rearm?'bio.promptRearm':'bio.promptEnroll'), negative:tr('btn.cancel')});
      if(gen!==bioGen||!VAULT){ try{ BIO.disable().catch(()=>{}); }catch(_){} setBioMarker(false); toast(tr('bio.aborted')); return false; }   // zwischendurch gesperrt / Passphrase gewechselt: nichts hinterlassen — auch keinen Marker, sonst meldet die nächste Neu-Einrichtung ohne Kanarie fälschlich einen fremden Finger (Kurz-Review B)
      localStorage.setItem(BIO_KEY, ser); setBioMarker(false); bioArmed=true; bioNeedsRearm=false; bioKeep=wantKeep; if(!rearm) setBioAlert(false); return true;   // bewusst neu aktiviert: Warnung erledigt
    }catch(e){ const c=e&&e.message;
      // Keystore vorübergehend nicht bereit (Kanarien-Prüfung 'error' → 'unavailable'): Neu-Einrichtung beim nächsten Entsperren erneut
      // versuchen — Kanarie und Marker bleiben, sonst ginge der Nachweis einer neuen Registrierung verloren (Kurz-Review C)
      if(rearm&&c==='unavailable'){ bioArmed=false; setBioMarker(true); bioNeedsRearm=true; toast(tr('bio.naNow')); return false; }
      bioDrop(true); if(c==='invalidated') setBioAlert(true); toast(tr(c==='invalidated'?'bio.rearmRefused':c==='cancel'?'bio.cancelled':c==='lockout'?'bio.lockout':'bio.failed')); return false; }
    finally{ secret.fill(0); }
  }
  // Sperrbildschirm: Fingerabdruck → Keystore gibt den Zufallsschlüssel heraus → DEK auspacken → gleicher Abschluss wie die Passphrase
  // (afterGate: Aegis-Hürde bleibt davor). Die Passphrase-Bremse blockiert den Fingerabdruck nicht und zählt ihn nicht.
  async function doBio(){
    if(doBio._busy||doUnlock._busy||openSession._busy||!BIO||!bioArmed||bioHold()||DEK||pendingUnlock) return; err('lock-err');   // Riegel: Passphrase-Pflicht
    let raw; try{ raw=vaultGet(); }catch(_){ return err('lock-err', tr('err.storeRead')); }   // (am Desktop unerreichbar: BIO ist dort null)
    if(!raw) return boot();
    let f; try{ f=parseFile(raw); }catch(e){ return err('lock-err',fileErrMsg(e)); }
    const blob=bioBlob(); if(!blob){ bioDrop(true); return; }
    if(!bioWrapOk(blob,f.wrap)){ bioArmed=false; renderBioGate(); return bioMsg(tr('bio.wrapMismatch')); }   // fremder/veränderter Passphrase-Slot (ct ODER iv): nie übernehmen, Blob behalten (Backup-Restore heilt)
    const gen=bioGen; doBio._busy=true; let secret=null;
    try{
      const r=await BIO.unlock({title:tr('bio.promptTitle'), subtitle:tr('bio.promptUnlock'), negative:tr('bio.usePass')});
      secret=b64Bytes(r&&r.secret); if(!secret||secret.length!==32) throw new Error('invalid');
      const key=await bioKey(secret); secret.fill(0);
      const dek=await unwrapDek(blob, key, f.kdf, false, 'bio');
      const v=await decryptBody(f.body, dek, f.kdf);
      if(gen!==bioGen||DEK||pendingUnlock) return;                        // zwischendurch gesperrt oder anders entsperrt
      pendingUnlock={legacy:false, vault:v, dek, kdf:f.kdf, wrap:f.wrap};
    }catch(e){
      const c=e&&e.message; if(gen!==bioGen) return;
      if(c==='cancel') return; if(c==='lockout') return err('lock-err',tr('bio.lockout'));
      if(c==='reboot'){ bioDrop(false); setBioMarker(true); bioNeedsRearm=true; return bioMsg(tr('bio.afterReboot')); }   // Slot hat unlock() selbst gelöscht, Kanarie bleiben lassen
      // 'error' = Timeout/Sensor nicht bereit im Dialog: unlock() lässt den Slot nativ stehen → hier auch nichts löschen. bioDrop(true)
      // → disable() räumte die Kanarie ab; ein provozierter Timeout plus danach registrierter Finger bliebe sonst unbemerkt
      // (Rückmeldung aus Alien Pass v1.6.1, N1)
      if(c==='error'){ err('lock-err',tr('bio.naNow')); return; }
      // 'tampered' = GCM-Tag der Slot-Datei falsch (boot/keep im Klartext verändert): nie „vorübergehend“ — JS-Blob weg, bleibende Warnung,
      // Keystore-Teil bleibt bis zum nächsten bioProbe (dort räumt „enabled ohne Blob“ auf; kein Wipe HIER: das gäbe eine Lösch-Primitive
      // im Fehlerpfad, N1; Alien-Pass-Audit run-8 #16). Die Warnung bleibt unabhängig davon stehen.
      if(c==='tampered'){ bioDrop(false); setBioAlert(true); return bioMsg(tr('bio.tampered')); }
      if(c==='invalidated') setBioAlert(true);                            // neuer Finger während die App gesperrt im Hintergrund lag: bleibende Warnung (Kurz-Review A)
      bioDrop(c!=='invalidated'&&c!=='none'); return bioMsg(tr('bio.reset'));   // ungültiger Schlüssel, alter/fremder Blob, Manipulation
    }finally{ doBio._busy=false; if(secret) secret.fill(0); }
    afterGate();
  }
  // Einstellungen: aktivieren (Passphrase bestätigen → extrahierbarer DEK-Handle nur für das Verpacken) / deaktivieren
  async function bioEnable(){
    if(bioEnable._busy||!VAULT||!BIO) return; err('bio-err');
    if(changePass._busy) return err('bio-err',tr('bio.busy'));
    const btn=$('bio-btn-on'), orig=btn.textContent; bioEnable._busy=true; btn.disabled=true; btn.textContent=tr('busy.checking');   // Guard VOR dem ersten await
    try{
      let av; try{ av=await BIO.available(); }catch(_){ av={ok:false,reason:'error'}; }
      if(!av||!av.ok) return err('bio-err',tr(av&&av.reason==='noneEnrolled'?'bio.naEnrolled':(av&&(av.reason==='noHardware'||av.reason==='noStrong'))?'bio.naHardware':'bio.naNow'));
      const pass=$('bio-pass').value; if(!pass) return err('bio-err',tr('err.cpWrong'));
      let dekX; try{ const kek=await deriveKek(passBytes(pass), KDF); dekX=await unwrapDek(WRAP, kek, KDF, true); }catch(e){ return err('bio-err',openErrMsg(e,'err.cpWrong')); }
      if(!VAULT||!DEK) return; $('bio-pass').value='';
      const keep=!!($('bio-keep')&&$('bio-keep').checked);   // Wahl gilt nur für DIESE Aktivierung; danach wieder ab Werk aus
      if(await bioArm(dekX, KDF, WRAP, false, keep)){ toast(tr('bio.on')); const k=$('bio-keep'); if(k) k.checked=false; }
    }finally{ bioEnable._busy=false; btn.disabled=false; btn.textContent=orig; $('bio-pass').value=''; maskInputs(); if(VAULT) renderSettings(); }
  }
  async function bioDisable(){ if(!VAULT||!bioArmed||!(await ask(tr('confirm.bioDisable'),{ok:'dlg.disable',danger:true}))) return; if(!VAULT||!bioArmed) return; bioDrop(true); toast(tr('bio.off')); renderSettings(); }

  function renderSettings(){
    const on=VAULT.totp&&VAULT.totp.enabled;
    $('totp-off').classList.toggle('hidden',on);$('totp-on').classList.toggle('hidden',!on);hide('totp-setup');
    const soft=document.documentElement.getAttribute('data-theme')==='soft';
    $('th-dark').classList.toggle('on',!soft);$('th-soft').classList.toggle('on',soft);
    $('set-autolock').value=String(VAULT.autolock==null?5:VAULT.autolock); syncCombo('set-autolock');
    const bc=$('bio-card'); if(bc){ bc.classList.toggle('hidden',!BIO); $('bio-off').classList.toggle('hidden',bioArmed); $('bio-on').classList.toggle('hidden',!bioArmed);
      const ba=$('bio-alert'); if(ba){ ba.textContent=bioAlert()?tr('bio.alert'):''; ba.classList.toggle('hidden',!bioAlert()); }
      // zwei fertige Texte statt eines zusammengesetzten: beide tragen data-i18n, applyI18n übersetzt sie, hier wird nur umgeschaltet (v3.2)
      const bt=$('bio-on-text'), bk=$('bio-on-text-keep'); if(bt&&bk){ bt.classList.toggle('hidden',bioKeep); bk.classList.toggle('hidden',!bioKeep); } }
    $('about-line').textContent=tr('about').replace('{v}',APP_VERSION)+(DESK?' · Linux-Desktop (Flatpak)':'');   // Versionszeile ganz unten (einheitlich mit Alien Pass)
  }

  /* ---------- change passphrase ---------- */
  async function changePass(){
    if(changePass._busy) return;
    err('cp-err');
    if(bioEnable._busy) return err('cp-err',tr('bio.busy'));        // nicht parallel zum Fingerabdruck-Aktivieren (Alien Pass Audit run-3 #5)
    const cur=$('cp-cur').value, p1=$('cp1').value, p2=$('cp2').value;
    if(p1.length<12)return err('cp-err',tr('err.cpShort'));
    if(p1!==p2)return err('cp-err',tr('err.cpMismatch'));
    const btn=$('cp-btn'), orig=btn.textContent;
    changePass._busy=true; btn.disabled=true; btn.textContent=tr('busy.changing');
    try{
      // 1) aktuelle Passphrase gegen den Slot der laufenden Sitzung prüfen (echtes Auspacken, kein Vergleich)
      const vault=VAULT, old={DEK, KDF, WRAP};
      if(!vault) return;
      try{ const kOld=await deriveKek(passBytes(cur), old.KDF); await unwrapDek(old.WRAP, kOld, old.KDF, false); }
      catch(e){ return err('cp-err',openErrMsg(e,'err.cpWrong')); }
      // 2) DEK-Rotation unter neuer Passphrase (frischer Salt, frischer DEK). Alles erst LOKAL bauen, dann DEK/KDF/WRAP
      //    in einem synchronen Schritt tauschen: ein persist() während Argon2 schriebe sonst einen gemischten Stand.
      // Parameter der geöffneten Datei nur übernehmen, wenn sie mindestens dem Standard entsprechen — eine selbstgebaute
      // Datei mit m=8192/t=1 trüge sonst schwache Parameter in jede neue Passphrase weiter (Audit run-4, Hinweis 3).
      const strong=old.KDF.m>=KDF_DEFAULT.m&&old.KDF.t>=KDF_DEFAULT.t;
      const kdf={m:strong?old.KDF.m:KDF_DEFAULT.m, t:strong?old.KDF.t:KDF_DEFAULT.t, p:strong?old.KDF.p:KDF_DEFAULT.p, salt:rand(16)};
      let wrap, dek;
      try{ const kNew=await deriveKek(passBytes(p1), kdf);
        wrap=await wrapDek(await newDek(), kNew, kdf); dek=await unwrapDek(wrap, kNew, kdf, false); }
      catch(e){ return err('cp-err',tr('err.kdfFailed')); }
      if(!DEK||VAULT!==vault) return;   // während der Ableitung gesperrt: neuen Schlüssel nicht zurück in den RAM holen
      DEK=dek; KDF=kdf; WRAP=wrap;
      try{ await persist(); }
      catch(e){ if(!(e&&e.locked)){ DEK=old.DEK; KDF=old.KDF; WRAP=old.WRAP; } return; }   // Speicher hält weiter die alte Passphrase — RAM passend zurück
      dropPre3();                        // Sicherungskopie trüge noch die alte Passphrase
      const hadBio=bioArmed||!!bioBlob()||bioMarker(); if(hadBio) bioDrop(true); bioGen++;   // neuer DEK/Salt: alter Slot passt nicht mehr; bioGen++ lässt einen laufenden enroll verfallen
      $('cp-cur').value=$('cp1').value=$('cp2').value='';
      toast(tr(hadBio?'toast.passChangedBio':'toast.passChanged')); renderSettings();
    }finally{ changePass._busy=false; btn.disabled=false; btn.textContent=orig; }
  }

  /* ---------- misc ---------- */
  function theme(t){if(t==='soft'){document.documentElement.setAttribute('data-theme','soft');localStorage.setItem('alien-theme','soft');}else{document.documentElement.removeAttribute('data-theme');localStorage.setItem('alien-theme','dark');}renderSettings();}
  // Desktop: nur über die Brücke (Kopie mit KDE-Hinweis, Löschen beim Sperren/Beenden) — kein Rückfall auf die Web-API, die schriebe ohne
  // Hinweis und Klipper hielte das TOTP-Geheimnis im Verlauf. Scheitert die Brücke: „Manuell kopieren“.
  function copy(text,msg){ if(DESK){ DESK.clip.write({text}).then(()=>toast(msg),()=>toast(tr('copy.manual'))); return; }
    navigator.clipboard?navigator.clipboard.writeText(text).then(()=>toast(msg)):toast(tr('copy.manual'));}
  async function wipeLocal(){ if(!VAULT||!(await ask(tr('confirm.wipe'),{ok:'dlg.wipe',danger:true}))) return; if(!VAULT) return; bioDrop(true);try{localStorage.removeItem(BIO_ALERT_KEY);}catch(_){}
    try{ vaultDel(); }catch(_){ return toast(tr('err.wipeFailed')); }   // Desktop-Datei ließ sich nicht löschen: Tresor bleibt, nicht sperren
    dropPre3();lock();}
  // Nachgeholter Import (v3.6, Port aus Alien Pass v1.10, Gerätetest 26.09.2026): der Datei-Picker ist eine fremde Android-Activity (am Desktop
  // der Portal-Dialog), und die Sperre läuft währenddessen weiter — Wegzeit-Prüfung in onShown() und der Inaktivitäts-Timer. Sperrt die App, während
  // der Picker offen ist, kam die Datei bisher in eine gesperrte App: importCsv lief auf VAULT=null (TypeError, still), importVault las die Datei
  // trotzdem ein. Jetzt: nur den Dateiverweis merken (Handle, kein Inhalt — nichts wird gelesen, solange die App zu ist), Toast auf dem
  // Sperrbildschirm, nach dem Entsperren (enterApp, also auch nach dem Aegis-Code) im Export-Tab denselben Handler mit derselben Datei aufrufen.
  // Verfällt nach PENDING_FILE_MS ohne Entsperren, wird IMMER verbraucht (nie zweimal). Die Sperr-Regel selbst bleibt unangetastet — bewusst
  // KEINE Schonfrist mit offenem Schlüssel, solange der Picker offen ist (Entscheidung Nutzer 26.09.2026, Alien Pass).
  let pendingFile=null; const PENDING_FILE_MS=5*60000;
  function deferFile(ev){ const t=ev&&ev.target, f=t&&t.files&&t.files[0]; if(!f||VAULT) return false;
    pendingFile={id:t.id, file:f, at:Date.now()}; try{ t.value=''; }catch(_){} toast(tr('imp.deferred'),{ms:8000}); return true; }
  function runPendingFile(){ const p=pendingFile; pendingFile=null; if(!p||!VAULT) return; const d=Date.now()-p.at; if(d<0||d>PENDING_FILE_MS) return;   // d<0: zurückgestellte Uhr = verfallen (run-6 #4)
    const fn=p.id==='csv-file'?importCsv:p.id==='vault-file'?importVault:null; if(!fn) return;
    tab('export'); fn({target:{id:p.id, files:[p.file], value:''}}); }
  function pickFile(id){const el=$(id);if(el)el.click();}
  function copySecret(){copy($('totp-secret').textContent,tr('msg.keyCopied'));}
  function copyOtpauth(){copy(App._otpauth,tr('msg.otpauthCopied'));}
  // Passphrase-Stärke (rein lokal, heuristisch: Länge + Wortfolge). Nur Orientierung, kein Zwang.
  function passStrength(p){
    const words=p.trim().split(/[\s\-_.,;]+/).filter(w=>w.length>=3).length, len=p.length;
    if(len<12) return 0;
    if(len>=24||(len>=18&&words>=4)) return 3;
    if(len>=16||words>=3) return 2;
    return 1;
  }
  function renderMeter(inId,outId){
    const p=$(inId).value, el=$(outId); if(!el) return;
    if(!p){el.textContent='';return;}
    const st=passStrength(p);
    const col=['var(--red)','var(--orange)','var(--text-mid)','var(--neon)'][st];
    el.innerHTML='<span style="color:'+col+'">'+'▮'.repeat(st+1)+'▯'.repeat(3-st)+' '+tr('pass.s'+st)+'</span>';
  }
  function meterSetup(){renderMeter('setup-pass1','setup-meter');}
  function meterCp(){renderMeter('cp1','cp-meter');}
  // Backup-Erinnerung: nie gesichert ODER neue Buchungen und Export älter als 14 Tage
  function backupHintHtml(){
    if(VAULT.needsFreshBackup) return '<div class="warn" style="grid-column:1/-1">'+tr('bk.fresh')+'</div>';
    const n=VAULT.entries.length; if(!n) return '';
    if(!VAULT.lastBackup) return '<div class="warn" style="grid-column:1/-1">'+tr('bk.never')+'</div>';
    const newSince=Math.max(0,n-(VAULT.lastBackupCount||0));
    const days=Math.floor((Date.now()-Date.parse(VAULT.lastBackup+'T12:00:00Z'))/86400000);
    if(newSince>0&&days>=14) return '<div class="warn" style="grid-column:1/-1">'+tr('bk.stale').replace('{d}',days).replace('{n}',newSince)+'</div>';
    return '';
  }
  /* ---------- Nachlass-Anhang (Bestandsliste fürs Erben-Paket) ----------
     Anhang-Prinzip (Beschluss 2026-08-28): Der Nachlassplaner bleibt blind für Beträge,
     dieses Blatt liegt ihm als Klasse-B-Anlage bei. Nur Mengen — keine Preise, keine
     Quellen/Händler, keine Standorte (die gehören handschriftlich in den Planer). */
  function nlToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function nlFassung(){const f=$('nl-fassung');return (f&&f.value.trim())||'1';}
  // Stückelung: Netto-Stückzahl je (Metall, Form, Gewicht je Stück, Einheit, Feinheit)
  function nlDenoms(type){
    const m=new Map();
    for(const e of VAULT.entries){
      if(e.type!==type) continue;
      const key=[e.form||'',e.qty||0,e.unit||'g',e.fineness||''].join('|');
      const cnt=(parseInt(e.count,10)||1)*(entryDir(e)==='buy'?1:-1);
      const g=m.get(key)||{form:e.form||'',qty:e.qty||0,unit:e.unit||'g',fineness:e.fineness||null,count:0};
      g.count+=cnt; m.set(key,g);
    }
    return [...m.values()].filter(g=>g.count>0).sort((a,b)=>toGrams(b.qty,b.unit)-toGrams(a.qty,a.unit));
  }
  // Ein Datenmodell für Bildschirm, Druck und .txt — Freitexte (form) werden erst beim Rendern escaped.
  function nlData(){
    const t=totals();
    const metal=(type,fine)=>({fineG:fine,fineOz:fine/OZ_G,denoms:nlDenoms(type)});
    return {fassung:nlFassung(),date:nlToday(),btc:t.btc,gold:metal('gold',t.gold),silver:metal('silver',t.silver)};
  }
  function nlDenomLine(g){
    const q=fmtNum(g.qty,g.unit==='g'?0:4)+' '+g.unit;
    return g.count+' × '+q+(g.form?' '+g.form:'')+(g.fineness?' · '+fmtNum(g.fineness,1)+'‰':'');
  }
  function renderNachlass(){
    const el=$('nl-sheet'); if(!el||!VAULT) return;
    const d=nlData();
    const metalBlock=(title,m)=>{
      let h=`<h2>${title}</h2><table><tr><td>${tr('nl.netFine')}</td><td>${fmtNum(m.fineG,2)} g (${fmtNum(m.fineOz,3)} oz)</td></tr></table>`;
      if(m.denoms.length){ h+=`<div class="hint" style="margin-top:6px">${tr('nl.denomHead')}</div><ul>`+m.denoms.map(g=>`<li>${escapeHtml(nlDenomLine(g))}</li>`).join('')+'</ul>'; }
      else if(m.fineG>0.0005) h+=`<div class="hint">${tr('nl.noDenom')}</div>`;
      return h;
    };
    el.innerHTML=`<h1>${tr('nl.sheetTitle')}</h1><span class="klasse">${tr('nl.klasse')}</span>
      <table>
        <tr><td>${tr('nl.fassung')}</td><td>${escapeHtml(d.fassung)}</td></tr>
        <tr><td>${tr('nl.stand')}</td><td>${d.date}</td></tr>
        <tr><td>${tr('nl.replaces')}</td><td><span class="line"></span></td></tr>
        <tr><td>${tr('nl.source')}</td><td>${tr('nl.sourceVal')}</td></tr>
      </table>
      <h2>Bitcoin</h2><table><tr><td>${tr('nl.netHold')}</td><td>${fmtNum(d.btc,8)} BTC (${fmtNum(Math.round(d.btc*SATS),0)} sats)</td></tr></table>
      ${metalBlock('Gold',d.gold)}${metalBlock(tr('nl.silver'),d.silver)}
      <h2>${tr('nl.heirHead')}</h2><ul>${['nl.h1','nl.h2','nl.h3','nl.h4','nl.h5'].map(k=>`<li>${tr(k)}</li>`).join('')}</ul>
      <div class="hint">${tr('nl.destroy')} <span class="line"></span></div>`;
  }
  function nachlassText(){
    const d=nlData(), L=[];
    const metal=(title,m)=>{ L.push('',title.toUpperCase(),tr('nl.netFine')+': '+fmtNum(m.fineG,2)+' g ('+fmtNum(m.fineOz,3)+' oz)');
      if(m.denoms.length){ L.push(tr('nl.denomHead')); m.denoms.forEach(g=>L.push('  '+nlDenomLine(g))); }
      else if(m.fineG>0.0005) L.push(tr('nl.noDenom')); };
    L.push(tr('nl.sheetTitle').toUpperCase(), tr('nl.klasse'), '',
      tr('nl.fassung')+': '+d.fassung, tr('nl.stand')+': '+d.date, tr('nl.replaces')+': ____________', tr('nl.source')+': '+tr('nl.sourceVal'),
      '', 'BITCOIN', tr('nl.netHold')+': '+fmtNum(d.btc,8)+' BTC ('+fmtNum(Math.round(d.btc*SATS),0)+' sats)');
    metal('Gold',d.gold); metal(tr('nl.silver'),d.silver);
    L.push('', tr('nl.heirHead').toUpperCase()); ['nl.h1','nl.h2','nl.h3','nl.h4','nl.h5'].forEach(k=>L.push('- '+tr(k)));
    L.push('', tr('nl.destroy')+' ____________');
    return L.join('\n')+'\n';
  }
  function nlRemember(){ const f=nlFassung(); if(VAULT.nlFassung!==f){ VAULT.nlFassung=f; persist().catch(()=>{}); } }
  function openNachlass(){ if(!VAULT) return; const f=$('nl-fassung'); if(f&&!f.value&&VAULT.nlFassung) f.value=VAULT.nlFassung; const m=$('nl-msg'); if(m) m.textContent=''; renderNachlass(); show('nachlass-overlay'); const o=$('nachlass-overlay'); if(o) o.scrollTop=0; }
  function closeNachlass(){ hide('nachlass-overlay'); const el=$('nl-sheet'); if(el) el.innerHTML=''; }
  // Desktop: window.print() liefe im Flatpak ohne cups-Socket ins Leere → die Hülle rendert die Seite mit dem Druck-CSS als PDF
  // (printToPDF im Hauptprozess, VOR dem Dialog — das Overlay ist dabei offen) und speichert über den Portal-Dialog.
  function printNachlass(){ renderNachlass(); nlRemember(); if(!DESK) return window.print();
    if(printNachlass._busy) return; printNachlass._busy=true; const m=$('nl-msg');
    DESK.savePdf('nachlass-anhang-'+nlToday()+'.pdf')
      .then(n=>{ if(!n) return; if(m) m.textContent=n+tr('nl.pdfSaved'); toast(tr('toast.exported')); })
      .catch(e=>{ if(m) m.textContent=exportErr(e); toast(tr('toast.failed')); })
      .finally(()=>{ printNachlass._busy=false; }); }
  async function exportNachlassTxt(){
    renderNachlass(); nlRemember();
    const name='nachlass-anhang-'+nlToday()+'.txt', txt=nachlassText(), m=$('nl-msg');
    if(isNative){
      try{ const uri=await nativeSaveAndShare(name, txt, 'CACHE', txt); if(m) m.textContent=name+' ('+uri+')'+tr('exp.savedShareSfx'); toast(tr('toast.exported')); }
      catch(e){ if(m) m.textContent=exportErr(e); toast(tr('toast.failed')); }
    } else if(DESK){   // Klartext ohne BOM, nur per Dialog
      try{ const n=await DESK.saveText(name, txt); if(!n) return; if(m) m.textContent=n+tr('nl.savedWeb'); toast(tr('toast.exported')); }
      catch(e){ if(m) m.textContent=exportErr(e); toast(tr('toast.failed')); }
    } else { downloadFile(name, txt, 'text/plain;charset=utf-8', false); if(m) m.textContent=name+tr('nl.savedWeb'); toast(tr('toast.exported')); }
  }
  function openHelp(){show('help-overlay');const o=$('help-overlay');if(o)o.scrollTop=0;}
  function closeHelp(){hide('help-overlay');}
  function toggleLang(){ setLang(LANG==='de'?'en':'de'); }
  function relabel(){ if(!VAULT) return; refreshAddLabels(); if(!editId) $('add-btn').textContent=tr('add.btnAdd'); renderDash(); renderList(); renderSettings(); if(!$('tab-verlauf').classList.contains('hidden')) renderVerlauf(); if(!$('nachlass-overlay').classList.contains('hidden')) renderNachlass(); }
  function renderAll(){renderDash();renderList();renderSettings();}

  return {boot,doSetup,doUnlock,doTotp,lock,lockNow,cancelTotp,doBio,bioEnable,bioDisable,bioAlertOk,tab,setAddType,setAddDir,addEntry,editEntry,cancelEdit,delEntry,setFilter,onDenomChange,onCurChange,updateMetalPreview,
    exportSteuertool,exportSales,exportMetals,exportVault,importVault,doImportVault,cancelImport,importCsv,savePrices,setMetalUnit,setBtcUnit,setInputBtcUnit,setAutolock,setChartSeries,setChartRange,chartPoint,chartHideTip,
    totpStart,totpConfirm,totpCancel,totpDisable,saveQR,copyQR,changePass,theme,copy,wipeLocal,openHelp,closeHelp,toggleLang,relabel,
    openNachlass,closeNachlass,printNachlass,exportNachlassTxt,renderNachlass,
    pickFile,copySecret,copyOtpauth,meterSetup,meterCp,closeMenus,syncCombos,toggleCombo,chooseOpt,togglePass,enhancePassFields,deskKey,
    ask,dialogOk,dialogCancel,dialogOpen,dialogKey,hideToast,toastAction,_otpauth:''};
})();

/* ---------- Event-Delegation ----------
   CSP ohne 'unsafe-inline' in script-src: KEINE Inline-Handler mehr (auch nicht in
   per innerHTML erzeugtem Markup) — alles läuft über data-Attribute + diese Listener. */
document.addEventListener('click',ev=>{
  // Klick außerhalb eines Auswahlfelds schließt jedes offene Menü
  if(!ev.target.closest('.combo')) App.closeMenus();
  const sp=ev.target.closest('[data-showpass]');
  if(sp){ App.togglePass(null,sp); return; }
  const el=ev.target.closest('[data-action]'); if(!el) return;
  const fn=App[el.dataset.action];
  if(typeof fn==='function') fn(el.dataset.arg, el);
});
// Auge: Fokus bleibt im Passwortfeld (Tastatur klappt nicht zu, Cursor bleibt stehen)
document.addEventListener('mousedown',ev=>{ if(ev.target.closest('.pw-eye')) ev.preventDefault(); });
document.addEventListener('change',ev=>{
  const el=ev.target.closest('[data-change]'); if(!el) return;
  const a=el.dataset.change;
  if(a==='setAutolock') return App.setAutolock(el.value);
  if(a==='importCsv'||a==='importVault') return App[a](ev);
  const fn=App[a]; if(typeof fn==='function') fn();
});
document.addEventListener('input',ev=>{
  const el=ev.target.closest('[data-input]'); if(!el) return;
  const fn=App[el.dataset.input]; if(typeof fn==='function') fn();
});
// Verlauf-Tooltip: Antippen/Ziehen zeigt den Stand des Tages, Verlassen blendet ihn aus
document.addEventListener('pointerdown',ev=>{ if(ev.target.closest('#chart-wrap')) App.chartPoint(ev); else App.chartHideTip(); });
document.addEventListener('pointermove',ev=>{ if(ev.target.closest('#chart-wrap')) App.chartPoint(ev); });
document.addEventListener('keydown',ev=>{
  if(App.deskKey(ev)){ ev.preventDefault(); return; }   // Desktop: Strg+L sperrt (ohne Hülle immer false)
  if(App.dialogKey(ev)){ ev.preventDefault(); return; }   // offener Dialog: Escape bricht ab, Tab pendelt (v3.5)
  if(ev.key==='Escape'){ App.closeMenus(); App.chartHideTip(); return; }
  if(ev.key!=='Enter') return;
  const el=ev.target.closest('[data-enter]'); if(!el) return;
  ev.preventDefault();   // sonst klickte Enter nach einem Fokuswechsel (Dialog schließt, Fokus geht zurück) den Knopf dahinter erneut (Alien Pass v1.9)
  const fn=App[el.dataset.enter]; if(typeof fn==='function') fn();
});

window.addEventListener('DOMContentLoaded',()=>{
  if(!window.crypto||!crypto.subtle){document.body.innerHTML='<div class="container"><div class="card warn">Dieser Browser unterstützt kein WebCrypto (oder läuft nicht im sicheren Kontext). Öffne die Datei über https:// oder file:// in Vanadium/Brave/Firefox.</div></div>';return;}
  const cw=document.getElementById('chart-wrap');
  if(cw) cw.addEventListener('pointerleave',()=>App.chartHideTip());   // bubbelt nicht: feuert nur beim Verlassen des Containers
  App.enhancePassFields();   // vor applyI18n: setzt die Augen-Beschriftung
  applyI18n();
  const dg=document.getElementById('dlg'); if(dg) dg.addEventListener('click',ev=>{ if(ev.target===dg) App.dialogCancel(); });   // Tippen auf den Hintergrund = Abbrechen (v3.5)
  App.boot();
  // Service-Worker nur im sicheren Origin (https / localhost) — bei file:// nicht verfügbar; in der Desktop-Hülle (app://) gibt es
  // keinen: sw.js liegt nicht im Bundle und das Schema erlaubt keine Service Worker (Registrierung würde still scheitern).
  if('serviceWorker' in navigator && location.protocol!=='file:' && !window.AlienDesktop){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
