'use strict';
// Prüfprogramm für die echte Hülle (Sachwert-Tresor, Port aus Alien Pass): lädt main.js wie die App und prüft von innen (keine
// Fernsteuerung von außen — die Hülle verweigert --remote-debugging-*, und die Fuses sperren --inspect). Aufruf über verify-desktop.mjs.
// Gibt je Prüfung eine Zeile "R <json>" aus, nie Tresor- oder Zwischenablage-Inhalte. Die Speichern-Dialoge werden hier
// auf einen Pfad im Test-Home umgebogen (dialog.showSaveDialog), damit Backup/CSV/PDF ohne Portal durchlaufen.
const {app,BrowserWindow,Menu,session,clipboard,ClipboardItem,dialog}=require('electron');
const path=require('path'); const fs=require('fs'); const net=require('net'); const dgram=require('dgram');
require('./main.js');

const STEP=process.env.ST_STEP, PP=process.env.ST_PP||'';
const KDE_HINT='electron application/osclipboard;format="x-kde-passwordManagerHint"';
const R=(name,ok,info)=>console.log('R '+JSON.stringify({name,ok:!!ok,info:info===undefined?null:info}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let win=null;
const js=code=>win.webContents.executeJavaScript(code,true);
async function until(code,ms=40000){ const t0=Date.now(); while(Date.now()-t0<ms){ try{ if(await js(code)) return true; }catch(_){} await sleep(100); } return false; }
const visible=id=>`(()=>{const n=document.getElementById(${JSON.stringify(id)});return !!n&&!n.classList.contains('hidden');})()`;
const fill=(id,v)=>js(`(()=>{const n=document.getElementById(${JSON.stringify(id)});n.value=${JSON.stringify(v)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const click=sel=>js(`document.querySelector(${JSON.stringify(sel)}).click()`);
const DATA=path.join(process.env.XDG_DATA_HOME,'sachwert-tresor'), VAULT=path.join(DATA,'vault.aisv');
const OUT=path.join(process.env.XDG_DATA_HOME,'..','dialog'); fs.mkdirSync(OUT,{recursive:true});
// Speichern-Dialog umbiegen: liefert einen Pfad im Test-Home (oder Abbruch, wenn __cancel gesetzt)
let cancelDialog=false; const dialogs=[];
dialog.showSaveDialog=async(_w,o)=>{ dialogs.push(o); if(cancelDialog) return {canceled:true}; return {canceled:false,filePath:path.join(OUT,o.defaultPath)}; };

async function fresh(){
  R('lädt nur app://tresor/index.html', win.webContents.getURL()==='app://tresor/index.html', win.webContents.getURL());
  R('kein Node im Renderer', await js(`typeof require==='undefined'&&typeof process==='undefined'&&typeof module==='undefined'`));
  const keys=await js(`Object.keys(window.AlienDesktop).sort().join(',')`);
  R('Brücke hat genau clip, onBackground, onLock, saveBackup, savePdf, saveText, store', keys==='clip,onBackground,onLock,saveBackup,savePdf,saveText,store', keys);
  R('fetch nach außen scheitert', await js(`fetch('https://example.org/').then(()=>false,()=>true)`));
  R('window.open verweigert', await js(`window.open('https://example.org/')===null`));
  await js(`location.href='https://example.org/'`).catch(()=>{}); await sleep(600);
  R('Navigation verweigert', win.webContents.getURL()==='app://tresor/index.html', win.webContents.getURL());
  const ses=session.defaultSession;
  const st=async u=>{ try{ return (await ses.fetch(u)).status; }catch(e){ return 'FEHLER'; } };
  R('Protokoll liefert index.html', await st('app://tresor/index.html')===200);
  R('Protokoll liefert manifest.webmanifest (Typ bekannt)', await st('app://tresor/manifest.webmanifest')===200);
  R('Protokoll liefert Argon2 (hash-wasm) und Schriften', await st('app://tresor/vendor/hash-wasm/argon2.umd.min.js')===200&&await st('app://tresor/vendor/fonts/fonts.css')===200&&await st('app://tresor/vendor/fonts/Orbitron-700.woff2')===200);
  R('Protokoll kennt keinen Service Worker (sw.js nicht im Bundle)', await st('app://tresor/sw.js')===404);
  for(const u of ['app://tresor/%2e%2e/main.js','app://tresor/..%2fpackage.json','app://tresor/vendor/../../main.js','app://anders/index.html','app://tresor/app.js.map','app://tresor/vendor/hash-wasm/LICENSE'])
    { const c=await st(u); R('Protokoll verweigert '+u, c===404||c==='FEHLER', c); }   // FEHLER = schon vom Netzfilter verworfen
  R('Hauptprozess erreicht kein Netz (webRequest)', await st('https://example.org/')==='FEHLER');
  R('kein Anwendungsmenü', Menu.getApplicationMenu()===null);
  R('Fenster-Icon gesetzt (Taskleiste, Alt+Tab)', fs.existsSync(path.join(__dirname,'icon.png'))&&fs.readFileSync(path.join(__dirname,'main.js'),'utf8').includes("icon:ICON"));
  R('.desktop StartupWMClass = package.json name (KDE ordnet das Fenster sonst nicht zu)', (()=>{ try{ const d=fs.readFileSync(path.join(__dirname,'..','..','flatpak','org.alieninvestor.tresor.desktop'),'utf8'); return /^StartupWMClass=sachwert-tresor$/m.test(d); }catch(_){ return 'n/a'; } })());
  // unter app:// verweigert Chromium die SW-API ganz (getRegistrations wirft SecurityError) — beides heißt: kein Service Worker
  { const sw=await js(`(async()=>{ try{ if(!navigator.serviceWorker) return 'keine API'; const r=await navigator.serviceWorker.getRegistrations(); return r.length===0?'leer':'REGISTRIERT '+r.length; }catch(e){ return 'verweigert: '+e.name; } })()`).catch(e=>'EXC '+String(e&&e.message||e));
    R('kein Service Worker registriert', sw!=='EXC'&&!/REGISTRIERT/.test(sw), sw); }

  // WebRTC (Alien Pass Audit run-6 #7): weder UDP-STUN noch TURN über TCP darf den Prozess verlassen — hier an eigene Empfänger auf 127.0.0.1
  { const u=dgram.createSocket('udp4'); let udp=0; u.on('message',()=>udp++); await new Promise(r=>u.bind(0,'127.0.0.1',r));
    let tcp=0; const t=net.createServer(c=>{ tcp++; c.destroy(); }); await new Promise(r=>t.listen(0,'127.0.0.1',r));
    const up=u.address().port, tp=t.address().port;
    const cand=await js(`(async()=>{ let n=0; try{ const pc=new RTCPeerConnection({iceServers:[{urls:'stun:127.0.0.1:${up}'},{urls:'turn:127.0.0.1:${tp}?transport=tcp',username:'u',credential:'p'}]});
      pc.onicecandidate=e=>{ if(e.candidate) n++; }; pc.createDataChannel('x'); await pc.setLocalDescription(await pc.createOffer()); await new Promise(r=>setTimeout(r,4000)); pc.close(); }catch(e){ return 'ERR '+e.message; } return n; })()`);
    R('WebRTC: kein UDP nach außen', udp===0, {udp,cand}); R('WebRTC: kein TCP/TURN nach außen', tcp===0, {tcp,cand});
    u.close(); t.close(); }
  const wp=win.webContents.getLastWebPreferences();
  R('Sandbox, Kontext-Isolation, kein Node', wp.sandbox===true&&wp.contextIsolation===true&&wp.nodeIntegration===false, {sandbox:wp.sandbox,contextIsolation:wp.contextIsolation,nodeIntegration:wp.nodeIntegration});
  win.webContents.openDevTools(); await sleep(400);   // am Verhalten prüfen, nicht an den gemeldeten Einstellungen
  R('DevTools lassen sich nicht öffnen', !win.webContents.isDevToolsOpened());
  R('Rechtschreibprüfung aus (lädt sonst aus dem Netz)', ses.isSpellCheckerEnabled()===false);
  R('keine Drosselung im Hintergrund (Sperr-Timer)', win.webContents.getBackgroundThrottling()===false);

  // Fremder Frame mit derselben Brücke: jeder Aufruf muss abgewiesen werden
  const w2=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true}});
  await w2.loadURL('data:text/html,<p>fremd</p>');
  const foreign=await w2.webContents.executeJavaScript(`(async()=>{const r=[];
    try{AlienDesktop.store.read();r.push('read-OK')}catch(e){r.push('read-DENIED')}
    try{AlienDesktop.store.write('x');r.push('write-OK')}catch(e){r.push('write-DENIED')}
    try{await AlienDesktop.clip.write({text:'x'});r.push('clip-OK')}catch(e){r.push('clip-DENIED')}
    try{await AlienDesktop.saveBackup('a.vault','x');r.push('save-OK')}catch(e){r.push('save-DENIED')}
    try{await AlienDesktop.saveText('a.csv','x');r.push('text-OK')}catch(e){r.push('text-DENIED')}
    try{await AlienDesktop.savePdf('a.pdf');r.push('pdf-OK')}catch(e){r.push('pdf-DENIED')}
    return r.join(',');})()`,true);
  R('fremder Frame: alle Brücken-Aufrufe abgewiesen', foreign==='read-DENIED,write-DENIED,clip-DENIED,save-DENIED,text-DENIED,pdf-DENIED', foreign);
  w2.destroy();

  // Zwischenablage: Hinweis gesetzt, eigene Kopie wird gelöscht, fremde bleibt
  const M1='st-harness-'+process.pid+'-a', M2='st-harness-'+process.pid+'-b';
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M1)}})`);
  R('Kopie trägt den KDE-Hinweis', await clipboard.has(KDE_HINT)&&(await clipboard.readText())===M1);
  await js(`AlienDesktop.clip.clear()`);
  R('eigene Kopie gelöscht', (await clipboard.readText())!==M1);
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M1)}})`);
  await clipboard.write([new ClipboardItem({'text/plain':new Blob([M2],{type:'text/plain'}),[KDE_HINT]:new Blob(['secret'])})]);   // „Nutzer kopiert etwas anderes“
  await js(`AlienDesktop.clip.clear()`);
  R('fremde Kopie bleibt stehen', (await clipboard.readText())===M2);
  await clipboard.clear();

  // Tresor anlegen über die Oberfläche → Datei statt Browser-Speicher; Argon2 (WASM) muss unter den Fuses laufen
  R('ohne Datei: Einrichtung', await until(visible('screen-setup'),15000));
  R('Argon2 (hash-wasm, WASM) läuft in der Hülle', await js(`hashwasm.argon2id({password:'harness',salt:'12345678',parallelism:1,iterations:1,memorySize:256,hashLength:16,outputType:'hex'}).then(h=>h.length===32,e=>'ERR '+e)`));
  await fill('setup-pass1',PP); await fill('setup-pass2',PP); const t0=Date.now(); await click('#setup-btn');
  R('Tresor angelegt', await until(visible('screen-app')));
  R('Einrichten (Argon2id 64 MiB) unter 5 s', Date.now()-t0<5000, {ms:Date.now()-t0});
  await js(`App.tab('add'); App.setAddType('btc'); App.setAddDir('buy'); true`); await sleep(200);
  await fill('f-date','2025-01-15'); await fill('f-eur','2500'); await fill('f-btc','0.0421'); await fill('f-src-btc','harness-quelle-bisq'); await click('#add-btn');
  R('Eintrag gespeichert', await until(`(()=>{ App.tab('list'); return document.querySelector('#list-tbl tbody').textContent.includes('harness-quelle-bisq'); })()`,10000));
  let stF=null, stD=null; try{ stF=fs.statSync(VAULT); stD=fs.statSync(DATA); }catch(_){}
  R('Tresor-Datei existiert', !!stF);
  R('Datei 600, Ordner 700', !!stF&&(stF.mode&0o777)===0o600&&(stD.mode&0o777)===0o700, stF&&{file:(stF.mode&0o777).toString(8),dir:(stD.mode&0o777).toString(8)});
  R('keine Temp-Reste', fs.readdirSync(DATA).every(n=>n==='vault.aisv'), fs.readdirSync(DATA));
  R('Datei ist AISV2 und enthält keinen Klartext', (()=>{ const s=fs.readFileSync(VAULT,'utf8'); let j=null; try{ j=JSON.parse(s); }catch(_){} return !!j&&j.magic==='AISV2'&&!s.includes('harness-quelle')&&!s.includes('0.0421'); })());
  R('Tresor nicht im Browser-Speicher', await js(`localStorage.getItem('ai-sachwert-vault')===null`));

  // Speichern-Dialoge (umgebogen): Backup, CSV mit BOM, PDF des Nachlass-Anhangs
  await js(`App.tab('export'); true`); dialogs.length=0;
  await click('button[data-action="exportVault"]'); await until(`/\\.vault gespeichert/.test(document.getElementById('export-msg').textContent)`,10000);
  { const f=fs.readdirSync(OUT).find(n=>/^sachwert-tresor-\d{4}-\d{2}-\d{2}\.vault$/.test(n)); let j=null; try{ j=f&&JSON.parse(fs.readFileSync(path.join(OUT,f),'utf8')); }catch(_){}
    R('Backup über den Dialog geschrieben (AISV2, 600)', !!f&&!!j&&j.magic==='AISV2'&&(fs.statSync(path.join(OUT,f)).mode&0o777)===0o600, f);
    R('Backup-Dialog mit .vault-Filter', dialogs.length===1&&dialogs[0].filters[0].extensions[0]==='vault'); }
  dialogs.length=0; await click('button[data-action="exportSteuertool"]'); await until(`/manual_buys\\.csv gespeichert/.test(document.getElementById('export-msg').textContent)`,10000);
  { const b=fs.readFileSync(path.join(OUT,'manual_buys.csv')); R('CSV über den Dialog, BOM erhalten, Inhalt 1:1', b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF&&b.toString('utf8').includes('harness-quelle-bisq'), {len:b.length}); }
  cancelDialog=true; fs.unlinkSync(path.join(OUT,'manual_buys.csv')); await js(`document.getElementById('export-msg').textContent=''; true`);
  await click('button[data-action="exportSteuertool"]'); await sleep(800);
  R('abgebrochener Dialog: keine Datei, keine Meldung', !fs.existsSync(path.join(OUT,'manual_buys.csv'))&&await js(`document.getElementById('export-msg').textContent===''`));
  cancelDialog=false;
  await click('button[data-action="openNachlass"]'); await until(visible('nachlass-overlay'),5000);
  await click('button[data-action="printNachlass"]'); await until(`/\\.pdf gespeichert/.test(document.getElementById('nl-msg').textContent)`,20000);
  { const f=fs.readdirSync(OUT).find(n=>/^nachlass-anhang-\d{4}-\d{2}-\d{2}\.pdf$/.test(n)); const b=f?fs.readFileSync(path.join(OUT,f)):Buffer.alloc(0);
    R('Nachlass-Anhang als PDF über den Dialog (printToPDF, %PDF-Kopf, > 1 KB)', !!f&&b.slice(0,5).toString()==='%PDF-'&&b.length>1024, {f,len:b.length}); }
  await click('#nachlass-overlay button[data-action="closeNachlass"]');
  // Download-Weg gesperrt: ein <a download> darf keine Datei erzeugen
  const dl=await new Promise(res=>{ const h=(_e,item)=>{ res('download-'+item.getFilename()); }; session.defaultSession.once('will-download',h);
    js(`(()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['x'])); a.download='harness-leak.txt'; a.click(); })()`); setTimeout(()=>res('blockiert'),1500); });
  R('Browser-Download wird verhindert', dl==='blockiert'||!fs.existsSync(path.join(process.env.HOME||'/','Downloads','harness-leak.txt')), dl);
}
async function restart(){
  R('Neustart: Sperrbildschirm statt Einrichtung', await until(visible('screen-lock'),15000)&&!(await js(visible('screen-setup'))));
  await fill('lock-pass',PP); await click('#unlock-btn');
  R('entsperrt mit der Passphrase', await until(visible('screen-app')));
  R('Eintrag aus der Datei da', await until(`(()=>{ App.tab('list'); return document.querySelector('#list-tbl tbody').textContent.includes('harness-quelle-bisq'); })()`,10000));
  R('Versionszeile nennt Linux-Desktop', await js(`(()=>{ App.tab('settings'); return /Linux-Desktop \\(Flatpak\\)$/.test(document.getElementById('about-line').textContent); })()`));
}
// Sperre beim Minimieren (Alien Pass Audit run-6 #1): backgroundThrottling:false schaltet visibilitychange ab, die Hülle meldet selbst
async function background(){
  R('Hintergrund: Sperrbildschirm', await until(visible('screen-lock'),15000));
  await fill('lock-pass',PP); await click('#unlock-btn'); R('Hintergrund: entsperrt', await until(visible('screen-app')));
  await js(`App.setAutolock('1'); true`); await sleep(600);
  win.minimize(); await sleep(800); win.restore(); await sleep(600);
  R('kurz minimiert bei 1 min: bleibt entsperrt', await js(visible('screen-app')));
  win.minimize(); await sleep(400); await js(`(()=>{ window.__dateNow=Date.now; Date.now=()=>window.__dateNow()+61000; })()`); win.restore();
  R('länger als Auto-Lock minimiert: gesperrt', await until(visible('screen-lock'),5000));
  await js(`(()=>{ Date.now=window.__dateNow; })()`);   // Date.now ist eine EIGENE Eigenschaft von Date — nie per delete „zurücksetzen“
  await fill('lock-pass','x'); win.hide(); await sleep(600); win.show(); await sleep(400);   // zweites Signal-Paar: verstecken/zeigen
  R('Verstecken leert getippte Eingaben', await js(`document.getElementById('lock-pass').value===''`));
  // Fensterwechsel (Alien Pass Audit run-8 #9): die Hülle meldet 'blur', die App leert nur Gate-Eingaben und sperrt nicht
  R('Hülle verdrahtet blur', fs.readFileSync(path.join(__dirname,'main.js'),'utf8').includes("win.on('blur',bg('blur'))"));
  await fill('lock-pass',PP); await click('#unlock-btn'); await until(visible('screen-app'));
  await js(`App.tab('settings'); true`); await fill('cp-cur','halb-getippt'); win.webContents.send('bg','blur'); await sleep(400);
  R('Fensterwechsel leert getippte Passphrase, sperrt nicht', await js(`document.getElementById('cp-cur').value===''`)&&await js(visible('screen-app')));
  await js(`App.setAutolock('5'); true`); await sleep(600);
}
async function unreadable(){
  R('Lesefehler: keine Einrichtung', await until(visible('screen-lock'),15000)&&!(await js(visible('screen-setup'))));
  R('Lesefehler: Meldung', /nicht lesbar|not readable/.test(await js(`document.getElementById('lock-err').textContent`)));
  await fill('lock-pass',PP); await click('#unlock-btn'); await sleep(800);
  R('Lesefehler: Entsperren bleibt gesperrt', await js(visible('screen-lock'))&&!(await js(visible('screen-app'))));
}

app.on('browser-window-created',(_e,w)=>{ if(win) return; win=w;
  w.webContents.once('did-finish-load',async()=>{
    try{
      await until(`document.readyState==='complete'&&typeof App!=='undefined'`,15000); await js('void (window.confirm=()=>true)');   // Rückfragen bestätigen (kein Dialog im Test)
      if(STEP==='fresh') await fresh(); else if(STEP==='restart') await restart(); else if(STEP==='unreadable') await unreadable();
      else if(STEP==='background') await background();
      else if(STEP==='hold'){ R('läuft',true); await sleep(Number(process.env.ST_HOLD||8000)); }
    }catch(e){ R('Ausnahme im Prüfprogramm',false,String(e&&e.stack||e)); }
    app.exit(0);
  });
});
