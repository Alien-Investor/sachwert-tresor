'use strict';
// Prüfprogramm für die echte Hülle (Sachwert-Tresor, Port aus Alien Pass): lädt main.js wie die App und prüft von innen (keine
// Fernsteuerung von außen — die Hülle verweigert --remote-debugging-*, und die Fuses sperren --inspect). Aufruf über verify-desktop.mjs.
// Gibt je Prüfung eine Zeile "R <json>" aus, nie Tresor- oder Zwischenablage-Inhalte. Die Speichern-Dialoge werden hier
// auf einen Pfad im Test-Home umgebogen (dialog.showSaveDialog), damit Backup/CSV/PDF ohne Portal durchlaufen.
const {app,BrowserWindow,Menu,session,clipboard,ClipboardItem,dialog,shell}=require('electron');
const path=require('path'); const fs=require('fs'); const net=require('net'); const dgram=require('dgram');
require('./main.js');
const opened=[]; shell.openExternal=async u=>{ opened.push(u); };   // nie wirklich den Browser öffnen, nur mitschreiben

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
// Wiederherstellen und WARTEN, bis das Fenster den Fokus wieder hat (KDE gibt ihn nach restore() erst verzögert) — Muster Alien Notes
async function restoreFocused(){ win.restore(); for(let i=0;i<30&&!win.isFocused();i++) await sleep(100); if(!win.isFocused()){ win.focus(); for(let i=0;i<30&&!win.isFocused();i++) await sleep(100); } await sleep(300); return win.isFocused()&&!win.isMinimized(); }   // Rückgabe als info (Notes Release-Audit v1.8 C-8)
// KDE gibt einem frischen Testfenster den Fokus teils nur kurz und dann dem vorher aktiven Fenster zurück — vor fokusabhängigen Schritten nachholen (Notes v1.8)
async function ensureFocus(){ if(!win.isFocused()){ win.focus(); for(let i=0;i<30&&!win.isFocused();i++) await sleep(100); await sleep(200); } return win.isFocused(); }
const key=c=>{ win.webContents.sendInputEvent({type:'char',keyCode:c}); };
const press=(k,mods)=>{ win.webContents.sendInputEvent({type:'keyDown',keyCode:k,modifiers:mods||[]}); win.webContents.sendInputEvent({type:'keyUp',keyCode:k,modifiers:mods||[]}); };
const realClick=async sel=>{ const r=await js(`(()=>{const b=document.querySelector(${JSON.stringify(sel)}); b.scrollIntoView({block:'center'}); const q=b.getBoundingClientRect(); return {x:Math.round(q.left+q.width/2),y:Math.round(q.top+q.height/2)};})()`);
  win.webContents.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1}); win.webContents.sendInputEvent({type:'mouseUp',x:r.x,y:r.y,button:'left',clickCount:1}); await sleep(400); };
const prim=()=>clipboard.selection.readText();
const DATA=path.join(process.env.XDG_DATA_HOME,'sachwert-tresor'), VAULT=path.join(DATA,'vault.aisv');
const OUT=path.join(process.env.XDG_DATA_HOME,'..','dialog'); fs.mkdirSync(OUT,{recursive:true});
// Speichern-Dialog umbiegen: liefert einen Pfad im Test-Home (oder Abbruch, wenn __cancel gesetzt)
let cancelDialog=false; const dialogs=[];
// v3.11 (Schritt sichern, Muster Alien Pass v1.22): dlgNext = Antwort für genau den nächsten Dialog; dlgWait = der nächste Dialog bleibt offen, bis der
// Test ihn mit w.frei(<Antwort>) schließt (Sperre bei offenem Dialog, Querfund Notes 1.12 b-1)
let dlgNext=null, dlgWait=null;
dialog.showSaveDialog=async(_w,o)=>{ dialogs.push(o);
  if(dlgWait){ const w=dlgWait; dlgWait=null; return new Promise(r=>{ w.frei=r; }); }
  if(dlgNext){ const n=dlgNext; dlgNext=null; return n; }
  if(cancelDialog) return {canceled:true}; return {canceled:false,filePath:path.join(OUT,o.defaultPath)}; };

async function fresh(){
  R('lädt nur app://tresor/index.html', win.webContents.getURL()==='app://tresor/index.html', win.webContents.getURL());
  R('kein Node im Renderer', await js(`typeof require==='undefined'&&typeof process==='undefined'&&typeof module==='undefined'`));
  const keys=await js(`Object.keys(window.AlienDesktop).sort().join(',')`);
  R('Brücke hat genau clip, onBackground, onLock, saveBackup, savePdf, saveText, store', keys==='clip,onBackground,onLock,saveBackup,savePdf,saveText,store', keys);
  { const sub=await js(`['clip','store','saveText','savePdf'].map(k=>k+':'+Object.keys(AlienDesktop[k]).sort().join('+')).join(' ')`);
    R('Unterschlüssel der Brücke genau (seit v3.11 saveText/savePdf = pick+write, run-11 c-5)', sub==='clip:clear+selected+write store:del+read+write saveText:pick+write savePdf:pick+write', sub); }
  R('clip hat genau clear, selected, write', await js(`Object.keys(window.AlienDesktop.clip).sort().join(',')`)==='clear,selected,write');
  R('Scrollbalken im Neon-Look greift in der echten Hülle: (hover:hover) and (pointer:fine) trifft zu (v3.10, wie Alien Pass Review v1.20 H-5; Audit run-10 b-3)', await js(`matchMedia('(hover:hover) and (pointer:fine)').matches`));
  R('fetch nach außen scheitert', await js(`fetch('https://example.org/').then(()=>false,()=>true)`));
  R('window.open verweigert', await js(`window.open('https://example.org/')===null`));
  await js(`location.href='https://example.org/'`).catch(()=>{}); await sleep(600);
  R('Navigation verweigert', win.webContents.getURL()==='app://tresor/index.html', win.webContents.getURL());
  // Links (v3.7, Vorlage Alien Notes v1.7): nur die feste Liste (Spendenseite DE/EN) geht an den System-Browser, alles andere verpufft.
  // openOutside lässt höchstens einen Link je Sekunde durch → vor jedem erwarteten Öffnen 1,1 s Abstand
  const tryOpen=async(u,how)=>{ await sleep(1100); opened.length=0;
    if(how==='open') await js(`window.open(${JSON.stringify(u)})`); else await js(`location.href=${JSON.stringify(u)}`).catch(()=>{});
    await sleep(300); return opened.slice(); };
  const onApp=()=>win.webContents.getURL()==='app://tresor/index.html';
  for(const u of ['https://alien-investor.org/spenden.html','https://alien-investor.org/en/spenden.html'])
    { const o=await tryOpen(u,'open'); R('Link extern geöffnet: '+u, o.length===1&&o[0]===u, o); }
  { const o=await tryOpen('https://alien-investor.org/en/spenden.html','nav');
    R('Link per Navigation extern, Seite bleibt', o.length===1&&o[0]==='https://alien-investor.org/en/spenden.html'&&onApp(), o); }
  { await sleep(1100); R('window.open auf Listen-Link liefert trotzdem kein Fenster (deny)', await js(`window.open('https://alien-investor.org/spenden.html')===null`)&&BrowserWindow.getAllWindows().length===1, BrowserWindow.getAllWindows().length); }
  { const o=await tryOpen('HTTPS://ALIEN-INVESTOR.ORG:443/spenden.html','open');
    R('nicht-kanonische Schreibweise geht als kanonischer href hinaus', o.length===1&&o[0]==='https://alien-investor.org/spenden.html', o); }
  for(const [l,want] of [['de','https://alien-investor.org/spenden.html'],['en','https://alien-investor.org/en/spenden.html']]){
    await sleep(1100); opened.length=0; await js(`setLang(${JSON.stringify(l)}); document.getElementById('donate-link').click()`); await sleep(300);
    R('Spenden-Blitz sichtbar und extern geöffnet ('+l+')', opened.length===1&&opened[0]===want&&onApp()&&await js(`getComputedStyle(document.getElementById('donate-link')).display!=='none'`), opened.slice()); }
  await js(`setLang('de')`);
  { await sleep(1100); opened.length=0; await js(`for(let i=0;i<20;i++) window.open('https://alien-investor.org/spenden.html')`); await sleep(400);
    R('Fensterflut gedrosselt (20 × window.open → 1)', opened.length===1&&BrowserWindow.getAllWindows().length===1, {n:opened.length,win:BrowserWindow.getAllWindows().length}); }
  for(const u of ['https://example.org/','https://alien-investor.org/anderes.html','https://alien-investor.org/spenden.html/../x','http://alien-investor.org/spenden.html','https://alien-investor.org.evil.com/spenden.html','file:///etc/passwd','javascript:alert(1)',
      'https://alien-investor.org/spenden.html?ref=x','https://alien-investor.org/spenden.html#x','https://user:pw@alien-investor.org/spenden.html','https://alien-investor.org:8443/spenden.html','https://www.alien-investor.org/spenden.html','https://alien-investor.org/spenden.html/',
      'https://evilalien-investor.org/spenden.html','https://alien-investor.org/spenden.htmlx','https://evil.example/alien-investor.org/spenden.html','https://evil.example/?u=https://alien-investor.org/spenden.html'])
    for(const how of (u.startsWith('javascript:')?['open']:['open','nav']))   // javascript: per location.href liefe IM Renderer, ist keine Navigation
      { const o=await tryOpen(u,how); R('Link verweigert ('+how+'): '+u, o.length===0&&onApp(), {o,url:win.webContents.getURL()}); }
  // Handler direkt, ohne Chromium dazwischen (das kanonisiert URLs schon vorher): preventDefault, deny und der geprüfte href (Alien Pass Release-Audit v1.18 C M1–M3)
  { const h={}; let woh=null; const fake={on:(n,f)=>{ h[n]=f; },setWindowOpenHandler:f=>{ woh=f; },setWebRTCIPHandlingPolicy:()=>{}};
    try{ app.emit('web-contents-created',{},fake); }catch(e){ R('Handler direkt: Ausnahme',false,String(e)); }
    await sleep(1100); opened.length=0; let pd=0;
    if(h['will-navigate']) h['will-navigate']({preventDefault:()=>pd++},' HTTPS://ALIEN-INVESTOR.ORG:443/en/../spenden.html\t');
    R('will-navigate (direkt): preventDefault + kanonischer href', pd===1&&opened.length===1&&opened[0]==='https://alien-investor.org/spenden.html', {pd,opened:opened.slice()});
    await sleep(1100); opened.length=0; pd=0;
    if(h['will-navigate']) h['will-navigate']({preventDefault:()=>pd++},'https://example.org/');
    R('will-navigate (direkt): fremde Adresse → preventDefault, nichts geöffnet', pd===1&&opened.length===0, {pd,opened:opened.slice()});
    await sleep(1100); opened.length=0; const r=woh?woh({url:'https://alien-investor.org/en/spenden.html'}):null;
    R('setWindowOpenHandler (direkt): deny auch für Listen-Links', !!r&&r.action==='deny'&&opened.length===1, {r,opened:opened.slice()});
    await sleep(1100); opened.length=0; let n=0; for(let i=0;i<3;i++){ if(woh) woh({url:'https://alien-investor.org/spenden.html'}); await sleep(400); n=opened.length; }
    R('Bremse: drei Links im Abstand von 400 ms → 1', n===1, n);
    // Zurückgestellte Systemuhr legt den Link nicht still (monotone Uhr): main.js läuft im selben Realm
    const dn=Date.now; Date.now=()=>dn()-3600e3; await sleep(1100); opened.length=0; if(woh) woh({url:'https://alien-investor.org/spenden.html'}); Date.now=dn;
    R('Bremse übersteht eine zurückgestellte Uhr (1 h)', opened.length===1, opened.slice()); }
  const ses=session.defaultSession;
  const st=async u=>{ try{ return (await ses.fetch(u)).status; }catch(e){ return 'FEHLER'; } };
  R('Protokoll liefert index.html', await st('app://tresor/index.html')===200);
  R('Protokoll kennt kein Web-Manifest mehr (seit v3.6.3 nicht im Bundle)', await st('app://tresor/manifest.webmanifest')===404);
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
    try{await AlienDesktop.clip.selected('x');r.push('sel-OK')}catch(e){r.push('sel-DENIED')}
    try{await AlienDesktop.saveBackup('a.vault','x');r.push('save-OK')}catch(e){r.push('save-DENIED')}
    try{await AlienDesktop.saveText.pick('a.csv');r.push('text-OK')}catch(e){r.push('text-DENIED')}
    try{await AlienDesktop.saveText.write('0'.repeat(32),'x');r.push('textw-OK')}catch(e){r.push('textw-DENIED')}
    try{await AlienDesktop.savePdf.pick('a.pdf');r.push('pdf-OK')}catch(e){r.push('pdf-DENIED')}
    try{await AlienDesktop.savePdf.write('0'.repeat(32));r.push('pdfw-OK')}catch(e){r.push('pdfw-DENIED')}
    return r.join(',');})()`,true);
  R('fremder Frame: alle Brücken-Aufrufe abgewiesen (seit v3.11 auch pick/write)', foreign==='read-DENIED,write-DENIED,clip-DENIED,sel-DENIED,save-DENIED,text-DENIED,textw-DENIED,pdf-DENIED,pdfw-DENIED', foreign);
  w2.destroy();

  // Zwischenablage: Hinweis gesetzt, eigene Kopie wird gelöscht, fremde bleibt
  const M1='st-harness-'+process.pid+'-a', M2='st-harness-'+process.pid+'-b';
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M1)}})`);
  R('Kopie trägt den KDE-Hinweis', await clipboard.has(KDE_HINT)&&(await clipboard.readText())===M1);
  await sleep(800); const kopieInPrim=(await prim())===M1;   // X11/KDE: Klipper spiegelt die Kopie in PRIMARY (Messung, je nach Klipper-Einstellung)
  await clipboard.selection.writeText(M1);   // Spiegelung deterministisch nachstellen — der Test prüft den PRIMARY-Zweig auch ohne Klipper (Release-Audit v3.7 C-5)
  const vorM1=(await prim())===M1;
  await js(`AlienDesktop.clip.clear()`);
  R('eigene Kopie gelöscht', (await clipboard.readText())!==M1);
  R('eigene Kopie auch aus PRIMARY gelöscht (v3.7, Klipper spiegelt hier: '+kopieInPrim+')', vorM1&&(await prim())==='', {vorM1,kopieInPrim});
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M1)}})`);
  await clipboard.write([new ClipboardItem({'text/plain':new Blob([M2],{type:'text/plain'}),[KDE_HINT]:new Blob(['secret'])})]);   // „Nutzer kopiert etwas anderes“
  await js(`AlienDesktop.clip.clear()`);
  R('fremde Kopie bleibt stehen', (await clipboard.readText())===M2);
  await clipboard.clear();
  // X11-Auswahl (v3.7): gemeldete eigene Markierung wird gelöscht, eine fremde bleibt
  const M3='st-harness-'+process.pid+'-sel', M4='st-harness-'+process.pid+'-fremd';
  await clipboard.selection.writeText(M3); await js(`AlienDesktop.clip.selected(${JSON.stringify(M3)})`); await js(`AlienDesktop.clip.clear()`);
  R('eigene Markierung aus der Auswahl gelöscht', (await prim())!==M3);
  await js(`AlienDesktop.clip.selected(${JSON.stringify(M3)})`); await clipboard.selection.writeText(M4); await js(`AlienDesktop.clip.clear()`);
  R('fremde Markierung bleibt stehen', (await prim())===M4);
  // a2-1 (v3.10, wie Alien Pass v1.21 / Notes v1.11): die eigene Kopie ist ROH gehasht — eine Kopie mit NBSP/U+FFFC muss weiter aus CLIPBOARD und dem
  // Klipper-Spiegel in PRIMARY verschwinden (Pass-Mutant „nur sha(nsel(cur))“). Eine Meldung nur aus U+FFFC oder Leerraum merkt nichts (Frühausstieg).
  // Tresor zusätzlich: nsel trimmt die Ränder — getSelection() hängt am Anfang des nächsten Blocks ein „\n“ an, PRIMARY nicht (gemessen, Audit run-10)
  { const FC=String.fromCharCode(0xfffc), NBS=String.fromCharCode(0xa0), K='st-harness-'+process.pid+NBS+'kopie'+FC+'x';
    await js(`AlienDesktop.clip.write({text:${JSON.stringify(K)}})`); await clipboard.selection.writeText(K);
    const vor=(await clipboard.readText())===K&&(await prim())===K;
    await js(`AlienDesktop.clip.clear()`);
    R('a2-1: eigene Kopie mit NBSP/U+FFFC aus CLIPBOARD und PRIMARY gelöscht (Roh-Vergleich)', vor&&(await clipboard.readText())!==K&&(await prim())==='', {vor});
    await clipboard.clear(); await clipboard.selection.clear();
    await js(`AlienDesktop.clip.selected(${JSON.stringify(FC)})`); await clipboard.selection.writeText(FC+FC); await js(`AlienDesktop.clip.clear()`);
    R('a2-1: Meldung nur aus U+FFFC merkt nichts, fremde Auswahl aus U+FFFC bleibt stehen (Frühausstieg)', (await prim())===FC+FC);
    await clipboard.selection.clear();
    await js(`AlienDesktop.clip.selected('\\n \\n')`); await clipboard.selection.writeText(' \n'); await js(`AlienDesktop.clip.clear()`);
    R('a2-1: Meldung nur aus Leerraum merkt nichts, fremde Auswahl aus Leerraum bleibt stehen (Frühausstieg nach trim)', (await prim())===' \n');
    await clipboard.selection.clear();
    const T='st-harness-'+process.pid+'-rand';
    await js(`AlienDesktop.clip.selected(${JSON.stringify(T+'\n')})`); await clipboard.selection.writeText(T); await js(`AlienDesktop.clip.clear()`);
    R('a2-1: Meldung mit „\\n“ am Rand, PRIMARY ohne — gelöscht (trim, Tresor v3.10)', (await prim())==='');
    await clipboard.selection.writeText('\n'+T+'\n'); await js(`AlienDesktop.clip.selected(${JSON.stringify(T)})`); await js(`AlienDesktop.clip.clear()`);
    R('a2-1: PRIMARY mit Rand-Zeilenumbrüchen, Meldung ohne — gelöscht (trim beidseitig)', (await prim())==='');
    await clipboard.selection.clear(); }
  { let big='bad'; try{ big=await js(`AlienDesktop.clip.selected('y'.repeat(16*1024*1024+1)).then(()=>'ok',()=>'abgewiesen')`); }catch(_){}
    R('Markierung über SEL_MAX (16 Mi) abgewiesen', big==='abgewiesen', big); }
  // Ab hier v3.8 — Tests aus dem Harness von Alien Notes v1.8 (= Alien Pass v1.19 + Notes-Release-Audit run-6)
  // Hash-Ring (R2-N2): eine spätere falsche Meldung (Wert eines anderen Feldes, das nicht in PRIMARY liegt) verdrängt die richtige nicht mehr
  { const P='st-harness-'+process.pid+'-ring-p';
    await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`);
    for(let i=0;i<7;i++) await js(`AlienDesktop.clip.selected(${JSON.stringify('anderes-feld-'+i)})`);
    await js(`AlienDesktop.clip.clear()`);
    R('Hash-Ring: Markierung nach 7 fremden Meldungen trotzdem aus PRIMARY gelöscht', (await prim())==='', {prim:(await prim()).length});
    await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`);
    // P, 7 fremde, dann eine leere: würde die leere gehasht, verdrängte sie als 9. Eintrag P (acht leere allein entdoppelt der Ring zu einem — Release-Audit v3.8 C-3)
    for(let i=0;i<7;i++) await js(`AlienDesktop.clip.selected(${JSON.stringify('anderes-feld-'+i)})`);
    await js(`AlienDesktop.clip.selected('')`);
    await js(`AlienDesktop.clip.clear()`);
    R('Hash-Ring: eine leere Meldung verdrängt nichts (P, 7 fremde, leer → P gelöscht)', (await prim())==='', {prim:(await prim()).length});
    await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`);
    for(let i=0;i<7;i++) await js(`AlienDesktop.clip.selected(${JSON.stringify('anderes-feld-'+i)})`);
    await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`); await js(`AlienDesktop.clip.selected('anderes-feld-x')`);   // P erneut gemeldet → nach hinten, die 9. Meldung verdrängt nicht P
    await js(`AlienDesktop.clip.clear()`);
    R('Hash-Ring: erneut gemeldete Markierung rückt nach hinten (P, 7 fremde, P, 1 fremde → P gelöscht)', (await prim())==='', {prim:(await prim()).length});
    await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`);
    for(let i=0;i<8;i++) await js(`AlienDesktop.clip.selected(${JSON.stringify('anderes-feld-'+i)})`);
    await js(`AlienDesktop.clip.clear()`);
    R('Hash-Ring: Grenze 8 — nach 8 fremden Meldungen ist die erste verdrängt (bleibt stehen)', (await prim())===P, {prim:(await prim()).length});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Spiegelung Markierung → CLIPBOARD: in Notes am 04.10.2026 einmal beobachtet, sonst nicht — darum nur protokolliert; hart geprüft wird die Abwehr (Pass A-4)
  { const P='st-harness-'+process.pid+'-rueck';
    await clipboard.clear(); await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`); await sleep(800);
    const gespiegelt=(await clipboard.readText())===P;
    R('Messung: Markierung von Klipper nach CLIPBOARD gespiegelt: '+gespiegelt, true, {gespiegelt});
    await clipboard.writeText(P); await js(`AlienDesktop.clip.clear()`);
    R('Abwehr: steht die Markierung in CLIPBOARD, wird sie dort mitgelöscht', (await clipboard.readText())!==P&&(await prim())==='');
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Hängender Besitzer (Pass A-1/R2-1): das Lesen von CLIPBOARD hängt FÜR IMMER — PRIMARY wird trotzdem gelöscht, die Kette läuft weiter
  { const P='st-harness-'+process.pid+'-haengt-p', N='st-harness-'+process.pid+'-nach-haenger', orig=clipboard.readText;
    clipboard.readText=function(){ return new Promise(()=>{}); };
    try{ await clipboard.selection.writeText(P); await js(`AlienDesktop.clip.selected(${JSON.stringify(P)})`);
      const t0=Date.now(); const r1=await js(`Promise.race([AlienDesktop.clip.clear().then(()=>'ok',()=>'abgelehnt'),new Promise(r=>setTimeout(()=>r('haengt'),6000))])`); const ms=Date.now()-t0;
      R('CLIPBOARD-Lesen hängt dauerhaft: PRIMARY trotzdem gelöscht, Löschen kehrt nach ~2 s zurück', r1==='ok'&&ms>=1800&&ms<4500&&(await prim())==='', {r1,ms,prim:(await prim()).length}); }
    finally{ clipboard.readText=orig; }
    // … und danach: einmaliger Hänger bei einer Kopie — die Hülle fasst selbst nach (kein weiteres clear der App)
    let einmal=true; clipboard.readText=function(...a){ if(einmal){ einmal=false; return new Promise(()=>{}); } return orig.apply(this,a); };
    try{ const M='st-harness-'+process.pid+'-nachfassen';
      await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`); const drin=(await orig.call(clipboard))===M;   // Vorbedingung: Kopie steht
      const t0=Date.now(); await js(`AlienDesktop.clip.clear().catch(()=>'abgelehnt')`); const ms=Date.now()-t0;   // Vorbedingung: das Lesen hing wirklich (~2 s)
      let weg=false; for(let i=0;i<40&&!weg;i++){ await sleep(100); weg=(await orig.call(clipboard))!==M; }
      R('einmaliger Hänger: die Hülle fasst nach und löscht die Kopie ohne neues clear der App', drin&&ms>=1800&&weg, {drin,ms,weg}); }
    finally{ clipboard.readText=orig; }
    await js(`AlienDesktop.clip.write({text:${JSON.stringify(N)}})`); await js(`AlienDesktop.clip.clear().catch(()=>'abgelehnt')`);
    R('nach dem Hänger: Kette läuft, das nächste Löschen löscht', (await clipboard.readText())!==N);
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Spätes Schreiben (Pass R2-2): clipboard.write braucht 2,5 s — die App bekommt eine Ablehnung (setzt keine Frist), die doch noch gelandete Kopie wird gelöscht
  { const M='st-harness-'+process.pid+'-spaet', ow=clipboard.write;
    // Klipper spiegelt erst NACH dem Landen — hier 300 ms danach nachgestellt (Pass N-2)
    clipboard.write=async function(...a){ await sleep(2500); const r=await ow.apply(this,a); setTimeout(()=>{ clipboard.selection.writeText(M); },300); return r; };
    let r='?'; try{ r=await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}}).then(()=>'ok',()=>'abgelehnt')`); }
    finally{ clipboard.write=ow; }
    await sleep(4000);
    R('spätes Schreiben: App bekommt Ablehnung, die gelandete Kopie ist danach aus CLIPBOARD und PRIMARY weg', r==='abgelehnt'&&(await clipboard.readText())!==M&&(await prim())==='', {r,clip:(await clipboard.readText())===M,prim:(await prim()).length});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Kappung der offenen Hashes wirft die ÄLTESTEN (Pass N-1): 4 × (Kopie + 8 Markierungen) = 36 > 32 mit hängendem PRIMARY-Lesen (Notes C-1),
  // danach erholt sich der Besitzer — die NEUESTE Markierung muss trotzdem aus PRIMARY verschwinden
  { let vorP2=false; const tK=Date.now(), sr=clipboard.selection.readText, P2='zyklus4-markierung-7';   // unter X11 liegt immer die letzte Markierung in PRIMARY; wirft die Kappung die NEUESTEN, fehlt genau sie
    clipboard.selection.readText=function(){ return new Promise(()=>{}); };
    try{ for(const z of ['zyklus1','zyklus2','zyklus3','zyklus4']){ await js(`AlienDesktop.clip.write({text:${JSON.stringify('st-harness-'+process.pid+'-'+z)}})`);
        for(let i=0;i<8;i++) await js(`AlienDesktop.clip.selected(${JSON.stringify(z+'-markierung-'+i)})`);
        await js(`AlienDesktop.clip.clear().catch(()=>0)`); }
      await clipboard.selection.writeText(P2); vorP2=(await sr.call(clipboard.selection))===P2; }   // liegt schon WÄHREND der Hängephase in PRIMARY (Notes R2-A5)
    finally{ clipboard.selection.readText=sr; }
    let weg=false; for(let i=0;i<50&&!weg;i++){ await sleep(100); weg=(await prim())===''; }
    // Ist das Nachfassen nach der langen Hängephase schon im 30-s-Takt (N-3, gewollt), löscht das nächste Löschen der App — auch das findet die neueste
    // Markierung nur, wenn die Kappung die ÄLTESTEN geworfen hat
    const perNachfassen=weg; if(!weg){ await js(`AlienDesktop.clip.clear()`); await sleep(200); weg=(await prim())===''; }
    R('Kappung der offenen Hashes (36 > 32) wirft die ältesten: neueste Markierung nach Erholung aus PRIMARY', vorP2&&weg, {vorP2,ms:Date.now()-tK,perNachfassen});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Abgelehntes Lesen zählt wie Hängen (Pass N-5): einmal lehnt readText ab — die Hülle fasst nach, die Kopie verschwindet ohne neues clear der App
  { const M='st-harness-'+process.pid+'-abgelehnt', orig=clipboard.readText; let einmal=true;
    clipboard.readText=function(...a){ if(einmal){ einmal=false; return Promise.reject(new Error('X11')); } return orig.apply(this,a); };
    try{ await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`); await js(`AlienDesktop.clip.clear().catch(()=>0)`);
      let weg=false; for(let i=0;i<40&&!weg;i++){ await sleep(100); weg=(await orig.call(clipboard))!==M; }
      R('abgelehntes Lesen: die Hülle fasst nach und löscht die Kopie', !einmal&&weg, {weg}); }
    finally{ clipboard.readText=orig; }
    await clipboard.clear(); await clipboard.selection.clear(); }
  // CLIP_MAX 16 Mi (markierte lange Liste, v3.7): darüber abgewiesen — die angenommene lange Kopie prüft restart() über Strg+C (60.000 Zeichen)
  { let big='bad'; try{ big=await js(`AlienDesktop.clip.write({text:'z'.repeat(16*1024*1024+1)}).then(()=>'ok',()=>'abgewiesen')`); }catch(_){}
    R('Kopie über CLIP_MAX (16 Mi) abgewiesen', big==='abgewiesen', big);
    // genau CLIP_MAX: angenommen, gelandet, gelöscht — misst nebenbei, ob 16 Mi unter LINK_MS 2 s landen (sonst „spät“, Release-Audit v3.8 A/C-4)
    const t0=Date.now(); const genau=await js(`AlienDesktop.clip.write({text:'z'.repeat(16*1024*1024)}).then(()=>'ok',e=>'abgelehnt:'+String(e&&e.message).slice(-20))`); const ms=Date.now()-t0;
    const len=(await clipboard.readText()).length; await js(`AlienDesktop.clip.clear()`); const nach=(await clipboard.readText()).length;
    R('Kopie mit genau CLIP_MAX (16 Mi) angenommen, gelandet und wieder gelöscht', genau==='ok'&&len===16*1024*1024&&nach!==16*1024*1024, {genau,ms,len,nach});
    // SEL_MAX: nichts Echtes in die X11-Auswahl (trüge keinen KDE-Hinweis, Klipper legte 16 MB in seinen Verlauf — R2-2) — PRIMARY-Lesen gestubbt, clear gezählt
    { const sr=clipboard.selection.readText, sc=clipboard.selection.clear, S16='s'.repeat(16*1024*1024); let gel=0;
      clipboard.selection.readText=async()=>S16; clipboard.selection.clear=async()=>{ gel++; };
      let sg='?'; try{ sg=await js(`AlienDesktop.clip.selected('s'.repeat(16*1024*1024)).then(()=>'ok',()=>'abgewiesen')`); await js(`AlienDesktop.clip.clear()`); }
      finally{ clipboard.selection.readText=sr; clipboard.selection.clear=sc; }
      R('Markierung mit genau SEL_MAX (16 Mi) angenommen und als eigene erkannt (PRIMARY gelöscht, gestubbt)', sg==='ok'&&gel>=1, {sg,gel}); }
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Wettlauf mit einer KOPIE (Notes v1.8): Kopie während eines laufenden Löschens — die Kette schreibt sie NACH dem Löschen, das nächste Löschen nimmt sie mit
  { const M6='st-harness-'+process.pid+'-lauf-k', M7='st-harness-'+process.pid+'-mitten-k';
    await js(`AlienDesktop.clip.write({text:${JSON.stringify(M6)}})`); await sleep(300);
    await js(`(()=>{ AlienDesktop.clip.clear(); AlienDesktop.clip.write({text:${JSON.stringify(M7)}}); return true; })()`); await sleep(600);
    const drin=(await clipboard.readText())===M7;   // Vorbedingung: die neue Kopie steht
    await clipboard.selection.writeText(M7);   // Klipper-Spiegelung
    await js(`AlienDesktop.clip.clear()`); await sleep(200);
    R('Kopie während eines laufenden Löschens: beim nächsten Löschen aus CLIPBOARD und PRIMARY', drin&&(await clipboard.readText())!==M7&&(await prim())==='', {drin});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Wettlauf (Release-Audit v3.7 A-1): eine Meldung, die während eines laufenden Löschens ankommt (readText ist asynchron), muss beim nächsten Löschen weg
  { const M6='st-harness-'+process.pid+'-lauf', X='st-harness-'+process.pid+'-mitten';
    await js(`AlienDesktop.clip.write({text:${JSON.stringify(M6)}})`); await sleep(800); await clipboard.selection.writeText(X);
    await js(`(()=>{ AlienDesktop.clip.clear(); AlienDesktop.clip.selected(${JSON.stringify(X)}); return true; })()`); await sleep(400);
    await js(`AlienDesktop.clip.clear()`); await sleep(200);
    R('Markierung während eines laufenden Löschens gemeldet: beim nächsten Löschen aus PRIMARY', (await prim())==='', {prim:(await prim()).length});
    await clipboard.clear(); await clipboard.selection.clear(); }
  await clipboard.selection.clear();

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
  // Strg+C auf Seitentext (v3.7): über die Brücke mit KDE-Hinweis, nicht Chromium. Wie eine echte Maus-Markierung: Fokus aus jedem Eingabefeld nehmen.
  await js(`(()=>{ App.tab('list'); if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); const n=[...document.querySelectorAll('#list-tbl tbody td')].find(x=>x.textContent.includes('harness-quelle-bisq')); const r=document.createRange(); r.selectNodeContents(n); const g=getSelection(); g.removeAllRanges(); g.addRange(r); document.execCommand('copy'); g.removeAllRanges(); })()`);
  await sleep(400);
  R('Strg+C auf Seitentext: Kopie über die Brücke mit KDE-Hinweis', await clipboard.has(KDE_HINT)&&(await clipboard.readText()).includes('harness-quelle-bisq'), {hint:await clipboard.has(KDE_HINT),len:(await clipboard.readText()).length});
  await js(`AlienDesktop.clip.clear()`); await clipboard.clear();
  const M5='st-harness-'+process.pid+'-cut';
  await js(`(()=>{ App.tab('add'); const n=document.getElementById('f-src-btc'); n.value='vor '+${JSON.stringify(M5)}; n.focus(); n.setSelectionRange(4,n.value.length); })()`);
  win.webContents.cut(); await sleep(500);
  R('Strg+X: Kopie mit KDE-Hinweis', await clipboard.has(KDE_HINT)&&(await clipboard.readText())===M5);
  R('Strg+X: Text aus dem Feld entfernt', await js(`document.getElementById('f-src-btc').value==='vor '`));
  await js(`AlienDesktop.clip.clear()`); await sleep(200);
  R('Strg+X: Kopie wird wieder gelöscht', (await clipboard.readText())!==M5);
  await clipboard.clear(); await clipboard.selection.clear(); await js(`(()=>{ document.getElementById('f-src-btc').value=''; App.tab('list'); })()`);
  // Download-Weg gesperrt: ein <a download> darf keine Datei erzeugen
  const dl=await new Promise(res=>{ const h=(_e,item)=>{ res('download-'+item.getFilename()); }; session.defaultSession.once('will-download',h);
    js(`(()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['x'])); a.download='harness-leak.txt'; a.click(); })()`); setTimeout(()=>res('blockiert'),1500); });
  R('Browser-Download wird verhindert', dl==='blockiert'||!fs.existsSync(path.join(process.env.HOME||'/','Downloads','harness-leak.txt')), dl);
}
async function restart(){
  R('Neustart: Sperrbildschirm statt Einrichtung', await until(visible('screen-lock'),15000)&&!(await js(visible('screen-setup'))));
  // Erst den Fensterfokus abwarten: KDE gibt ihn einem frischen Fenster verzögert, teils mit blur/focus-Pendeln — ein spätes blur leert die gerade
  // eingesetzte Passphrase (Gate-Hygiene), Entsperren liefe ins Leere und die Prüfungen fielen als Kaskade (Notes 04.10.2026)
  for(let i=0;i<30&&!win.isFocused();i++) await sleep(100);
  if(!win.isFocused()){ win.focus(); for(let i=0;i<30&&!win.isFocused();i++) await sleep(100); }
  await sleep(400);
  R('Neustart: Testfenster hat den Fokus (sonst kippen Tab-/Auge-/PRIMARY-Prüfungen als Kaskade — Umgebung, nicht App: während verify-desktop nicht am Desktop arbeiten)', win.isFocused());
  // blur-Zähler (Release-Audit v3.8 R2-1): ein leeres Feld gilt nur dann als Umgebung, wenn seit dem Füllen wirklich ein blur kam
  let blurN=0; const onBlur=()=>blurN++; win.on('blur',onBlur);
  const focVorPP=await ensureFocus(); let b0=blurN; await fill('lock-pass',PP);
  await clipboard.selection.writeText('vorher-'+process.pid);
  await js(`document.getElementById('lock-pass').focus(); true`); await sleep(200);
  const leer1=!(await js(`document.getElementById('lock-pass').value.length`)), blur1=blurN>b0;
  R('Sperrbildschirm: Passphrase nach focus() noch im Feld, oder es kam ein blur (Umgebung)', !leer1||blur1, {leer1,blur1});
  if(!(await ensureFocus())||leer1){ await ensureFocus(); b0=blurN; await fill('lock-pass',PP); await js(`document.getElementById('lock-pass').focus(); true`); await sleep(200); }   // Fokus kurz verloren → blur leerte das Feld
  b0=blurN; press('A',['control']); await sleep(500);   // Pendeln vor der ersten Prüfung zählt hier nicht mehr (Nachprüfung N-2)
  R('Sperrbildschirm: Strg+A im maskierten Feld legt die Passphrase in PRIMARY (Chromium) — darum muss die App sie melden', (await prim())===PP);
  const vorKlick={len:await js(`document.getElementById('lock-pass').value.length`),foc:win.isFocused(),focVorPP,blur:blurN>b0,nachgefuelltVorStrgA:leer1};
  // Nur als Umgebung werten, wenn seit dem Füllen ein blur kam; leer ohne blur wäre eine App-Regression (Release-Audit v3.8 C-9/R2-1)
  R('Sperrbildschirm: Passphrase steht vor dem Klick noch im Feld, oder es kam ein blur (Umgebung)', vorKlick.len>0||vorKlick.blur, vorKlick);
  win.removeListener('blur',onBlur);
  if(!vorKlick.len){ await ensureFocus(); await fill('lock-pass',PP); vorKlick.nachgefuellt=true; }
  await click('#unlock-btn');
  R('entsperrt mit der Passphrase', await until(visible('screen-app')), vorKlick);
  { const t0=Date.now(); let weg=false; while(Date.now()-t0<5000&&!(weg=(await prim())==='')) await sleep(100);   // unter Last kann das Löschen nach Argon2 dauern (Pass R2-5)
    R('Sperrbildschirm: markierte Passphrase nach dem Entsperren aus der Auswahl', weg, {ms:Date.now()-t0}); }
  await clipboard.selection.clear();
  R('Eintrag aus der Datei da', await until(`(()=>{ App.tab('list'); return document.querySelector('#list-tbl tbody').textContent.includes('harness-quelle-bisq'); })()`,10000));
  R('Versionszeile nennt Linux-Desktop', await js(`(()=>{ App.tab('settings'); return /Linux-Desktop \\(Flatpak\\)$/.test(document.getElementById('about-line').textContent); })()`));
  // Kurszeile aus Mission Control (v3.9): echtes Strg+V aus der Zwischenablage ins Feld — die Hülle darf das Einfügen nicht abfangen
  { const L='ALIEN-KURSE/1 t='+new Date(Date.now()-60000).toISOString().slice(0,16)+'Z btc=61234.5';
    await js(`(()=>{ App.tab('dash'); return true; })()`); await ensureFocus();
    const vorher=fs.readFileSync(VAULT);
    clipboard.writeText(L); await realClick('#price-paste'); press('V',['control']);
    const da=await until(`!document.getElementById('dlg').classList.contains('hidden')&&/61\\.234,50 €\\/BTC/.test(document.getElementById('dlg-msg').textContent)`,5000);
    R('Kurszeile per echtem Strg+V eingefügt: Rückfrage mit dem Kurs erscheint', da, {foc:win.isFocused()});
    await click('#dlg-cancel'); await sleep(300);
    R('Kurszeile abgebrochen: Feld leer, BTC-Preis unverändert, Tresor-Datei unverändert', await js(`document.getElementById('price-paste').value===''&&document.getElementById('price-btc').value!=='61234.5'`)&&fs.readFileSync(VAULT).equals(vorher));
    try{ clipboard.clear(); }catch(_){}
    await js(`(()=>{ App.tab('settings'); return true; })()`); }   // Folgeprüfungen (Auge, Tab) arbeiten in cp1 auf dem Einstellungs-Tab
  // Auge beim Tippen (v3.6.4, Port Alien Pass v1.17): Chromium setzt beim type-Wechsel die Auswahl auf 0 — echte Tasten und echter Mausklick aufs Auge
  const eye=async()=>{ const r=await js(`(()=>{const b=document.querySelector('[data-showpass="cp1"]');b.scrollIntoView({block:'center'});const q=b.getBoundingClientRect();return {x:Math.round(q.left+q.width/2),y:Math.round(q.top+q.height/2)};})()`);
    win.webContents.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1}); win.webContents.sendInputEvent({type:'mouseUp',x:r.x,y:r.y,button:'left',clickCount:1}); await sleep(300); };
  const cur=()=>js(`(()=>{const f=document.getElementById('cp1');return {v:f.value,s:f.selectionStart,e:f.selectionEnd,t:f.type,foc:document.activeElement===f};})()`);
  await ensureFocus(); await js(`document.getElementById('cp1').focus(); true`); await sleep(100);
  for(const c of 'abcdef') key(c); await sleep(200);
  await eye(); key('X'); await sleep(200);
  { const c=await cur(); R('Auge beim Tippen: Cursor bleibt am Ende (aufdecken)', c.v==='abcdefX'&&c.s===7&&c.t==='text'&&c.foc, {s:c.s,t:c.t,foc:c.foc,len:c.v.length}); }
  press('Left'); press('Left'); await sleep(100); await eye(); key('Y'); await sleep(200);
  { const c=await cur(); R('Auge beim Tippen: Cursor mitten im Wort bleibt stehen (verdecken)', c.v==='abcdeYfX'&&c.s===6&&c.t==='password', {s:c.s,t:c.t,v_ok:c.v==='abcdeYfX'}); }
  // Markierte Passphrase + Auge auf → keine Klartext-Markierung, Cursor am Ende (v3.7, Querfund Alien Notes v1.6 B-V1)
  if((await cur()).t!=='password') await eye();
  press('A',['control']); await sleep(200);
  await eye();
  { const c=await cur(); R('Auge auf bei markierter Passphrase: keine Klartext-Markierung, Cursor am Ende', c.t==='text'&&c.s===c.e&&c.e===c.v.length&&c.foc, {s:c.s,e:c.e,t:c.t,len:c.v.length}); }
  await x11(cur,eye);
  await js(`(()=>{ const f=document.getElementById('cp1'); f.value=''; f.blur(); App.tab('list'); })()`).catch(()=>{}); await sleep(300);
}
// X11-Auswahl (v3.7, Fassung Alien Notes v1.7 — Tests aus Notes desktop/test/harness.cjs): Fokus-Markierung, Punkte-Falle, Klickweg wie am Gerät,
// gehaltenes/schnelles Tab, Capture-keydown, sofort sperren, lange Markierung, Sperre im gesperrten Hintergrund, Frist.
// Tab-Reihenfolge in den Einstellungen: cp-cur, dessen Auge, cp1, dessen Auge — der Fokus startet auf dem Auge von cp-cur.
async function x11(cur,eye){
  const unlock=async()=>{ await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); await until(visible('screen-app')); await js(`App.tab('settings')`); await sleep(300); };
  const prepTab=async V=>{ await ensureFocus(); if((await cur()).t!=='password') await eye();
    await js(`(()=>{ const p=document.getElementById('cp1'); p.value=${JSON.stringify(V)}; p.dispatchEvent(new Event('input',{bubbles:true})); const b=document.querySelector('[data-showpass="cp-cur"]'); b.scrollIntoView({block:'center'}); b.focus(); return true; })()`); await sleep(150); };
  const lockNow=async()=>{ await js(`App.lockNow(); true`); await sleep(600); };
  { const V='tab-wert-'+process.pid; await prepTab(V);
    await clipboard.selection.writeText('vorher-tab-'+process.pid);
    press('Tab'); await sleep(500);
    const c=await cur(); R('Tab ins Passwortfeld: Feld maskiert und ganz markiert (Ausgangslage)', c.t==='password'&&c.foc&&c.s===0&&c.e===c.v.length&&c.v===V, {s:c.s,e:c.e,t:c.t,foc:c.foc});
    R('Tab ins Passwortfeld: Chromium legt den Wert in PRIMARY (Messung)', (await prim())===V);
    R('Messung: die Markierung landet nicht in CLIPBOARD (kein Rückspiegeln durch Klipper, Release-Audit v3.7 C-1)', (await clipboard.readText())!==V);
    await lockNow();
    R('Tab ins Passwortfeld: nach dem Sperren nicht mehr in PRIMARY (gemeldet + gelöscht)', (await prim())==='');
    await clipboard.selection.clear(); }
  // Wie am Gerät (Alien Pass 03.10.2026): Tab ins Passwortfeld, (Fensterwechsel, zurück,) echte Klicks auf „Einstellungen“ und „Jetzt sperren“.
  // Der Tresor leert beim Fensterwechsel getippte Passphrasen (clearGateInputs, wie Notes) — gemessen wird es hier mit; die Punkte-Falle zeigt sich OHNE Fensterwechsel.
  for(const sw of [true,false]){ await unlock(); const V='geraet-'+(sw?'w':'o')+'-'+process.pid; await prepTab(V);
    await clipboard.selection.writeText('vorher-geraet-'+process.pid);
    press('Tab'); await sleep(500);
    const inP=(await prim())===V;
    if(sw){ win.blur(); await sleep(400); win.focus(); await sleep(400);
      R('Messung: Fensterwechsel leert das getippte Passwortfeld (Tresor wie Notes)', await js(`document.getElementById('cp1').value===''`), {len:await js(`document.getElementById('cp1').value.length`)}); }
    else R('Messung: ohne Fensterwechsel bleibt das Feld gefüllt und markiert (Punkte-Falle erreichbar)', await js(`(()=>{const f=document.getElementById('cp1');return f.value.length>0&&f.selectionStart===0&&f.selectionEnd===f.value.length;})()`));
    await realClick('button.tab[data-tab="settings"]'); await realClick('button[data-action="lockNow"]'); await sleep(500);
    R('Wie am Gerät (Tab, '+(sw?'Fensterwechsel, ':'ohne Fensterwechsel, ')+'Klick Einstellungen + Jetzt sperren): Wert war in PRIMARY und ist danach weg', inP&&(await js(visible('screen-lock')))&&(await prim())==='', {inP,prim:(await prim()).length});
    await clipboard.selection.clear(); }
  // Textfeld markiert, Fokus per Mausklick auf einen Knopf (Auswahlfeld), dann Strg+C: Kopie über die Brücke (KDE-Hinweis), nicht Chromium (Pass-Audit Runde 4).
  // Aus type=password kopiert Chromium gar nicht (kein copy-Ereignis, gemessen 03.10.2026) — dort genügt die Meldung an PRIMARY.
  { await unlock(); const V='kopie-'+process.pid; await js(`App.tab('add')`); await sleep(300);
    await js(`(()=>{ const u=document.getElementById('f-src-btc'); u.value=${JSON.stringify(V)}; u.scrollIntoView({block:'center'}); u.focus(); u.select(); return true; })()`); await sleep(200);
    const cb=await js(`(()=>{ const b=[...document.querySelectorAll('#tab-add .combo-btn')].find(x=>x.offsetParent); return b?b.dataset.arg:''; })()`);
    await realClick('#tab-add .combo-btn[data-arg="'+cb+'"]'); await sleep(100);
    const ae=await js(`document.activeElement&&(document.activeElement.dataset.arg||document.activeElement.id)`);
    await clipboard.clear(); win.webContents.copy(); await sleep(500);
    R('Textfeld markiert, Klick aufs Auswahlfeld, Strg+C: Kopie über die Brücke (KDE-Hinweis, echter Wert)', !!cb&&ae===cb&&await clipboard.has(KDE_HINT)&&(await clipboard.readText())===V, {cb,ae,hint:await clipboard.has(KDE_HINT),len:(await clipboard.readText()).length});
    await js(`App.closeMenus(); document.getElementById('f-src-btc').value=''; AlienDesktop.clip.clear()`); await sleep(200); await clipboard.clear(); await clipboard.selection.clear();
    await js(`App.tab('settings')`); await lockNow(); }
  // Gehaltenes Tab (Pass-Audit Runde 2): keyDown wiederholt sich, der Fokus wandert über cp1 weiter auf dessen Auge, keyup kommt erst auf dem Knopf an
  { await unlock(); const V='halte-tab-'+process.pid; await prepTab(V);
    await clipboard.selection.writeText('vorher-halt-'+process.pid);
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'}); await sleep(120); win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'}); await sleep(120);
    const ae=await js(`(document.activeElement&&(document.activeElement.className||document.activeElement.id))`);
    win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'}); await sleep(400);
    R('Tab gehalten: Fokus über cp1 hinaus auf das Auge, Wert in PRIMARY (Messung)', /pw-eye/.test(ae)&&(await prim())===V, {ae});
    await lockNow();
    R('Tab gehalten: nach dem Sperren nicht mehr in PRIMARY', (await prim())==='');
    await clipboard.selection.clear(); }
  // Varianten ohne Pause (Pass-Audit Runde 3): zwei Tab-keyDowns direkt hintereinander bzw. Tab + sofort ein Zeichen, je vor dem Loslassen
  for(const [name,seq] of [['zwei Tabs ohne Pause',['Tab','Tab']],['Tab + sofort getippt',['Tab','char']]]){
    await unlock(); const V='schnell-'+seq.join('')+'-'+process.pid; await prepTab(V);
    await clipboard.selection.writeText('vorher-schnell-'+process.pid);
    for(const k of seq) if(k==='char') win.webContents.sendInputEvent({type:'char',keyCode:'x'}); else win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});
    win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'}); await sleep(400);
    const inP=(await prim())===V;
    await lockNow();
    R('Schnell ('+name+'): Wert war in PRIMARY und ist nach dem Sperren weg', inP&&(await prim())==='', {inP});
    await clipboard.selection.clear(); }
  // Nur der Capture-keydown meldet (Notes Release-Audit v1.7 A-2): Strg+A als keyDown OHNE keyUp, dann eine echte Taste
  { await unlock(); const V='keydown-'+process.pid; if((await cur()).t!=='password') await eye();
    await js(`(()=>{ const p=document.getElementById('cp1'); p.value=${JSON.stringify(V)}; p.scrollIntoView({block:'center'}); p.focus(); p.setSelectionRange(p.value.length,p.value.length); return true; })()`); await sleep(200);
    await clipboard.selection.writeText('vorher-keydown-'+process.pid);
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']}); await sleep(300);
    const inP=(await prim())===V;
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'X'}); win.webContents.sendInputEvent({type:'char',keyCode:'x'}); win.webContents.sendInputEvent({type:'keyUp',keyCode:'X'}); await sleep(300);
    await lockNow();
    R('Strg+A ohne Loslassen, dann getippt: Capture-keydown meldet, nach dem Sperren nicht mehr in PRIMARY', inP&&(await prim())==='', {inP});
    await clipboard.selection.clear(); }
  // Markieren und SOFORT per Klick sperren (Notes Release-Audit v1.7 B-N2): die Frist muss schon vor der IPC-Antwort stehen
  { await unlock(); const V='sofort-'+process.pid; if((await cur()).t!=='password') await eye();
    await js(`(()=>{ const p=document.getElementById('cp1'); p.value=${JSON.stringify(V)}; p.scrollIntoView({block:'center'}); p.focus(); p.setSelectionRange(p.value.length,p.value.length); return true; })()`); await sleep(200);
    await clipboard.selection.writeText('vorher-sofort-'+process.pid);
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']}); await sleep(300);
    const inP=(await prim())===V;
    await realClick('button[data-action="lockNow"]'); await sleep(600);
    R('Markiert, dann sofort Klick auf „Jetzt sperren“: beim Sperren aus PRIMARY', inP&&(await js(visible('screen-lock')))&&(await prim())==='', {inP,prim:(await prim()).length});
    await clipboard.selection.clear(); }
  // Lange Markierung über der alten Brücken-Grenze 20.000 (Querfund Notes v1.7 B-M1): gemeldet, per Strg+C über die Brücke kopiert, beim Sperren beides gelöscht
  { await unlock(); await js(`App.tab('add')`); await sleep(300);
    const L='lang-'+process.pid+'-'+'x'.repeat(60000);
    await js(`(()=>{ const n=document.getElementById('f-src-btc'); n.value=${JSON.stringify(L)}; n.scrollIntoView({block:'center'}); n.focus(); n.setSelectionRange(0,0); return true; })()`); await sleep(200);
    await clipboard.selection.writeText('vorher-lang-'+process.pid);
    press('A',['control']); await sleep(500);
    const inP=(await prim())===L;
    await clipboard.clear(); win.webContents.copy(); await sleep(600);
    R('Lange Markierung (60.000 Zeichen) + Strg+C: Kopie über die Brücke (KDE-Hinweis, ganzer Text)', await clipboard.has(KDE_HINT)&&(await clipboard.readText())===L, {hint:await clipboard.has(KDE_HINT),len:(await clipboard.readText()).length});
    await js(`document.getElementById('f-src-btc').value=''; true`);
    await lockNow(); await sleep(400);
    R('Lange Markierung: war in PRIMARY und ist nach dem Sperren weg', inP&&(await prim())==='', {inP,prim:(await prim()).length});
    R('Lange Markierung: Kopie nach dem Sperren gelöscht', (await clipboard.readText())==='');
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Gesperrt minimiert (Notes onHidden): eine auf dem Sperrbildschirm markierte Passphrase sofort aus PRIMARY, nicht erst nach der Frist
  { await fill('lock-pass','gesperrt-'+process.pid); await js(`document.getElementById('lock-pass').focus(); true`); await sleep(150);
    await clipboard.selection.writeText('vorher-min-'+process.pid);
    press('A',['control']); await sleep(400);
    const inP=(await prim())==='gesperrt-'+process.pid;
    win.minimize(); await sleep(800); const isMin=win.isMinimized(); await restoreFocused();
    R('Sperrbildschirm markiert, minimiert: sofort aus PRIMARY', isMin&&inP&&(await prim())==='', {isMin,inP,prim:(await prim()).length});
    await clipboard.selection.clear(); }
  // Gesperrt, Fensterwechsel (Release-Audit v3.7 B-3): eine markierte Passphrase sofort aus PRIMARY, nicht erst nach der Frist
  { await fill('lock-pass','wechsel-'+process.pid); await js(`document.getElementById('lock-pass').focus(); true`); await sleep(150);
    await clipboard.selection.writeText('vorher-wechsel-'+process.pid);
    press('A',['control']); await sleep(400);
    const inP=(await prim())==='wechsel-'+process.pid;
    win.blur(); await sleep(500); win.focus(); await sleep(400);
    R('Sperrbildschirm markiert, Fensterwechsel: sofort aus PRIMARY', inP&&(await prim())==='', {inP,prim:(await prim()).length});
    await clipboard.selection.clear(); }
  // Lange, MEHRZEILIGE Kopie mit Umlauten (Notes Release-Audit v1.8 A-3): spiegelt Klipper sie unverändert in PRIMARY (Hash passt), und ist sie nach dem Sperren
  // dort weg? Geprüft wird auf die Marke, nicht auf Gleichheit — ein verändert gespiegelter Text bliebe sonst unbemerkt liegen
  { await unlock(); const MK='langmehr-'+process.pid, L=Array.from({length:1500},(_,i)=>MK+' Zeile '+i+' Grüße äöü ß — „x“').join('\n');
    await clipboard.clear(); await clipboard.selection.clear(); await js(`App.copy(${JSON.stringify(L)},'x'); true`); await sleep(1200);
    const kop=await clipboard.readText(), gesp=await prim();
    R('Messung: lange mehrzeilige Kopie von Klipper in PRIMARY gespiegelt: '+(gesp===kop?'unverändert':(gesp.includes(MK)?'VERÄNDERT':'nein')), true, {kopLen:kop.length,primLen:gesp.length});
    await lockNow(); await until(visible('screen-lock'),5000); await sleep(1000);
    R('lange mehrzeilige Kopie: nach dem Sperren weder in CLIPBOARD noch in PRIMARY', kop.includes(MK)&&!(await clipboard.readText()).includes(MK)&&!(await prim()).includes(MK), {kop:kop.includes(MK),clip:(await clipboard.readText()).includes(MK),prim:(await prim()).includes(MK)});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Wie gemessen (R2-N2, 04.10.2026 im Tresor: 24 von 48 Klickpunkten): Feld mit alter interner Markierung, der eigentliche Wert per Strg+A markiert, dann echter
  // Klick LINKS neben das alte Feld — die leere Range zeigt auf dieses Feld, selText meldet dessen alten Wert; der Wert liegt weiter in PRIMARY und muss beim Sperren weg
  for(const [name,open,alt,ziel] of [['Eintrag: Bezugsquelle alt, Notiz markiert',`App.tab('add'); true`,'f-src-btc','f-note'],['Einstellungen: aktuelle Passphrase alt, neue markiert',`App.tab('settings'); true`,'cp-cur','cp1']]){
    await unlock(); await js(open); await sleep(400); const V='ring-'+ziel+'-'+process.pid;
    await js(`(()=>{ const u=document.getElementById(${JSON.stringify(alt)}); u.value='ring-alt-'+${JSON.stringify(String(process.pid))}; u.scrollIntoView({block:'center'}); u.setSelectionRange(0,u.value.length);
      const z=document.getElementById(${JSON.stringify(ziel)}); z.value=${JSON.stringify(V)}; z.dispatchEvent(new Event('input',{bubbles:true})); z.focus(); return true; })()`); await sleep(200);
    await clipboard.selection.writeText('vorher-ring-'+process.pid);
    press('A',['control']); await sleep(300);
    const inP=(await prim())===V;
    const r=await js(`(()=>{ const q=document.getElementById(${JSON.stringify(alt)}).getBoundingClientRect(); return {x:Math.round(q.left-6),y:Math.round(q.top+q.height/2)}; })()`);
    win.webContents.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1}); win.webContents.sendInputEvent({type:'mouseUp',x:r.x,y:r.y,button:'left',clickCount:1}); await sleep(400);
    const still=(await prim())===V;
    // Vorbedingung (Notes C-3): der Klick hat die falsche Meldung wirklich ausgelöst — leere Range zeigt auf das alte, markierte Feld
    const falsch=r.x>=0&&await js(`(()=>{ const g=getSelection(); if(!g||!g.rangeCount) return false; const q=g.getRangeAt(0); if(!q.collapsed) return false;
      const n=q.startContainer&&q.startContainer.childNodes?q.startContainer.childNodes[q.startOffset]:null; return !!n&&n.id===${JSON.stringify(alt)}&&n.selectionStart!==n.selectionEnd; })()`);
    await js(`(()=>{ for(const id of [${JSON.stringify(alt)},${JSON.stringify(ziel)}]) document.getElementById(id).value=''; App.lockNow(); return true; })()`); await until(visible('screen-lock'),5000); await sleep(600);
    R('Klick links neben ein Feld mit alter Markierung (R2-N2, '+name+'): Wert war in PRIMARY und ist nach dem Sperren weg', inP&&still&&falsch&&(await prim())==='', {inP,still,falsch,prim:(await prim()).length});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // Entsperrt, Passphrase-Wechsel: neue Passphrase per Strg+A markiert, Fensterwechsel → Feld leer UND PRIMARY geräumt (Querfund Notes v1.8 B-1, echte Hülle)
  { await unlock(); const V='einst-blur-'+process.pid;
    await js(`(()=>{ const p=document.getElementById('cp1'); p.value=${JSON.stringify(V)}; p.dispatchEvent(new Event('input',{bubbles:true})); p.scrollIntoView({block:'center'}); p.focus(); return true; })()`); await sleep(200);
    press('A',['control']); await sleep(400);
    const inP=(await prim())===V;
    win.webContents.send('bg','blur'); await sleep(600);
    R('entsperrt, Strg+A in der neuen Passphrase, Fensterwechsel: Feld leer und PRIMARY geräumt (B-1)', inP&&(await js(`document.getElementById('cp1').value===''`))&&(await prim())==='', {inP,prim:(await prim()).length});
    await clipboard.selection.clear(); }
  // Gegenprobe: eine Markierung in einem normalen Feld (Notiz) bleibt beim Fensterwechsel entsperrt stehen (Mittelklick ins andere Fenster soll gehen)
  { await js(`App.tab('add'); true`); await sleep(300); const V='notiz-bleibt-'+process.pid;
    await js(`(()=>{ const n=document.getElementById('f-note'); n.value=${JSON.stringify(V)}; n.scrollIntoView({block:'center'}); n.focus(); return true; })()`); await sleep(200);
    press('A',['control']); await sleep(400);
    const inP=(await prim())===V;
    win.webContents.send('bg','blur'); await sleep(600);
    R('entsperrt, Notiz markiert, Fensterwechsel: Markierung bleibt in PRIMARY (Gegenprobe B-1)', inP&&(await prim())===V, {inP,prim:(await prim()).length});
    await js(`(()=>{ document.getElementById('f-note').value=''; App.tab('settings'); return true; })()`); await lockNow(); await sleep(300);
    R('… und nach dem Sperren weg', (await prim())==='');
    await clipboard.selection.clear(); }
  // Frist (fest 30 s am Desktop), je getrennt (Release-Audit v3.7 C-2): eine reine Kopie und eine reine Markierung verschwinden ohne Sperre
  const untilEmpty=async(rd,ms)=>{ const t0=Date.now(); while(Date.now()-t0<ms){ if((await rd())==='') return Date.now()-t0; await sleep(250); } return -1; };
  { await unlock(); const K='frist-kopie-'+process.pid; await clipboard.selection.clear();
    await js(`App.copy(${JSON.stringify(K)},'x'); true`); await sleep(400);
    const inC=(await clipboard.readText())===K;
    const ms=await untilEmpty(()=>clipboard.readText(),34000);
    R('Frist 30 s: Kopie (ohne Markierung) ohne Sperre gelöscht, nicht vor 25 s, App bleibt entsperrt', inC&&ms>25000&&(await prim())!==K&&await js(visible('screen-app')), {inC,ms,prim:(await prim())===K});
    await clipboard.clear(); await clipboard.selection.clear(); }
  // cp1 ist ein Gate-Feld: seit v3.8 löscht ein Fensterwechsel die Markierung sofort (B-1). Kommt während der Wartezeit ein blur (KDE-Fokuspendeln,
  // Arbeiten am Desktop), ist ein frühes Löschen richtig — dann einmal wiederholen (gemessen 04.10.2026: 22,9 s nach einem Fokuswechsel)
  for(let versuch=1;versuch<=2;versuch++){ const V='frist-'+versuch+'-'+process.pid; await prepTab(V);
    await clipboard.selection.writeText('vorher-frist-'+process.pid);
    let bl=0; const tB=Date.now(), blAt=[], focVor=win.isFocused(); const ob=()=>{ bl++; blAt.push(Date.now()-tB); }; win.on('blur',ob);
    press('Tab'); await sleep(500);
    const inP=(await prim())===V;
    const ms=await untilEmpty(prim,34000); win.removeListener('blur',ob);
    if(bl&&versuch===1){ R('Messung: Frist-Test Markierung — Fensterwechsel während der Wartezeit, wiederholt', true, {ms,bl,blAt,focVor}); await clipboard.selection.clear(); continue; }
    R('Frist 30 s: Markierung (ohne Kopie) ohne Sperre aus PRIMARY, nicht vor 25 s', inP&&ms>25000&&await js(visible('screen-app')), {inP,ms,bl,blAt,focVor});
    await clipboard.clear(); await clipboard.selection.clear(); break; }
  await js(`App.tab('settings')`); await sleep(200);
}
// Beenden (v3.8, aus Notes v1.8 = Pass v1.19 + Notes run-6): before-quit läuft über die Kette und löscht die eigene Kopie auch aus PRIMARY (Klipper-Spiegelung).
// 'quit': die Kopie ist beim Beenden noch UNTERWEGS (clipboard.write hängt 1 s); zweimal app.quit (Pass A-3). 'quithang': zwei Schreibvorgänge hängen für immer
// VOR dem Löschen — direkter Durchgang nach ~2 s (Pass R2-3). 'quitslow' (Pass N-4): das PRIMARY-Lesen beim Beenden braucht 2,3 s. 'quitreject' (Notes A-1):
// PRIMARY-Lesen lehnt einmal ab. 'quitlate' (Notes R2-H2): ein spätes Schreiben landet erst WÄHREND des Beendens.
async function quitSlow(){
  R('Beenden: Sperrbildschirm', await until(visible('screen-lock'),15000));
  const M='st-harness-'+process.pid+'-quitslow';
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`); await sleep(300); await clipboard.selection.writeText(M);
  const sr=clipboard.selection.readText; let einmal=true;
  clipboard.selection.readText=function(...a){ if(einmal){ einmal=false; return new Promise(r=>setTimeout(()=>r(sr.apply(clipboard.selection,a)),2300)); } return sr.apply(this,a); };
  const t0=Date.now();
  app.on('will-quit',ev=>{ ev.preventDefault(); const ms=Date.now()-t0; (async()=>{ const c=await clipboard.readText(), p=await sr.call(clipboard.selection);
    // Trennt N-4 (direkter Durchgang nimmt die Hashes des laufenden Glieds) nicht mehr allein: seit Notes A-1 räumt auch die Nachfass-Schleife (Release-Audit v3.8 C-6)
    R('Beenden mit langsamem PRIMARY-Lesen (2,3 s): Kopie trotzdem aus CLIPBOARD und PRIMARY gelöscht', !einmal&&ms>=1900&&c!==M&&p==='', {ms,clip:c===M,prim:p.length,langsam:!einmal});
    try{ await clipboard.clear(); }catch(_){} R('Schritt vollständig',true); app.exit(0); })(); });
  app.quit();
}
async function quitReject(){
  R('Beenden: Sperrbildschirm', await until(visible('screen-lock'),15000));
  const M='st-harness-'+process.pid+'-quitreject';
  await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`); await sleep(300); await clipboard.selection.writeText(M);
  const vor=(await prim())===M;
  const sr=clipboard.selection.readText; let einmal=true;
  clipboard.selection.readText=function(...a){ if(einmal){ einmal=false; return Promise.reject(new Error('X11')); } return sr.apply(this,a); };
  const t0=Date.now();
  app.on('will-quit',ev=>{ ev.preventDefault(); const ms=Date.now()-t0; (async()=>{ const c=await clipboard.readText(), p=await sr.call(clipboard.selection);
    R('Beenden mit einmal abgelehntem PRIMARY-Lesen: Kopie trotzdem aus CLIPBOARD und PRIMARY gelöscht', vor&&!einmal&&c!==M&&p==='', {vor,abgelehnt:!einmal,ms,clip:c===M,prim:p.length});
    R('Beenden bleibt unter ~5 s', ms<5500, ms);
    try{ await clipboard.clear(); }catch(_){} R('Schritt vollständig',true); app.exit(0); })(); });
  app.quit();
}
async function quitLate(){
  R('Beenden: Sperrbildschirm', await until(visible('screen-lock'),15000));
  const M='st-harness-'+process.pid+'-quitlate', ow=clipboard.write; let gelandet=0;
  clipboard.write=async function(...a){ await sleep(2500); const r=await ow.apply(this,a); gelandet=Date.now(); setTimeout(()=>{ clipboard.selection.writeText(M); },300); return r; };
  const r=await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}}).then(()=>'ok',()=>'abgelehnt')`);
  const t0=Date.now();
  // Sofort bei will-quit prüfen, ohne zu warten: in echt endet der Prozess hier — eine Wartezeit im Test ließe die normalen Nachfass-Zeitgeber aufräumen.
  // Vorbedingung: will-quit erst NACH dem nachgestellten Spiegel (Landung + 300 ms) — sonst wäre PRIMARY nur „noch leer“ (Notes N-1)
  app.on('will-quit',ev=>{ ev.preventDefault(); const ms=Date.now()-t0, gel=gelandet>0&&Date.now()-gelandet>=400; (async()=>{ const c=await clipboard.readText(), p=await prim();
    R('Beenden während ein spätes Schreiben noch unterwegs ist: auf die Kopie und ihren Spiegel gewartet, beide beim Prozessende aus CLIPBOARD und PRIMARY weg', r==='abgelehnt'&&gel&&c!==M&&p==='', {r,gel,nachLandung:gelandet?Date.now()-gelandet:0,ms,clip:c===M,prim:p.length});
    R('Beenden bleibt unter ~5 s', ms<5500, ms);
    clipboard.write=ow; try{ await clipboard.clear(); await clipboard.selection.clear(); }catch(_){} R('Schritt vollständig',true); app.exit(0); })(); });
  app.quit();
}
async function quitStep(hang){
  R('Beenden: Sperrbildschirm', await until(visible('screen-lock'),15000));
  const M='st-harness-'+process.pid+'-quit';
  let drin=false, t0=0;
  if(hang){ await js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`); await sleep(300); await clipboard.selection.writeText(M);
    clipboard.write=()=>new Promise(()=>{});
    js(`AlienDesktop.clip.write({text:'haengt-1'}).catch(()=>{}); AlienDesktop.clip.write({text:'haengt-2'}).catch(()=>{}); true`).catch(()=>{}); await sleep(200); }
  else { const ow=clipboard.write; clipboard.write=async function(...a){ drin=true; await sleep(1000); return ow.apply(this,a); };
    js(`AlienDesktop.clip.write({text:${JSON.stringify(M)}})`).catch(()=>{});
    for(let i=0;i<50&&!drin;i++) await sleep(20);
    await clipboard.selection.writeText(M); }   // Klipper-Spiegelung nachstellen
  // quithang: während des Beendens abtasten — der direkte Durchgang an der stehenden Kette vorbei muss nach ~2 s löschen, nicht erst das Kettenglied bei ~3,8 s (Notes N-2)
  let leerAb=0; const tast=hang?setInterval(async()=>{ if(leerAb||!t0) return; try{ if((await clipboard.readText())!==M&&(await prim())==='') leerAb=Date.now()-t0; }catch(_){} },50):null;
  app.on('will-quit',ev=>{ ev.preventDefault(); const ms=Date.now()-t0; if(tast) clearInterval(tast); (async()=>{
    if(hang){ const c=await clipboard.readText(), s=await prim();
      R('Beenden hinter einer stehenden Kette: direkter Durchgang löscht nach ~2 s (≤ 2,7 s), nicht erst das Kettenglied', leerAb>0&&leerAb<=2700, {leerAb});
      // ≤ ~5 s statt ~2 s: die beiden nie landenden Schreibvorgänge zählen seit R2-H2 als „spät, noch nicht gelandet“, das Beenden wartet bis zum Deckel `end`
      R('Beenden hinter einer stehenden Kette: direkt gelöscht (CLIPBOARD + PRIMARY), unter dem Deckel ~5 s', ms<5500&&c!==M&&s==='', {ms,clip:c===M,prim:s.length}); }
    else { const c=await clipboard.readText(), s=await prim();
      R('Beenden während die Kopie noch geschrieben wird (zweimal quit): Kopie aus CLIPBOARD und PRIMARY gelöscht, auf das Schreiben gewartet (≥ 0,9 s)', drin&&ms>=900&&c!==M&&s==='', {drin,clip:c===M,prim:s.length,ms});
      R('Kopie NACH app.quit(): abgewiesen und weder in CLIPBOARD noch in PRIMARY (Pass R2-3, Release-Audit v3.8 C-5)', nachQuit==='abgewiesen'&&c!==X&&s!==X, {nachQuit,clip:c===X,prim:s===X}); }
    try{ await clipboard.clear(); }catch(_){} R('Schritt vollständig',true); app.exit(0); })(); });
  const X='st-harness-'+process.pid+'-nach-quit'; let nachQuit='?';
  t0=Date.now(); app.quit(); if(!hang){ nachQuit=await js(`AlienDesktop.clip.write({text:${JSON.stringify(X)}}).then(()=>'ok',()=>'abgewiesen')`).catch(()=>'fehler'); await sleep(50); app.quit(); }
}
// Sperre beim Minimieren (Alien Pass Audit run-6 #1): backgroundThrottling:false schaltet visibilitychange ab, die Hülle meldet selbst
async function background(){
  R('Hintergrund: Sperrbildschirm', await until(visible('screen-lock'),15000));
  await fill('lock-pass',PP); await click('#unlock-btn'); R('Hintergrund: entsperrt', await until(visible('screen-app')));
  await js(`App.setAutolock('1'); true`); await sleep(600);
  win.minimize(); await sleep(800); win.restore(); await sleep(600);
  R('kurz minimiert bei 1 min: bleibt entsperrt', await js(visible('screen-app')));
  // Erst auf das minimize-Ereignis warten, DANN die Uhr vorstellen: kam es nach dem Umstellen an (KWin liefert es je nach Last 0,1–0,5 s später),
  // stand schon hiddenAt auf der vorgestellten Uhr und die Wegzeit war null (Flake 03.10.2026, auch mit altem Code)
  const minEv=await new Promise(r=>{ win.once('minimize',()=>r(true)); win.minimize(); setTimeout(()=>r(false),3000); }); await sleep(300);
  await js(`(()=>{ window.__dateNow=Date.now; Date.now=()=>window.__dateNow()+61000; })()`); win.restore();
  R('länger als Auto-Lock minimiert: gesperrt', minEv&&await until(visible('screen-lock'),5000), {minEv});
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
// Markierungen AUSSERHALB von Feldern (v3.10, Querfund Alien Notes v1.10, Release-Audit run-8 a2-1; Vorlage Alien Pass v1.21 / Notes v1.11, Messung Audit run-10):
// Strg+A ohne Textfeld-Fokus markierte die ganze Seite, und Chromium legt in PRIMARY einen anderen Text, als die App meldet (U+FFFC, NBSP, Text unter
// user-select:none, Zahlenfelder mit Komma, „\n“ am Rand) — Frist und Sperre löschten nie. Tasten, Klicks und Ziehen per sendInputEvent; Fokus und Werte zur
// Vorbereitung teils per Skript. Ein keydown-Haken am window (Bubble, nach deskKey) zählt je Strg+A, ob die Taste ankam und gesperrt wurde.
// Vor jeder Probe auf gleichen Seitentext ein echter Klick (Lehre Notes v1.11: removeAllRanges per Skript reicht nicht, Chromium schriebe PRIMARY nicht neu).
// v3.12: Handbuch-Overlay mit nur einem Scrollbalken (Querfund Alien Notes v1.15, Gerätetest Flatpak), Scrollstand nach dem Schließen, Markieren per Maus
// im Overlay (Notes-Lehre v1.10 (5): CSS an html kann das Markieren stören), Nachlass-Overlay gleich; dazu die MESSUNG b-1 (Notes run-12): bis an den Rand
// markieren, Maus ruhen lassen (Chromium rollt nach) — steht danach in PRIMARY der Endstand, und löscht clear() ihn?
async function m312(){
  let innerH=0;
  const wc=win.webContents, M='mk-m312-'+process.pid;
  const mouse=(type,x,y,o={})=>wc.sendInputEvent({type,x:Math.round(x),y:Math.round(y),button:'left',clickCount:1,...(o.mod?{modifiers:o.mod}:{})});
  // Allein gestartet (NUR=m312, leeres Test-Home): Tresor erst anlegen
  if(await until(visible('screen-setup'),3000)){ await fill('setup-pass1',PP); await fill('setup-pass2',PP); await click('#setup-btn'); }
  else { R('m312: Sperrbildschirm', await until(visible('screen-lock'),15000)); await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); }
  if(!(await until(visible('screen-app'),60000))){ R('m312: entsperrt',false); return; }
  await js(`App.setAutolock('0'); App.hideToast(); true`); await sleep(300);
  // (a) Scrollbalken: lange Seite, gerollt; Handbuch öffnen → nur dessen Balken; schließen → Seite steht wie vorher
  await js(`App.tab('settings'); document.body.style.minHeight='3000px'; window.scrollTo(0,400); true`); await sleep(300);
  const sb=`(()=>{ const o=document.querySelector('.help-overlay:not(.hidden)'); return {sb:innerWidth-document.documentElement.clientWidth, y:scrollY, ov:!!o, ovSb:o?o.offsetWidth-o.clientWidth:0}; })()`;
  const m0=await js(sb); await js(`App.openHelp(); true`); await sleep(400); const m1=await js(sb);
  R('Handbuch offen: nur der Balken des Handbuchs, die Seite dahinter ohne eigenen', m0.sb>0&&m1.ov&&m1.ovSb>0&&m1.sb===0, {m0,m1});
  await js(`App.closeHelp(); true`); await sleep(300); const m2=await js(sb);
  R('Handbuch zu: Seitenbalken wieder da, Scrollstand unverändert', m2.sb===m0.sb&&m2.y===m0.y, {m0,m2});
  await js(`App.tab('export'); window.scrollTo(0,300); true`); await sleep(200); const n0=await js(sb);
  await js(`App.openNachlass(); true`); await sleep(500); const n1=await js(sb); await js(`App.closeNachlass(); true`); await sleep(300); const n2=await js(sb);
  R('Nachlass-Overlay: ein Balken, danach Scrollstand unverändert', n1.ov&&n1.sb===0&&n2.y===n0.y&&n2.sb===n0.sb, {n0,n1,n2});
  await js(`document.body.style.minHeight=''; window.scrollTo(0,0); true`);
  // (b) Markieren per Maus im Handbuch (kurz, ohne Rand): PRIMARY = Markierung, clear() löscht
  await js(`App.openHelp(); true`); await sleep(400); await clipboard.selection.writeText(M); await ensureFocus();
  const box=await js(`(()=>{ const o=document.getElementById('help-overlay'); o.scrollTop=0; const p=[...o.querySelectorAll('p')].find(e=>e.textContent.length>120&&e.getClientRects().length&&e.getBoundingClientRect().top>160&&e.getBoundingClientRect().bottom<innerHeight-40);
    const r=p.getBoundingClientRect(), lh=parseFloat(getComputedStyle(p).lineHeight)||16; return {x:r.left,y:r.top+lh/2,w:r.width,h:r.height,hit:(document.elementFromPoint(r.left+8,r.top+lh/2)||{}).tagName}; })()`);
  // erste Mausfolge nach dem Fokus geht in KDE teils verloren: vorher ein Klick auf leere Fläche (linker Rand des Overlays, kein Text)
  mouse('mouseDown',4,innerH=await js('innerHeight/2')); mouse('mouseUp',4,innerH); await sleep(300);
  await js(`window.__sc=0; document.addEventListener('selectionchange',()=>window.__sc++); true`);
  const zb={x:box.x+box.w*0.6,y:box.y+Math.min(box.h-8,60)};
  await sleep(200); mouse('mouseDown',box.x+8,box.y); for(let i=1;i<=14;i++){ mouse('mouseMove',box.x+8+(zb.x-box.x-8)*i/14,box.y+(zb.y-box.y)*i/14,{mod:['leftButtonDown']}); await sleep(30); } mouse('mouseUp',zb.x,zb.y); await sleep(600);
  box.sc=await js('window.__sc');
  let sel=await js('String(getSelection())'), p=await prim();
  await js('AlienDesktop.clip.clear()'); await sleep(800); let weg=(await prim())==='';
  R('Markieren per Maus im offenen Handbuch: Markierung entsteht, PRIMARY = Markierung, Löschen leert', sel.length>10&&p===sel&&weg, {selLen:sel.length,gleich:p===sel,weg,hit:box.hit,sc:box.sc,box});
  await js(`App.closeHelp(); getSelection().removeAllRanges(); true`); await sleep(200);
  // (c) b-1 (Querfund Alien Notes v1.14 run-12, hier gemessen 13.11.2026: mit v3.11 PRIMARY 1458 statt 8620 Zeichen, clear() löschte nichts): vom Absatz bis an den
  // unteren Rand des Handbuchs bzw. des Nachlass-Blatts (Bestände) ziehen, Maus 3 s ruhen lassen (Chromium rollt nach), loslassen. Seit v3.12 setzt die App die
  // Markierung im mouseup neu (reselect): PRIMARY = Endstand. Verglichen wird angeglichen wie nsel in main.js (am Blockrand hängt eine der beiden Seiten ein „\n“ an).
  const nz=t=>String(t).replace(/\ufffc/g,'').replace(/\u00a0/g,' ').trim();
  for(const [ov,off,hold] of [['help-overlay',1,3000],['help-overlay',3,3000],['nachlass-overlay',1,3000]]){
    const open=ov==='help-overlay'?'App.openHelp()':'App.openNachlass()', zu=ov==='help-overlay'?'App.closeHelp()':'App.closeNachlass()';
    await js(`(()=>{ getSelection().removeAllRanges(); ${open}; const o=document.getElementById('${ov}'); o.scrollTop=0; return true; })()`); await sleep(500);
    await clipboard.selection.writeText(M); await ensureFocus();
    const a=await js(`(()=>{ const o=document.getElementById('${ov}'), p=[...o.querySelectorAll('p,li,td')].find(e=>e.getBoundingClientRect().top>160&&e.textContent.length>20); const r=p.getBoundingClientRect(), b=o.getBoundingClientRect(); return {x:r.left+6,y:r.top+6,bx:b.left+b.width/2,bb:b.bottom,top:o.scrollTop,max:o.scrollHeight-o.clientHeight}; })()`);
    const z={x:a.bx,y:a.bb-off};
    mouse('mouseDown',a.x,a.y); for(let i=1;i<=14;i++){ mouse('mouseMove',a.x+(z.x-a.x)*i/14,a.y+(z.y-a.y)*i/14,{mod:['leftButtonDown']}); await sleep(30); }
    await sleep(hold); const y1=await js(`document.getElementById('${ov}').scrollTop`), pR=await prim(), sR=await js('String(getSelection())');
    mouse('mouseUp',z.x,z.y); await sleep(700);
    sel=await js('String(getSelection())'); p=await prim();
    // Lage: markiert, nachgerollt, PRIMARY hinkte bei ruhender Maus hinterher (sonst prüfte der Fall nichts)
    const vorb=sel.length>0&&p!==M&&y1>a.top&&nz(pR).length<nz(sR).length;
    await js('AlienDesktop.clip.clear()'); const t0=Date.now(); weg=false; while(Date.now()-t0<2500&&!(weg=(await prim())==='')) await sleep(100);
    R(`b-1 ${ov==='help-overlay'?'Handbuch':'Nachlass-Blatt (Bestände)'} (Rand-${off}, Maus ruht ${hold} ms): PRIMARY = Endstand, nach dem Löschen leer`, vorb&&nz(p)===nz(sel)&&weg,
      {vorb,gleich:nz(p)===nz(sel),weg,scroll:[a.top,y1,a.max],ruhe:{pLen:pR.length,selLen:sR.length},primLen:p.length,selLen:sel.length});
    await clipboard.selection.clear(); await js(`(()=>{ getSelection().removeAllRanges(); ${zu}; return true; })()`); await sleep(200); }
}
async function markierung(){
  const wc=win.webContents, NB=' ', FC='￼', TAIL='Ende-'+process.pid;
  const mclick=async(p,n=1)=>{ for(let i=1;i<=n;i++){ wc.sendInputEvent({type:'mouseDown',x:p.x,y:p.y,button:'left',clickCount:i}); wc.sendInputEvent({type:'mouseUp',x:p.x,y:p.y,button:'left',clickCount:i}); } await sleep(500); };
  const at=sel=>js(`(()=>{const n=document.querySelector(${JSON.stringify(sel)}); if(!n) return null; n.scrollIntoView({block:'center'}); const b=n.getBoundingClientRect(); return {x:Math.round(b.x+Math.min(b.width/2,30)),y:Math.round(b.y+b.height/2)};})()`);
  const atText=(root,needle)=>js(`(()=>{ const w=document.createTreeWalker(document.querySelector(${JSON.stringify(root)}),NodeFilter.SHOW_TEXT); let n;
    while((n=w.nextNode())){ const i=n.data.indexOf(${JSON.stringify(needle)}); if(i>=0){ n.parentElement.scrollIntoView({block:'center'}); const r=document.createRange(); r.setStart(n,i+1); r.setEnd(n,i+2); const b=r.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}; } } return null; })()`);
  const drag=async(p1,p2)=>{ await ensureFocus(); wc.sendInputEvent({type:'mouseDown',x:p1.x,y:p1.y,button:'left',clickCount:1});
    for(let i=1;i<=12;i++){ wc.sendInputEvent({type:'mouseMove',x:Math.round(p1.x+(p2.x-p1.x)*i/12),y:Math.round(p1.y+(p2.y-p1.y)*i/12),button:'left',modifiers:['leftButtonDown']}); await sleep(40); }
    wc.sendInputEvent({type:'mouseUp',x:p2.x,y:p2.y,button:'left',clickCount:1}); await sleep(500); };
  const ctrl=k=>{ wc.sendInputEvent({type:'keyDown',keyCode:k,modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:k,modifiers:['control']}); };
  const sel=()=>js(`String(getSelection())`);
  const leer=async(ms=3000)=>{ const t0=Date.now(); let ok=false; while(Date.now()-t0<ms&&!(ok=(await prim())==='')) await sleep(100); return ok; };
  const ka=()=>js(`window.__ka.splice(0)`);
  const neutral=async()=>{ await ensureFocus(); await mclick(await at('.tagline')); };
  let nr=0;
  // Strg+A: Taste kam an und wurde gesperrt, keine Markierung, PRIMARY unverändert
  const nichts=async(titel,vorb,info)=>{ await ka(); const M='mk-vorher-'+(++nr)+'-'+process.pid;
    await clipboard.selection.writeText(M); const foc=await ensureFocus(); ctrl('A'); await sleep(500);
    const k=await ka(), gesperrt=k.length===1&&k[0]===true, unv=(await prim())===M, s=await sel();
    R(titel, vorb&&foc&&gesperrt&&unv&&s==='', {...info,foc,k,unv,selLen:s.length}); };
  // Strg+A in einem Feld: App markiert das Feld, PRIMARY = erwarteter Text; danach löscht clip.clear() PRIMARY (Meldung passt)
  const feld=async(titel,erwartet,vorb,info)=>{ await ka(); const M='mk-vorher-'+(++nr)+'-'+process.pid; await clipboard.selection.writeText(M);
    const foc=await ensureFocus(); ctrl('A'); await sleep(500); const k=await ka(), P=await prim(), inP=erwartet(P);
    await js('AlienDesktop.clip.clear()'); const weg=await leer();
    R(titel, vorb&&foc&&k.length===1&&k[0]===true&&inP&&weg, {...info,foc,k,P:P.length<40?P:P.length,weg}); };
  await js(`window.__ka=[]; window.addEventListener('keydown',e=>{ if(e.ctrlKey&&e.keyCode===65) window.__ka.push(e.defaultPrevented); }); true`);
  R('Markierung: Sperrbildschirm', await until(visible('screen-lock'),15000));
  // (0) Gesperrt: boot() setzt den Fokus per 100-ms-Zeitgeber ins LEERE Passphrase-Feld, ohne Range darin — Strg+A markierte dort die ganze Sperrseite
  // (297 Zeichen, ungemeldet; Messung run-10 C1). Mutanten „Sperre hinter if(!DEK)“ und „leeres Feld durchlassen“.
  { const leerFeld=await until(`document.activeElement&&document.activeElement.id==='lock-pass'&&document.getElementById('lock-pass').value===''`,3000);
    await nichts('Gesperrt, Strg+A im leeren Passphrase-Feld (Fokus per Zeitgeber): gesperrt, nichts markiert (a2-1)', leerFeld, {leerFeld}); }
  { await mclick(await at('#screen-lock [data-i18n="lock.title"]')); const nirgends=await js(`document.activeElement===document.body`);
    await nichts('Gesperrt, Strg+A ohne Feld-Fokus: gesperrt, nichts markiert (a2-1)', nirgends, {nirgends}); }
  await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); R('Markierung: entsperrt', await until(visible('screen-app')));
  // zweite Buchung (Diagramm braucht zwei), Notiz mit NBSP
  await js(`(()=>{ App.tab('add'); App.setAddType('btc'); App.setAddDir('buy'); return true; })()`); await sleep(200);
  await fill('f-date','2025-03-02'); await fill('f-eur',String(1000+process.pid%997)); await fill('f-btc','0.015'); await fill('f-src-btc','mk-quelle-zwei'); await fill('f-note','Notiz'+NB+'mit'+NB+TAIL);
  await click('#add-btn'); R('Markierung: zweite Buchung gespeichert', await until(`(()=>{ App.tab('list'); return document.querySelector('#list-tbl tbody').textContent.includes(${JSON.stringify(TAIL)}); })()`,10000));
  // (1) Übersicht, Klick auf den Untertitel (Fokus nirgends)
  { await js(`App.tab('dash'); true`); await neutral(); const nirgends=await js(`document.activeElement===document.body`);
    await nichts('Übersicht, Strg+A ohne Feld-Fokus: gesperrt, nichts markiert, PRIMARY unverändert (a2-1)', nirgends, {nirgends}); }
  // (2) Liste, Fokus auf einem Reiter-Knopf (echter Klick)
  { await js(`App.tab('list'); true`); await mclick(await at('button[data-tab="list"]')); const knopf=await js(`document.activeElement.tagName==='BUTTON'`);
    await nichts('Liste, Strg+A mit Fokus auf einem Reiter-Knopf: gesperrt, nichts markiert (a2-1)', knopf, {knopf}); }
  // (3) Verlauf mit Diagramm, Klick auf die Überschrift
  { await js(`App.tab('verlauf'); true`); await sleep(200); await mclick(await at('#tab-verlauf h2')); const svg=await js(`document.querySelectorAll('#chart-wrap svg text').length>=4`);
    await nichts('Verlauf mit Diagramm, Strg+A: gesperrt, nichts markiert (a2-1)', svg, {svg}); }
  // (4) Formular: gefülltes Textfeld (echter Klick) → App markiert, Meldung = PRIMARY, gelöscht
  const addForm=async()=>{ await js(`(()=>{ App.tab('add'); App.setAddType('btc'); return true; })()`); await fill('f-date','2025-03-02'); await fill('f-btc','0.0421'); await fill('f-src-btc','mk-quelle-'+process.pid); await fill('f-note',''); await sleep(150); };
  { await addForm(); await neutral(); await mclick(await at('#f-src-btc')); const im=await js(`document.activeElement.id==='f-src-btc'`);
    await feld('Gefülltes Textfeld (Klick), Strg+A: App markiert das Feld, PRIMARY = Wert, gelöscht (a2-1)', P=>P==='mk-quelle-'+process.pid, im, {im}); }
  // (4b) Strg ZUERST losgelassen (keyup von A ohne Strg): die App meldet schon im keydown (Querfund Notes v1.9 a-1, Pass run-11 e-3)
  { await addForm(); await neutral(); await mclick(await at('#f-src-btc')); await ka(); await clipboard.selection.writeText('mk-vorher-b-'+process.pid); const foc=await ensureFocus();
    wc.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:'Control'}); wc.sendInputEvent({type:'keyUp',keyCode:'A'}); await sleep(500);
    const k=await ka(), inP=(await prim())==='mk-quelle-'+process.pid; await js('AlienDesktop.clip.clear()'); const weg=await leer();
    R('Strg+A, Strg zuerst losgelassen: Feld markiert (PRIMARY) und trotzdem gemeldet — Löschen leert PRIMARY', foc&&k.length===1&&k[0]===true&&inP&&weg, {foc,k,inP,weg}); }
  // (4c) Fokus im Feld OHNE Range darin (focus() + removeAllRanges per Skript): Chromium markierte die ganze Formularseite, ungemeldet (Messung run-10 A10/A11)
  { await addForm(); await neutral(); await js(`(()=>{ const f=document.getElementById('f-note'); f.scrollIntoView({block:'center'}); f.focus(); getSelection().removeAllRanges(); return true; })()`);
    const im=await js(`document.activeElement.id==='f-note'&&document.getElementById('f-note').value===''`);
    await nichts('LEERES Textfeld ohne Range, Strg+A: gesperrt, nichts markiert (a2-1)', im, {im}); }
  { await addForm(); await neutral(); await js(`(()=>{ const f=document.getElementById('f-src-btc'); f.scrollIntoView({block:'center'}); f.focus(); getSelection().removeAllRanges(); return true; })()`);
    const im=await js(`document.activeElement.id==='f-src-btc'`);
    await feld('GEFÜLLTES Textfeld ohne Range, Strg+A: App markiert NUR das Feld (nicht die Seite), gelöscht (a2-1)', P=>P==='mk-quelle-'+process.pid, im, {im}); }
  // (4d) Fokus im Datumsfeld (echter Klick): nichts — sein angezeigter Wert stünde nur in PRIMARY (benannte Grenze)
  { await addForm(); await neutral(); await mclick(await at('#f-date')); const im=await js(`document.activeElement.id==='f-date'`);
    await nichts('Datumsfeld (Klick), Strg+A: gesperrt, nichts markiert (a2-1)', im, {im}); }
  // (5) Zahlenfeld (v3.10, Entscheidung Nutzer): Strg+A markiert, gemeldet wird der angezeigte Text (PRIMARY mit deutschem Komma), gelöscht
  { await addForm(); await neutral(); await mclick(await at('#f-btc')); const im=await js(`document.activeElement.id==='f-btc'`);
    await feld('Zahlenfeld (Klick), Strg+A: markiert, PRIMARY = angezeigter Wert, gemeldet und gelöscht (bis v3.9 nie)', P=>P.replace(',','.')==='0.0421', im, {im}); }
  { await addForm(); await neutral(); const M='mk-vorher-z-'+process.pid; await clipboard.selection.writeText(M); await mclick(await at('#f-btc'),2);
    const P=await prim(), vorb=P!==M&&P.replace(',','.')==='0.0421'; await js('AlienDesktop.clip.clear()'); const weg=await leer();
    R('Zahlenfeld per Doppelklick: PRIMARY = angezeigter Wert, gemeldet und gelöscht (bis v3.9 nie)', vorb&&weg, {P,weg}); }
  // (5b) Zahlen-Pfeil (Audit run-10 a-1, gemessen): Klick auf den Pfeil eines GEFÜLLTEN Zahlenfelds markiert erst den ganzen Wert (PRIMARY) und schaltet dann
  // weiter — die App meldet den alten Wert (input ohne inputType im selben Mausdruck). Chromium setzt hoch/runter erst bei einer Mausbewegung, und bloße
  // Bewegungen per sendInputEvent kommen nicht zuverlässig an — darum die Bewegung per In-Process-CDP (webContents.debugger, nur hier im Test).
  { await addForm(); await neutral(); if(!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    for(const [id,v] of [['f-btc','0.0421'],['f-eur','2500']]){ await fill(id,v); const M='mk-vorher-p-'+id+'-'+process.pid; await clipboard.selection.writeText(M);
      const q=await js(`(()=>{ const f=document.getElementById(${JSON.stringify(id)}); f.scrollIntoView({block:'center'}); const r=f.getBoundingClientRect(); return {x:Math.round(r.right-14),y:Math.round(r.top+r.height*0.3)}; })()`);
      await ensureFocus(); for(const dx of [-3,0]) await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:q.x+dx,y:q.y,button:'none'}); await sleep(100);
      await mclick(q); const nach=await js(`document.getElementById(${JSON.stringify(id)}).value`), P=await prim(), vorb=nach!==v&&P!==M&&P.replace(',','.')===v;
      await js('AlienDesktop.clip.clear()'); const weg=await leer();
      R('Zahlen-Pfeil im gefüllten Feld ('+id+'): alter Wert in PRIMARY, gemeldet und gelöscht (Audit run-10 a-1)', vorb&&weg, {nach,P,weg}); }
    wc.debugger.detach(); }
  // (6) Dreifachklick auf die Tabellenzelle mit NBSP: Meldung mit NBSP, PRIMARY mit Leerzeichen — das Löschen greift trotzdem
  { await js(`App.tab('list'); true`); await sleep(200); await neutral(); const M='mk-vorher-6-'+process.pid; await clipboard.selection.writeText(M);
    await mclick(await atText('#list-tbl',TAIL),3); const hatNb=(await sel()).includes(NB), P=await prim(), vorb=P!==M&&!P.includes(NB)&&P.includes(TAIL);
    await js('AlienDesktop.clip.clear()'); const weg=await leer();
    R('Tabellenzelle mit NBSP per Dreifachklick: Meldung mit NBSP, PRIMARY mit Leerzeichen — Löschen leert PRIMARY (a2-1)', hatNb&&vorb&&weg, {hatNb,vorb,weg}); }
  // (7) Ziehen übers Diagramm bis in die Lücke über dem Hinweis: Achsenwerte (user-select:text am Desktop) und ein „\n“ am Rand der Meldung, nicht in PRIMARY
  // Ziehen bis in den Hinweis und bis GENAU an seinen Anfang (linke Hälfte des ersten Zeichens → Ende P@0). Am Blockanfang hängt getSelection() ein „\n“ an;
  // ob PRIMARY es auch hat, schwankte mit dem Layout (Messung run-10 N0–N3: nein, hier meist ja) — nsel trimmt beide Seiten, die fresh-Zusätze prüfen beide Richtungen
  { await js(`App.tab('verlauf'); true`); await sleep(200);
    for(const ziel of ['text','anfang']){ await neutral(); const M='mk-vorher-7-'+process.pid; await clipboard.selection.writeText(M);
      const p1=await atText('#tab-verlauf','Datenpunkte'), p2=await js(`(()=>{ const s=document.querySelector('#chart-wrap svg'), h=document.querySelector('#chart-wrap > p'); const b=s.getBoundingClientRect(), q=h.getBoundingClientRect();
        if(${JSON.stringify(ziel)}==='anfang'){ const w=document.createTreeWalker(h,NodeFilter.SHOW_TEXT); const n=w.nextNode(); const r=document.createRange(); r.setStart(n,0); r.setEnd(n,1); const c=r.getBoundingClientRect(); return {x:Math.round(c.left+1),y:Math.round(c.top+c.height/2)}; }
        return {x:Math.round(b.right-5),y:Math.round(q.top+q.height*0.3)}; })()`);
      await drag(p1,p2); const s=await sel(), P=await prim(), achse=await js(`[...document.querySelectorAll('#chart-wrap svg text')].map(n=>n.textContent)`);
      const ende=await js(`(()=>{ const r=getSelection().getRangeAt(0); return r.endContainer.nodeName+'@'+r.endOffset; })()`);
      const vorb=P!==M&&achse.every(a=>P.includes(a))&&achse.every(a=>s.includes(a))&&(ziel!=='anfang'||(ende==='P@0'&&s.endsWith('\n')));
      await js('AlienDesktop.clip.clear()'); const weg=await leer();
      R(ziel==='text'?'Ziehen übers Diagramm bis in den Hinweis: Achsenwerte in Meldung und PRIMARY (user-select:text am Desktop), gelöscht (a2-1)'
        :'Ziehen übers Diagramm bis GENAU an den Anfang des Hinweises (Ende P@0, Meldung mit „\\n“ am Rand): gelöscht', vorb&&weg, {ende,vorb,weg,sEnde:JSON.stringify(s.slice(-3)),pEnde:JSON.stringify(P.slice(-3))}); } }
  // (8) Ziehen über Tabellenzeilen samt Knöpfen (U+FFFC in PRIMARY), dann echtes Strg+L: auf dem Sperrbildschirm ist PRIMARY leer
  { await js(`App.tab('list'); true`); await sleep(200); await neutral(); const M='mk-vorher-8-'+process.pid; await clipboard.selection.writeText(M);
    await drag(await atText('#list-tbl','harness-quelle'),await atText('#list-tbl',TAIL)); const P=await prim(), vorb=P!==M&&P.includes(FC)&&(P.includes('harness-quelle'.slice(1))||P.includes(TAIL.slice(2)));
    await ensureFocus(); ctrl('L'); const gesperrt=await until(visible('screen-lock'),5000); const weg=await leer();
    R('Ziehen über Tabellenzeilen mit Knöpfen (U+FFFC in PRIMARY), dann Strg+L: PRIMARY leer (a2-1)', vorb&&gesperrt&&weg, {vorb,gesperrt,weg}); }
  await clipboard.selection.clear();
}
// v3.11: Messung und Prüfung der Querfunde aus Alien Pass v1.22 (run-12) in der echten Hülle — Vorlage Pass-Schritt m122. Ein Fall ist grün, wenn PRIMARY
// nach der Geste über die Brücke gelöscht werden kann (die App hat gemeldet, was dort liegt) bzw. wenn das Mausrad den Wert nicht ändert.
async function m311(){
  const wc=win.webContents;
  const mclick=async(p,n=1)=>{ for(let i=1;i<=n;i++){ wc.sendInputEvent({type:'mouseDown',x:p.x,y:p.y,button:'left',clickCount:i}); wc.sendInputEvent({type:'mouseUp',x:p.x,y:p.y,button:'left',clickCount:i}); } await sleep(500); };
  const at=sel=>js(`(()=>{const n=document.querySelector(${JSON.stringify(sel)}); if(!n) return null; n.scrollIntoView({block:'center'}); const b=n.getBoundingClientRect(); return {x:Math.round(b.x+Math.min(b.width/2,30)),y:Math.round(b.y+b.height/2),l:Math.round(b.left),t:Math.round(b.top)};})()`);
  const atText=(root,needle,off=1)=>js(`(()=>{ const w=document.createTreeWalker(document.querySelector(${JSON.stringify(root)}),NodeFilter.SHOW_TEXT); let n;
    while((n=w.nextNode())){ const i=n.data.indexOf(${JSON.stringify(needle)}); if(i>=0){ const r=document.createRange(); r.setStart(n,i+${off}); r.setEnd(n,i+${off}+1); const b=r.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}; } } return null; })()`);
  const drag=async(p1,p2)=>{ await ensureFocus(); wc.sendInputEvent({type:'mouseDown',x:p1.x,y:p1.y,button:'left',clickCount:1});
    for(let i=1;i<=12;i++){ wc.sendInputEvent({type:'mouseMove',x:Math.round(p1.x+(p2.x-p1.x)*i/12),y:Math.round(p1.y+(p2.y-p1.y)*i/12),button:'left',modifiers:['leftButtonDown']}); await sleep(30); }
    wc.sendInputEvent({type:'mouseUp',x:p2.x,y:p2.y,button:'left',clickCount:1}); await sleep(500); };
  const k=(c,mods=[])=>{ wc.sendInputEvent({type:'keyDown',keyCode:c,modifiers:mods}); if(c.length===1&&!mods.includes('control')) wc.sendInputEvent({type:'char',keyCode:c,modifiers:mods}); wc.sendInputEvent({type:'keyUp',keyCode:c,modifiers:mods}); };
  const type=async t=>{ for(const ch of t){ k(ch); await sleep(15); } await sleep(150); };
  const sel=()=>js(`String(getSelection())`);
  const leer=async(ms=3000)=>{ const t0=Date.now(); let ok=false; while(Date.now()-t0<ms&&!(ok=(await prim())==='')) await sleep(100); return ok; };
  const clear=async()=>{ await js('AlienDesktop.clip.clear()'); return leer(); };
  const neutral=async()=>{ await js(`getSelection().removeAllRanges(); document.activeElement&&document.activeElement.blur&&document.activeElement.blur(); true`); };
  let nr=0; const marke=async()=>{ const M='m311-vorher-'+(++nr)+'-'+process.pid; await clipboard.selection.writeText(M); return M; };
  const fall=async(titel,geste)=>{ await neutral(); const M=await marke(); const vorb=await geste(); const P=await prim(), S=await sel();
    const info={vorb,primNeu:P!==M,primLen:P.length,selLen:S.length};
    const mu=await js(`window.__mu.splice(0)`); info.muLetzte=mu.length?mu[mu.length-1].length:null; info.dragstart=await js(`window.__ds`); await js(`window.__ds=0; true`);
    info.weg=P===M?null:await clear();
    const vok=vorb===true||(vorb&&typeof vorb==='object'&&vorb.ok!==false), dok=!/Ziehen-und-Ablegen/.test(titel)||(info.dragstart>=1&&info.muLetzte===null);
    R(titel, info.weg===true&&vok&&dok, info); };
  await js(`window.__mu=[]; window.__ds=0; document.addEventListener('mouseup',()=>{ window.__mu.push(String(getSelection())); },true); document.addEventListener('dragstart',()=>{ window.__ds++; },true); true`);
  R('m311: Sperrbildschirm', await until(visible('screen-lock'),15000));
  await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); R('m311: entsperrt', await until(visible('screen-app')));
  // (13) Strg+Z/Strg+Y nach einer überschriebenen Markierung — Notiz (Text) und neue Passphrase (Passwortfeld). Reihenfolge wie Pass run-12 c-1:
  // markieren → überschreiben → Frist ablaufen (Brücke löscht, wie nach 30 s) → Strg+Z. Dazu der ältere Fall OHNE Fristablauf (HISTORIE (2), in Pass ohne Befund).
  for(const [f,tabName] of [['f-note','add'],['cp1','settings']]){
    const vorbereiten=async()=>{ await js(`(()=>{ App.tab(${JSON.stringify(tabName)}); const n=document.getElementById(${JSON.stringify(f)}); n.value=''; n.scrollIntoView({block:'center'}); return true; })()`); await sleep(250);
      const p=await at('#'+f); await ensureFocus(); await mclick(p); await type(f==='cp1'?'geheim-defgh':'abc-defgh');
      for(let i=0;i<5;i++){ k('Left',['shift']); await sleep(40); } await sleep(300); return {akt:await js(`document.activeElement.id`),vor:await prim()}; };
    const feldSel=()=>js(`(()=>{const n=document.getElementById(${JSON.stringify(f)}); return n.value.substring(n.selectionStart,n.selectionEnd);})()`);
    await fall('Strg+Z NACH Ablauf der Frist holt die überschriebene Markierung zurück ('+f+') — gemeldet, gelöscht (Pass run-12 c-1)', async()=>{
      const v=await vorbereiten(); await type('X'); await sleep(200); const weg1=await clear(); k('Z',['control']); await sleep(500); const fs1=await feldSel();
      return {ok:v.akt===f&&v.vor==='defgh'&&weg1&&fs1==='defgh'&&(await prim())==='defgh', akt:v.akt, vor:v.vor==='defgh', weg1, feld:fs1==='defgh'}; });
    // Strg+Y-Folge als Regressionsschutz — gegen v3.10.1 ohne Befund (Strg+Y holt nur einen ABGELEGTEN Text zurück; der historyRedo-Zweig ist im Stub belegt,
    // verify-v311 [7] „Strg+Y holt den abgelegten Text zurück“, run-11 c-3/e-6 — Ablegen per sendInputEvent ist in der Test-Hülle nicht verlässlich)
    await fall('Strg+Y/Strg+Z-Folge nach Fristablauf ('+f+') — PRIMARY gelöscht (Regressionsschutz, gegen v3.10.1 ohne Befund)', async()=>{
      const v=await vorbereiten(); await type('X'); await sleep(200); k('Z',['control']); await sleep(400); k('Y',['control']); await sleep(300); k('Z',['control']); await sleep(300);
      const weg1=await clear(); k('Y',['control']); await sleep(300); k('Z',['control']); await sleep(500); const fs1=await feldSel();
      return {ok:v.akt===f&&weg1&&fs1==='defgh'&&(await prim())==='defgh', akt:v.akt, weg1, feld:fs1==='defgh'}; });
    await fall('Strg+Z OHNE Fristablauf ('+f+') — Hash-Ring kennt die Markierung noch (HISTORIE (2) a2-1)', async()=>{
      const v=await vorbereiten(); await type('X'); await sleep(200); k('Z',['control']); await sleep(500); const fs1=await feldSel();
      return {ok:v.akt===f&&fs1==='defgh'&&(await prim())==='defgh', akt:v.akt, feld:fs1==='defgh'}; });
    await js(`(()=>{ const n=document.getElementById(${JSON.stringify(f)}); n.value=''; n.blur(); n.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`); await sleep(200); }
  // (16) Mausrad über einem FOKUSSIERTEN Zahlenfeld (Audit v3.10.1 Q2, bisher nur headless): Betrag im Formular und BTC-Kurs der Übersicht; Gegenprobe ohne Fokus.
  // Rad und Bewegung per In-Process-CDP (webContents.debugger) — per sendInputEvent kommen Mausereignisse in der Test-Hülle nicht zuverlässig an (run-10);
  // Vorbedingung: das Rad kommt an (die Seite scrollt, wenn kein Zahlenfeld den Fokus hat).
  if(!wc.debugger.isAttached()) wc.debugger.attach('1.3');
  const rad=async(p,dy)=>{ await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'none'}); await sleep(80);
    await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',x:p.x,y:p.y,deltaX:0,deltaY:dy}); await sleep(400); };
  for(const [f,tabName,wert] of [['f-eur','add','2500'],['price-btc','dash','91234']]){
    await js(`App.tab(${JSON.stringify(tabName)}); true`); await sleep(250);
    await fill(f,wert); const p=await at('#'+f); await ensureFocus(); await mclick(p);
    const foc=await js(`document.activeElement.id`); const v0=await js(`document.getElementById(${JSON.stringify(f)}).value`);
    await rad(p,-120); await rad(p,-120); const v1=await js(`document.getElementById(${JSON.stringify(f)}).value`);
    R('Mausrad über fokussiertem Zahlenfeld '+f+' ändert den Wert nicht (Q2)', foc===f&&v0===wert&&v1===wert, {foc,v0,v1,akt:await js(`document.activeElement.id`)});
    await js(`document.activeElement.blur(); window.scrollTo(0,0); true`); await sleep(200); const y0=await js(`Math.round(window.scrollY)`);
    await rad(p,120); await rad(p,120); const v2=await js(`document.getElementById(${JSON.stringify(f)}).value`), y1=await js(`Math.round(window.scrollY)`);
    R('Gegenprobe: Mausrad ohne Fokus über '+f+' ändert den Wert nicht, das Rad kommt an (Seite scrollt)', v2===wert&&y1!==y0, {v2,y0,y1}); }
  await fill('f-eur',''); wc.debugger.detach();
  // (14) Ziehen am Aegis-Schlüssel (.secret-box, user-select:all): Chromium startet ein Ziehen-und-Ablegen ohne mouseup (Pass run-12 c-2). Als LETZTES —
  // danach nimmt die Seite im Test keine Klicks mehr an.
  { await js(`App.tab('settings'); true`); await sleep(300); await click('[data-action="totpStart"]'); await sleep(500);
    await js(`document.getElementById('totp-secret').scrollIntoView({block:'center'}); true`); await sleep(300);
    const sec=await js(`document.getElementById('totp-secret').textContent.slice(2,6)`), ps=sec?await atText('#totp-secret',sec,1):null;
    const mu=await js(`(()=>{ const n=document.querySelector('#totp-setup p.muted[data-i18n="set.totpSetup3"]'); const b=n.getBoundingClientRect(); return {l:Math.round(b.left),t:Math.round(b.top)}; })()`);
    for(const [wo,p2] of [['Anfang p.muted',{x:mu.l+1,y:mu.t+2}],['Rand über p.muted',{x:mu.l+4,y:mu.t-6}]])
      await fall('Ziehen aus dem Aegis-Schlüssel bis '+wo+(wo==='Rand über p.muted'?' — Ziehen-und-Ablegen ohne mouseup, dragstart meldet':''), async()=>{ if(!ps) return false; await drag(ps,p2); return true; });
    await js(`App.totpCancel(); App.tab('list'); true`); await sleep(300); }
  await clipboard.selection.clear();
}
// v3.11: Speichern über den Dialog (Querfunde Alien Notes 1.12 run-10 b-1/b-5/b-8, Muster Pass-Schritt sichern): Rückfrage beim Überschreiben verlangt,
// neu und überschreibend mit Rechten 600 und ohne Temp-Reste, Fehler nur mit Code (ohne Pfad), Abbruch ohne Meldung; Sperre bei offenem Dialog schreibt keinen Klartext
async function sichern(){
  const dir=path.join(path.dirname(DATA),'sichern-'+process.pid); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const msg=(id='export-msg')=>js(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const entsperren=async()=>{ await until(visible('screen-lock'),15000); await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); return until(visible('screen-app')); };
  R('Sichern: Sperrbildschirm', await until(visible('screen-lock'),15000));
  R('Sichern: entsperrt', await entsperren());
  R('Sichern: Buchung aus [1] vorhanden (Inhalt für die Klartext-Exporte)', await js(`(()=>{ App.tab('list'); return document.querySelector('#list-tbl tbody').textContent.includes('harness-quelle-bisq'); })()`));
  await js(`App.tab('export'); true`);
  const ow=o=>Array.isArray(o.properties)&&o.properties.includes('showOverwriteConfirmation');
  const ziel=path.join(dir,'b1.vault'); dlgNext={canceled:false,filePath:ziel}; dialogs.length=0; await click('button[data-action="exportVault"]'); await sleep(1200);
  { const o=dialogs[0]||{}, da=fs.existsSync(ziel), m=da?(fs.statSync(ziel).mode&0o777):0, t=await msg();
    R('Backup neu: ein Dialog, Option showOverwriteConfirmation (ob gefragt wird: Portal, Gerätetest), Filter .vault', dialogs.length===1&&ow(o)&&o.filters[0].extensions[0]==='vault', {n:dialogs.length,props:o.properties});
    R('Backup neu: Datei da, Rechte 600, Meldung nennt nur den Dateinamen', da&&m===0o600&&/b1\.vault/.test(t)&&!t.includes(dir), {da,m:m.toString(8)}); }
  { fs.writeFileSync(ziel,'alt'); fs.chmodSync(ziel,0o644); dlgNext={canceled:false,filePath:ziel}; await click('button[data-action="exportVault"]'); await sleep(1200);
    const jetzt=fs.readFileSync(ziel,'utf8'), m=fs.statSync(ziel).mode&0o777, rest=fs.readdirSync(dir).filter(n=>n!=='b1.vault');
    R('Backup überschreibend: neuer Inhalt, Rechte 600, keine Temp-Reste', jetzt!=='alt'&&jetzt.length>100&&m===0o600&&rest.length===0, {m:m.toString(8),rest}); }
  { dlgNext={canceled:false,filePath:path.join(dir,'fehlt','x.vault')}; await click('button[data-action="exportVault"]'); await sleep(1200); const t=await msg();
    R('Backup Schreibfehler: Meldung mit Code, ohne Pfad', /ENOENT/.test(t)&&!t.includes(dir)&&!t.includes('fehlt'), t.split(dir).join('<DIR>')); }
  { dialogs.length=0; const zc=path.join(dir,'k.csv'); dlgNext={canceled:false,filePath:zc}; await click('button[data-action="exportSteuertool"]'); await sleep(1200);
    const o=dialogs[0]||{}, b=fs.existsSync(zc)?fs.readFileSync(zc):Buffer.alloc(0);
    R('CSV: Option showOverwriteConfirmation, Datei mit BOM und Inhalt, Rechte 600', ow(o)&&b[0]===0xEF&&b.toString('utf8').includes('harness-quelle-bisq')&&(fs.statSync(zc).mode&0o777)===0o600, {props:o.properties,len:b.length});
    dlgNext={canceled:false,filePath:path.join(dir,'fehlt','k.csv')}; await click('button[data-action="exportSteuertool"]'); await sleep(1200); const t=await msg();
    R('CSV Schreibfehler: Meldung mit Code, ohne Pfad', /ENOENT/.test(t)&&!t.includes(dir)&&!t.includes('fehlt'), t.split(dir).join('<DIR>')); }
  { await js(`document.getElementById('export-msg').textContent='x'; true`); cancelDialog=true; await click('button[data-action="exportSteuertool"]'); await sleep(900); cancelDialog=false;
    R('CSV abgebrochen: keine Meldung (exportTaxCsv leert die Zeile vorab), keine neue Datei', (await msg())===''&&fs.readdirSync(dir).filter(n=>/\.csv$/.test(n)).length===1, {msg:await msg(),dateien:fs.readdirSync(dir)}); }
  { dialogs.length=0; await click('button[data-action="openNachlass"]'); await until(visible('nachlass-overlay'),5000); const zp=path.join(dir,'n.pdf'); dlgNext={canceled:false,filePath:zp};
    await click('button[data-action="printNachlass"]'); await until(`/\\.pdf/.test(document.getElementById('nl-msg').textContent)`,20000); const o=dialogs[0]||{}, b=fs.existsSync(zp)?fs.readFileSync(zp):Buffer.alloc(0);
    R('PDF: Option showOverwriteConfirmation, %PDF-Kopf, Rechte 600', ow(o)&&b.slice(0,5).toString()==='%PDF-'&&(fs.statSync(zp).mode&0o777)===0o600, {props:o.properties,len:b.length});
    await click('#nachlass-overlay button[data-action="closeNachlass"]'); }
  // Kennungen (v3.11): jede genau einmal, nur passend zur Art (Text ≠ PDF), unbekannte abgewiesen — direkt über die Brücke (nur mit der zweistufigen Brücke;
  // die Messung gegen v3.10.1 überspringt den Block, damit die Sperr-Fälle danach auch dort laufen)
  if(await js(`typeof AlienDesktop.saveText==='object'`)){ const t1=path.join(dir,'t1.txt'), t2=path.join(dir,'t2.txt'); dlgNext={canceled:false,filePath:t1};
    const r1=await js(`(async()=>{ const o={}; const tok=await AlienDesktop.saveText.pick('t1.txt'); o.form=typeof tok==='string'&&/^[0-9a-f]{32}$/.test(tok);
      try{ await AlienDesktop.savePdf.write(tok); o.art='geschrieben'; }catch(e){ o.art=/stale/.test(e.message); }
      try{ await AlienDesktop.saveText.write(tok,'x'); o.danach='geschrieben'; }catch(e){ o.danach=/stale/.test(e.message); }
      try{ await AlienDesktop.saveText.write('f'.repeat(32),'x'); o.fremd='geschrieben'; }catch(e){ o.fremd=/stale/.test(e.message); } return o; })()`);
    R('Kennung: Text-Kennung taugt nicht fürs PDF und verfällt dabei, fremde Kennung abgewiesen', r1.form===true&&r1.art===true&&r1.danach===true&&r1.fremd===true&&!fs.existsSync(t1), r1);
    dlgNext={canceled:false,filePath:t2};
    const r2=await js(`(async()=>{ const o={}; const tok=await AlienDesktop.saveText.pick('t2.txt'); o.n=await AlienDesktop.saveText.write(tok,'zwei');
      try{ await AlienDesktop.saveText.write(tok,'nochmal'); o.zweimal='geschrieben'; }catch(e){ o.zweimal=/stale/.test(e.message); } return o; })()`);
    R('Kennung genau einmal: erster write schreibt (600), zweiter abgewiesen', r2.n==='t2.txt'&&r2.zweimal===true&&fs.readFileSync(t2,'utf8')==='zwei'&&(fs.statSync(t2).mode&0o777)===0o600, r2);
    // run-11 c-2: fremde Kennung WÄHREND einer offenen Wahl → abgewiesen, und die Wahl verfällt; Frist (EXPORT_TTL 60 s) per vorgestellter Uhr des Hauptprozesses
    const t3=path.join(dir,'t3.txt'); dlgNext={canceled:false,filePath:t3};
    const r3=await js(`(async()=>{ const o={}; const tok=await AlienDesktop.saveText.pick('t3.txt');
      try{ await AlienDesktop.saveText.write('a'.repeat(32),'x'); o.fremd='geschrieben'; }catch(e){ o.fremd=/stale/.test(e.message); }
      try{ await AlienDesktop.saveText.write(tok,'x'); o.danach='geschrieben'; }catch(e){ o.danach=/stale/.test(e.message); } return o; })()`);
    R('Kennung: fremde Kennung bei offener Wahl abgewiesen, die Wahl verfällt (c-2)', r3.fremd===true&&r3.danach===true&&!fs.existsSync(t3), r3);
    const t4=path.join(dir,'t4.txt'); dlgNext={canceled:false,filePath:t4}; const tok4=await js(`AlienDesktop.saveText.pick('t4.txt')`);
    const realNow=performance.now.bind(performance); Object.defineProperty(performance,'now',{value:()=>realNow()+61000,configurable:true,writable:true});
    let r4=null, vor=false; try{ vor=performance.now()>realNow()+60000; r4=await js(`AlienDesktop.saveText.write(${JSON.stringify(tok4)},'x').then(()=>'geschrieben',e=>/stale/.test(e.message))`); }
    finally{ delete performance.now; }
    R('Kennung nach Ablauf der Frist (Uhr +61 s) abgewiesen (c-2)', vor&&r4===true&&!fs.existsSync(t4), {vor,r4}); }
  // Sperre, während der Speichern-Dialog offen ist (Auto-Sperre, Strg+L vor dem Dialog-Fokus): danach darf kein Klartext mehr auf die Platte (Notes 1.12 b-1)
  const offen=async w=>{ for(let i=0;i<100&&!w.frei;i++) await sleep(100); return !!w.frei; };
  { const w={}; dlgWait=w; const zs=path.join(dir,'nach-sperre.csv'); await click('button[data-action="exportSteuertool"]'); const o1=await offen(w);
    await js(`App.lockNow(); true`); const gesperrt=await until(visible('screen-lock'),5000); w.frei&&w.frei({canceled:false,filePath:zs}); await sleep(1500);
    R('Sperre bei offenem CSV-Dialog: keine Klartext-Datei', o1&&gesperrt&&!fs.existsSync(zs), {o1,gesperrt,da:fs.existsSync(zs)}); }
  R('Sichern: wieder entsperrt', await entsperren());
  { await js(`App.tab('export'); true`); await click('button[data-action="openNachlass"]'); await until(visible('nachlass-overlay'),5000);
    const w={}; dlgWait=w; const zp=path.join(dir,'nach-sperre.pdf'); await click('button[data-action="printNachlass"]'); const o1=await offen(w);
    await js(`App.lockNow(); true`); const gesperrt=await until(visible('screen-lock'),5000); w.frei&&w.frei({canceled:false,filePath:zp}); await sleep(2500);
    R('Sperre bei offenem PDF-Dialog: kein Nachlass-PDF', o1&&gesperrt&&!fs.existsSync(zp), {o1,gesperrt,da:fs.existsSync(zp)}); }
  R('Sichern: entsperrt für den TXT-Fall', await entsperren());
  { await js(`App.tab('export'); true`); await click('button[data-action="openNachlass"]'); await until(visible('nachlass-overlay'),5000);
    const w={}; dlgWait=w; const zt=path.join(dir,'nach-sperre.txt'); await click('button[data-action="exportNachlassTxt"]'); const o1=await offen(w);
    await js(`App.lockNow(); true`); const gesperrt=await until(visible('screen-lock'),5000); w.frei&&w.frei({canceled:false,filePath:zt}); await sleep(1500);
    R('Sperre bei offenem TXT-Dialog: kein Nachlass-Text', o1&&gesperrt&&!fs.existsSync(zt), {o1,gesperrt,da:fs.existsSync(zt)}); }
  fs.rmSync(dir,{recursive:true,force:true});
}
async function unreadable(){
  R('Lesefehler: keine Einrichtung', await until(visible('screen-lock'),15000)&&!(await js(visible('screen-setup'))));
  R('Lesefehler: Meldung', /nicht lesbar|not readable/.test(await js(`document.getElementById('lock-err').textContent`)));
  await fill('lock-pass',PP); await click('#unlock-btn'); await sleep(800);
  R('Lesefehler: Entsperren bleibt gesperrt', await js(visible('screen-lock'))&&!(await js(visible('screen-app'))));
}

// ===== v3.12 Phase 1b: Markierungs-Proben (Port aus Alien Notes v1.15, dort verify-desktop [2l]–[2z]; Notes übernahm sie aus Alien Pass v1.23 run-13) =====
// An die Tresor-Oberfläche angepasst: das lange einzeilige Feld (Notes #f-title, Pass #f-pass) ist #f-note (Notiz im Formular „Erfassen“), das zweite Feld
// #f-src-btc, das Passwortfeld #cp-cur (Einstellungen); Seitentext ist das Handbuch (#help-overlay), das Nachlass-Blatt (#nachlass-overlay) und die Bestandsliste
// (#list-tbl, Notizen mit Marker). Der Knopf für den Fokuswechsel (Notes Kästchen #f-fav) ist „＋ Kauf“ im Formular (ändert nichts). Eine Textarea und eine Suche
// hat der Tresor nicht — deren Notes-Varianten entfallen. Jede Probe meldet rot, wenn ihre Geste die Lage nicht herstellt (vorb im Ergebnis). Nur Längen, Marker
// und Wahrheitswerte in der Ausgabe. Umgebungsvariablen wie Notes, Vorsilbe ST_ statt AP_.
const {spawn:spawn3}=require('child_process');
const mouseOf2=wc=>(type,x,y,o={})=>wc.sendInputEvent({type,x:Math.round(x),y:Math.round(y),button:o.button||'left',clickCount:o.cc||1,...(o.mod?{modifiers:o.mod}:{})});
const key2=(wc,k,mod)=>{ wc.sendInputEvent({type:'keyDown',keyCode:k,...(mod?{modifiers:mod}:{})}); if(!mod||!mod.includes('control')) wc.sendInputEvent({type:'char',keyCode:k,...(mod?{modifiers:mod}:{})}); wc.sendInputEvent({type:'keyUp',keyCode:k,...(mod?{modifiers:mod}:{})}); };
const keyNC3=(wc,k,mod)=>{ wc.sendInputEvent({type:'keyDown',keyCode:k,...(mod?{modifiers:mod}:{})}); wc.sendInputEvent({type:'keyUp',keyCode:k,...(mod?{modifiers:mod}:{})}); };
const strgL3=wc=>{ wc.sendInputEvent({type:'keyDown',keyCode:'Control'}); wc.sendInputEvent({type:'keyDown',keyCode:'L',modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:'L',modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:'Control'}); };
const strgCM=wc=>{ wc.sendInputEvent({type:'keyDown',keyCode:'Control'}); wc.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['control']}); wc.sendInputEvent({type:'keyUp',keyCode:'Control'}); };
const fsel=id=>js(`(()=>{ const t=document.getElementById(${JSON.stringify(id)}); return {s:t.selectionStart,e:t.selectionEnd,d:t.selectionDirection,akt:document.activeElement&&document.activeElement.id,v:t.value}; })()`);
const caretXY=(id,pos)=>js(`(()=>{ const n=document.getElementById(${JSON.stringify(id)}), cs=getComputedStyle(n), d=document.createElement('div');
  ['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight','wordBreak','overflowWrap','tabSize','paddingTop','paddingLeft','paddingRight','borderTopWidth','borderLeftWidth'].forEach(k=>d.style[k]=cs[k]);
  Object.assign(d.style,{position:'absolute',visibility:'hidden',whiteSpace:n.tagName==='TEXTAREA'?'pre-wrap':'pre',boxSizing:'content-box',width:(n.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight))+'px',left:'0',top:'0'});
  d.textContent=n.value.slice(0,${pos}); const m=document.createElement('span'); m.textContent=n.value.slice(${pos},${pos}+1)||'.'; d.appendChild(m); document.body.appendChild(d);
  const b=n.getBoundingClientRect(), x=b.left+parseFloat(cs.borderLeftWidth)+m.offsetLeft+m.offsetWidth/2-n.scrollLeft, y=n.tagName==='INPUT'?b.top+b.height/2:b.top+parseFloat(cs.borderTopWidth)+m.offsetTop+m.offsetHeight/2-n.scrollTop; d.remove(); return {x,y}; })()`);
const leer3=async(ms=3000)=>{ const t0=Date.now(); let ok=false; while(Date.now()-t0<ms&&!(ok=(await prim())==='')) await sleep(100); return ok; };
// Innenkante eines Feldes (l/r ohne Polster und Rahmen), Außenkante R, Zeilenmitte y
const boxM=id=>js(`(()=>{ const t=document.getElementById(${JSON.stringify(id)}); const b=t.getBoundingClientRect(), cs=getComputedStyle(t);
  const l=b.left+parseFloat(cs.paddingLeft)+parseFloat(cs.borderLeftWidth), r=b.right-parseFloat(cs.paddingRight)-parseFloat(cs.borderRightWidth);
  const y=t.tagName==='TEXTAREA'?b.top+parseFloat(cs.borderTopWidth)+parseFloat(cs.paddingTop)+8:b.top+b.height/2;
  return {l,r,R:b.right,y,w:b.width,ih:innerHeight,iw:innerWidth,sicht:b.width>0&&b.top>=0&&b.bottom<=innerHeight}; })()`);
const posM=(sel,zeigen)=>js(`(()=>{ const n=document.querySelector(${JSON.stringify(sel)}); if(!n) return null; ${zeigen?"n.scrollIntoView({block:'center'});":''} const b=n.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; })()`);
// Lage eines Feldes; kn: liegt der Fokus auf dem Knopf (Selektor)?
const lageM=(feld,kn)=>js(`(()=>{ const g=getSelection(), t=document.getElementById(${JSON.stringify(feld)}), a=document.activeElement; return {akt:a&&(a.id||a.tagName), kn:!!(${JSON.stringify(kn||'')}&&a&&a.matches&&a.matches(${JSON.stringify(kn||'*')})), coll:g.rangeCount?g.getRangeAt(0).collapsed:null, f:[t.selectionStart,t.selectionEnd]}; })()`);
const ziehM=async(mouse,a,z,n,ms)=>{ mouse('mouseDown',a.x,a.y); for(let i=1;i<=n;i++){ mouse('mouseMove',a.x+(z.x-a.x)*i/n,a.y+(z.y-a.y)*i/n,{mod:['leftButtonDown']}); await sleep(ms); } };
// Klick mit 1 px Zittern (Drücken, 1 px Bewegung mit gehaltener Taste, Loslassen) bzw. ohne Bewegung
const klickM=async(mouse,k,zitter)=>{ mouse('mouseDown',k.x,k.y); await sleep(zitter?40:80); if(zitter){ mouse('mouseMove',k.x+1,k.y,{mod:['leftButtonDown']}); await sleep(40); } mouse('mouseUp',k.x+(zitter?1:0),k.y); };
// Ereigniszähler im Fenster (Gesten-Nachweis für vorb); liefert die Zähler seit dem letzten Aufruf und setzt sie zurück
const instM=()=>js(`(()=>{ if(!window.__evM){ window.__evM={ds:0,md:0,mu:0,mmb:0}; document.addEventListener('dragstart',()=>{window.__evM.ds++;},true);
  document.addEventListener('mousedown',()=>{window.__evM.md++;},true); document.addEventListener('mouseup',()=>{window.__evM.mu++;},true);
  document.addEventListener('mousemove',e=>{ if(e.buttons&1) window.__evM.mmb++; },true); }
  const r=Object.assign({},window.__evM); window.__evM.ds=0; window.__evM.md=0; window.__evM.mu=0; window.__evM.mmb=0; return r; })()`);
// Text-Position im Seitentext (Mitte des Zeichens nach dem Fund) unter root; zeigen: vorher ins Bild rollen
const txtPos=(root,needle,zeigen)=>js(`(()=>{ const w=document.createTreeWalker(document.querySelector(${JSON.stringify(root)}),NodeFilter.SHOW_TEXT); let n;
  while((n=w.nextNode())){ const i=n.data.indexOf(${JSON.stringify(needle)}); if(i>=0){ ${zeigen?"n.parentElement.scrollIntoView({block:'center'});":''} const r=document.createRange(); r.setStart(n,i); r.setEnd(n,i+1); const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; } } return null; })()`);
const KNOPF='#add-dir button[data-d="buy"]';
// Entsperren (allein gestartet mit leerem Test-Home: Tresor anlegen), Auto-Lock aus, Meldung weg
async function unlockT(){
  if(await until(visible('screen-setup'),3000)){ await fill('setup-pass1',PP); await fill('setup-pass2',PP); await click('#setup-btn'); }
  else { R('Sperrbildschirm', await until(visible('screen-lock'),15000)); await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); }
  const ok=await until(visible('screen-app'),60000); if(ok){ await js(`App.setAutolock('0'); App.hideToast(); true`); await sleep(300); } return ok; }
async function relock3(){ if(await js(visible('screen-lock'))){ await ensureFocus(); await fill('lock-pass',PP); await click('#unlock-btn'); await until(visible('screen-app'),60000); await js(`App.hideToast(); true`); await sleep(400); } }
// Formular „Erfassen“ (Bitcoin, Kauf) mit Notiz und Quelle; nichts wird gespeichert
async function formT(note,src){ await js(`(()=>{ App.tab('add'); App.setAddType('btc'); App.setAddDir('buy'); window.scrollTo(0,0); return true; })()`); await sleep(250);
  await fill('f-note',note); await fill('f-src-btc',src===undefined?'':src); await sleep(150); }
// Einstellungen, Passphrase-Felder (#cp-cur) mit Wert
async function cpT(val){ await js(`(()=>{ App.tab('settings'); return true; })()`); await sleep(300); await fill('cp-cur',val); await fill('cp1',''); await fill('cp2',''); await sleep(150); }
// Buchungen mit Notizen speichern (Bestandsliste mit Marker-Text), einmal je Prozess
let buchFehler=[];
async function buchungenT(notes){ buchFehler=[]; for(const [i,n] of notes.entries()){ await js(`(()=>{ App.tab('add'); App.setAddType('btc'); App.setAddDir('buy'); return true; })()`); await sleep(150);
    // Betrag je Prozess eindeutig: [2p] und [2q] laufen auf derselben Datei — gleiche Buchung am selben Tag löste die Dubletten-Rückfrage aus (nichts gespeichert)
    await fill('f-date','2025-0'+(1+i%9)+'-1'+(i%9)); await fill('f-eur',String(1000+i)); await fill('f-btc',(0.01+i*0.001+(process.pid%997)*0.00001).toFixed(5)); await fill('f-src-btc','q'+i); await fill('f-note',n); await click('#add-btn'); await sleep(600);
    const e=await js(`(()=>{ const a=document.getElementById('add-err'), d=document.getElementById('dlg'); return {err:a?a.textContent.slice(0,60):'',dlg:!!(d&&!d.classList.contains('hidden')),dlgText:d?d.textContent.slice(0,50):''}; })()`); if(e.err||e.dlg){ buchFehler.push([i,e]); await js(`App.dialogClose&&App.dialogClose(false); true`).catch(()=>{}); } }
  await js(`App.tab('list'); App.hideToast(); true`); await sleep(400);
  const ok=await until(`(()=>{ const t=document.querySelector('#list-tbl tbody').textContent; return ${JSON.stringify(notes)}.every(n=>t.includes(n)); })()`,8000);
  if(!ok) R('Buchungen: Diagnose',false,{buchFehler,tbody:await js(`document.querySelector('#list-tbl tbody').textContent.length`)}); return ok; }

// [2l] b-1 in Feldern (Notes [2w]/Pass pwnachrollen ohne verdeckte Markierung): vom Feldanfang in Stufen bis hinter den rechten Rand ziehen, Maus ruht, Chromium rollt
// bis ans Ende, PRIMARY hinkt hinterher. Loslassen: PRIMARY = Endstand, nach dem Löschen leer. #f-note und #cp-cur (Passphrase im Klartext in PRIMARY).
async function nachrollen(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='R'+process.pid, M='mk-nr-'+process.pid;
  const cnt=t=>(t.match(new RegExp(G,'g'))||[]).length;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  await instM();
  for(const wo of (process.env.ST_NRV||'note,cp').split(',')){
    const feld=wo==='cp'?'cp-cur':'f-note', T=`document.getElementById('${feld}')`, val=Array.from({length:wo==='cp'?20:120},(_,i)=>G+'x'+i).join('-');
    if(wo==='cp') await cpT(val); else await formT(val);
    await js(`(()=>{ const t=${T}; t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(300);
    await clipboard.selection.writeText(M); await sleep(150); await ensureFocus(); await instM();
    const b=await boxM(feld), a={x:b.l+1,y:b.y}; let stufen=0, z={x:Math.min(b.R+40,b.iw-12),y:b.y};
    mouse('mouseDown',a.x,a.y); await sleep(60);
    for(let i=1;i<=6;i++){ const e0=await js(`${T}.selectionEnd`); mouse('mouseMove',a.x+(b.r-8-a.x)*i/6,a.y,{mod:['leftButtonDown']}); if(await until(`${T}.selectionEnd>${e0}&&${T}.selectionStart===0`,2000)) stufen++; }
    mouse('mouseMove',z.x,a.y,{mod:['leftButtonDown']}); const rollt=await until(`${T}.scrollLeft>0`,3000);
    for(let i=1;i<=6;i++){ mouse('mouseMove',Math.min(z.x+i*2,b.iw-2),a.y+(i%2),{mod:['leftButtonDown']}); await sleep(40); } z={x:Math.min(z.x+12,b.iw-2),y:a.y};
    const ende=await until(`${T}.selectionStart===0&&${T}.selectionEnd===${T}.value.length`,30000); await sleep(400);
    const pR=await prim(), sR=await fsel(feld), selR=sR.v.slice(sR.s,sR.e);
    mouse('mouseUp',z.x,z.y); await sleep(800);
    const ev=await instM(), p=await prim(), s=await fsel(feld), sel=s.v.slice(s.s,s.e);
    await js('AlienDesktop.clip.clear()'); const weg=await leer3();
    // Lage: das Ziehen schrieb PRIMARY, der Endstand ist das ganze Feld, PRIMARY hinkte bei ruhender Maus hinterher, je ein Drücken/Loslassen, kein Ziehen-und-Ablegen
    const vorb=cnt(pR)>0&&pR!==M&&ende&&cnt(selR)>cnt(pR)&&ev.ds===0&&ev.md===1&&ev.mu===1&&sel.length===val.length;
    R(`#${feld}: bis hinter den rechten Rand gezogen, Maus ruht (Nachrollen bis ans Ende), losgelassen: PRIMARY = Endstand, nach dem Löschen leer`, vorb&&p===sel&&weg,
      {vorb,stufen,rollt,ende,ev,ruhe:{pLen:pR.length,pMarker:cnt(pR),selLen:selR.length,selMarker:cnt(selR)},pLen:p.length,selLen:sel.length,gleich:p===sel,weg});
    await clipboard.selection.clear();
    if(!weg){ await js('App.lock(); true'); await sleep(1000); await relock3(); }
  }
}

// [2m] Notes run-12 b2-1 (Rückschritt aus dem Fix b-1): ein Klick IN eine Markierung hebt sie auf (Cursor an die Klickstelle), ein danach getipptes Zeichen
// überschreibt nichts — #f-note (gezogen, Doppelklick), Handbuch (Seiten-Markierung). reselect nur nach einem Ziehen.
async function markklick(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='Klick-'+process.pid;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  const body='alpha beta gamma delta epsilon zeta eta theta '+G;
  for(const [art,wie] of [['Ziehen','drag'],['Doppelklick','dbl']]){
    await formT(body);
    await js(`(()=>{ const t=document.getElementById('f-note'); t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(150);
    await clipboard.selection.clear(); await ensureFocus();
    const i0=body.indexOf('beta'), i1=body.indexOf('delta')+5;
    const a=await caretXY('f-note',i0), z=await caretXY('f-note',i1-1);
    if(wie==='drag'){ mouse('mouseDown',a.x-3,a.y); for(let i=1;i<=8;i++){ mouse('mouseMove',a.x-3+(z.x+4-(a.x-3))*i/8,a.y,{mod:['leftButtonDown']}); await sleep(30); } mouse('mouseUp',z.x+4,z.y); }
    else { mouse('mouseDown',a.x,a.y,{cc:1}); mouse('mouseUp',a.x,a.y,{cc:1}); mouse('mouseDown',a.x,a.y,{cc:2}); mouse('mouseUp',a.x,a.y,{cc:2}); }
    await sleep(400); const s1=await fsel('f-note'); const p1=await prim();
    await sleep(900); const mid=await caretXY('f-note',wie==='drag'?body.indexOf('gamma')+2:i0+2);
    mouse('mouseDown',mid.x,mid.y,{cc:1}); await sleep(60); mouse('mouseUp',mid.x,mid.y,{cc:1}); await sleep(400);
    const s2=await fsel('f-note');
    R(`#f-note, ${art} markiert, Klick hinein: Markierung aufgehoben`, s1.s<s1.e&&s2.s===s2.e, {vorher:[s1.s,s1.e,s1.d,s1.akt], primGleich:p1===body.slice(s1.s,s1.e), nachher:[s2.s,s2.e,s2.d,s2.akt]});
    key2(wc,'X'); await sleep(300); const s3=await fsel('f-note');
    const lost=body.length-(s3.v.length-1);
    R(`  → ein Zeichen getippt: kein markierter Text überschrieben`, lost===0, {laengeVorher:body.length, laengeNachher:s3.v.length, verloren:lost});
  }
  // Handbuch (Seiten-Markierung)
  { await js(`App.openHelp(); true`); await sleep(400);
    // erster sichtbarer Textknoten im Handbuch mit mindestens 60 Zeichen in EINER Zeile (Anfang, Ende, Mitte gleich hoch)
    const q=await js(`(()=>{ const o=document.getElementById('help-overlay'); o.scrollTop=0; const w=document.createTreeWalker(o,NodeFilter.SHOW_TEXT); let n; const r=document.createRange();
      const at=i=>{ r.setStart(n,i); r.setEnd(n,i+1); const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
      while((n=w.nextNode())){ if(n.data.length<60||!n.parentElement.closest('p,li')) continue; const a=at(2), z=at(40), m=at(20); if(a.y>160&&a.y<innerHeight-60&&Math.abs(a.y-z.y)<2&&Math.abs(a.y-m.y)<2) return {a,z,m}; } return null; })()`);
    if(!q){ R('Handbuch: Textzeile gefunden',false); return; }
    await clipboard.selection.clear(); await ensureFocus();
    mouse('mouseDown',q.a.x-3,q.a.y); for(let i=1;i<=8;i++){ mouse('mouseMove',q.a.x-3+(q.z.x-(q.a.x-3))*i/8,q.a.y,{mod:['leftButtonDown']}); await sleep(30); } mouse('mouseUp',q.z.x,q.z.y); await sleep(400);
    const g1=await js(`String(getSelection())`); await sleep(900);
    mouse('mouseDown',q.m.x,q.m.y,{cc:1}); await sleep(60); mouse('mouseUp',q.m.x,q.m.y,{cc:1}); await sleep(400);
    const g2=await js(`({c:getSelection().isCollapsed,l:String(getSelection()).length})`);
    R('Handbuch, Ziehen markiert, Klick hinein: Markierung aufgehoben', g1.length>0&&g2.c, {vorher:g1.length, nachher:g2});
    await js(`getSelection().removeAllRanges(); App.closeHelp(); true`); await sleep(300); }
  await clipboard.selection.clear();
}

// [2n] Notes run-12 b2-2: Sperre bei GEHALTENER Maustaste nach dem Nachrollen im Handbuch (b-1-Fundort) — per Strg+L, Zeitgeber (auch ohne Nachrollen) und
// Minimieren (Tresor: keine Sofort-Sperre im Hintergrund — Auto-Lock 1 min, Uhr vorgestellt, die Sperre kommt beim Zurückholen, Taste noch gehalten);
// Gegenprobe erst loslassen, dann sperren. Nach der Sperre darf kein Handbuchtext in PRIMARY stehen.
async function sperrziehen(){
  const wc=win.webContents, mouse=mouseOf2(wc), M='mk-b2-'+process.pid;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  for(const wie of (process.env.ST_WIE||'strgL,timer,timerOhne,minimize,mouseup').split(',')){
    await js(`(()=>{ getSelection().removeAllRanges(); App.openHelp(); return true; })()`); await sleep(400);
    const q=await js(`(()=>{ const o=document.getElementById('help-overlay'); o.scrollTop=0; const p=[...o.querySelectorAll('p,li')].find(e=>e.getBoundingClientRect().top>160&&e.textContent.length>60); const r=p.getBoundingClientRect(), b=o.getBoundingClientRect(); return {x:r.left+6,y:r.top+6,bx:b.left+b.width/2,bb:b.bottom,bm:b.top+b.height/2,top:o.scrollTop}; })()`);
    await clipboard.selection.writeText(M); await ensureFocus();
    const z={x:q.bx,y:wie==='timerOhne'?q.bm:q.bb-1};
    if(wie==='minimize') await js(`App.setAutolock('1'); App.hideToast(); true`);
    mouse('mouseDown',q.x,q.y); for(let i=1;i<=14;i++){ mouse('mouseMove',q.x+(z.x-q.x)*i/14,q.y+(z.y-q.y)*i/14,{mod:['leftButtonDown']}); await sleep(30); }
    await sleep(120); const pDrag=await prim(); await sleep(2500); const sel=await js(`String(getSelection())`), y1=await js(`document.getElementById('help-overlay').scrollTop`);
    const pHold=await prim();
    let minEv=null;
    if(wie==='strgL') strgL3(wc);
    else if(wie==='timer'||wie==='timerOhne') await js(`setTimeout(()=>App.lock(),0); true`);
    else if(wie==='minimize'){ minEv=await new Promise(r=>{ win.once('minimize',()=>r(true)); win.minimize(); setTimeout(()=>r(false),3000); }); await sleep(600);
      await js(`(()=>{ window.__dateNow=Date.now; Date.now=()=>window.__dateNow()+61000; return true; })()`); await restoreFocused(); await sleep(800); }
    else mouse('mouseUp',z.x,z.y);
    await sleep(1500);
    if(wie!=='mouseup') mouse('mouseUp',z.x,z.y,{});
    await sleep(800);
    const gesperrt=await js(visible('screen-lock'));
    if(wie==='minimize') await js(`(()=>{ if(window.__dateNow) Date.now=window.__dateNow; return true; })()`);
    if(wie==='mouseup'){ await js('App.lock(); true'); await sleep(1200); }
    const pEnd=await prim(); const weg=pEnd===''||pEnd===M;
    // Lage: markiert, Nachrollen (außer timerOhne) mit hinterherhinkendem PRIMARY, gesperrt
    const vorb=sel.length>0&&pHold!==M&&(wie==='timerOhne'||(y1>q.top&&pHold.length<sel.length))&&(wie==='mouseup'||gesperrt)&&(wie!=='minimize'||minEv);
    R(`${wie==='timerOhne'?'Handbuch OHNE Nachrollen (Mitte), ':'Handbuch nachgerollt, '}dann ${wie==='strgL'?'Strg+L bei ruhender Maus':wie==='timer'||wie==='timerOhne'?'Sperre per Zeitgeber bei ruhender Maus':wie==='minimize'?'Minimieren und Sperre beim Zurückholen, Taste gehalten':'Loslassen, dann Sperre (Gegenprobe)'}: nach der Sperre kein Handbuchtext in PRIMARY`, vorb&&weg,
      {vorb,gesperrt,minEv,scroll:[q.top,y1],primNachZug:pDrag.length,selBeiRuhe:sel.length,primBeiRuhe:pHold.length,primNachSperre:pEnd.length});
    await clipboard.selection.clear();
    if(wie==='minimize') await js(`App.setAutolock('0'); App.hideToast(); true`).catch(()=>{});
    await relock3(); if(wie==='minimize') await js(`App.setAutolock('0'); App.hideToast(); true`).catch(()=>{});
  }
}

// [2o] Notes run-12 b3-2: eine FREMDE Auswahl, die Anfang/Ende/Wort/Zeichen der stehenden Markierung ist, bleibt nach einer Meldung (Taste) und Löschen bzw. Strg+L
// stehen (die Hülle liest PRIMARY nur bei eigenem Ziehen). Feld #f-note.
async function fremdanfang(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='GEHEIM-'+process.pid;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  const lines=Array.from({length:12},(_,i)=>'Zeile '+i+' '+G+' text').join(' | ');
  for(const v of (process.env.ST_V||'wort:frist,zeichen:frist,ende:frist,wort:sperre,unbezogen:frist').split(',')){ const [art,wann]=v.split(':');
    await formT(lines);
    await js(`(()=>{ const t=document.getElementById('f-note'); t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(150);
    await clipboard.selection.clear(); await ensureFocus();
    const i0=lines.indexOf('Zeile 1 '), i1=lines.indexOf('Zeile 2 ')+9;
    const a=await caretXY('f-note',i0), z=await caretXY('f-note',i1);
    mouse('mouseDown',a.x-2,a.y); for(let i=1;i<=8;i++){ mouse('mouseMove',a.x-2+(z.x-(a.x-2))*i/8,a.y+(z.y-a.y)*i/8,{mod:['leftButtonDown']}); await sleep(30); } mouse('mouseUp',z.x,z.y); await sleep(600);
    const s=await fsel('f-note'); const S=s.v.slice(s.s,s.e); const pS=(await prim())===S;
    const F=art==='wort'?S.split(' ')[0]:art==='zeichen'?S[0]:art==='ende'?S.slice(-3):'fremd-'+process.pid;
    await clipboard.selection.writeText(F); await sleep(200); const vorF=(await prim())===F;
    // Meldung auslösen ohne die Markierung zu ändern: Umschalt drücken/loslassen (keydown + keyup melden)
    keyNC3(wc,'Shift'); await sleep(600);
    let gesperrt=false;
    if(wann==='frist'){ await js('AlienDesktop.clip.clear()'); await sleep(800); }
    else { strgL3(wc); await sleep(1500); gesperrt=await js(visible('screen-lock')); }
    const pEnd=await prim();
    R(`fremde Auswahl = ${art} der Markierung in #f-note, dann ${wann==='frist'?'Löschen (wie Frist)':'Strg+L'}: fremde Auswahl bleibt stehen`, S.length>8&&pS&&vorF&&pEnd===F, {selLen:S.length, pS, vorF, gesperrt, primNachher:pEnd===F?'fremd':pEnd===''?'leer':'anders'});
    await clipboard.selection.clear();
    if(gesperrt) await relock3();
  }
}

// Fremd-Prozess (desktop/test/fremd-app, wortgleich Notes): hält PRIMARY und wird per SIGSTOP angehalten (hängender fremder Besitzer), bzw. liest PRIMARY von außen
let fremdPid=0;
const fremdAlle=[];
async function fremdStart(F,buf,name){
  const dir=path.join(__dirname,'fremd-app'), cfg=path.join(process.env.XDG_CONFIG_HOME||__dirname,'fremd'+(name||'')); fs.mkdirSync(cfg,{recursive:true});
  const pr=spawn3(process.execPath,['--no-sandbox',dir],{env:{...process.env,XDG_CONFIG_HOME:cfg,FREMD_TEXT:F,FREMD_BUF:buf||'selection',ST_STEP:''},stdio:['ignore','pipe','ignore']});
  fremdAlle.push(pr.pid); if(!name) fremdPid=pr.pid; let own=false; pr.stdout.on('data',d=>{ if(String(d).includes('OWN')) own=true; });
  for(let i=0;i<100&&!own;i++) await sleep(100);
  return own; }
function fremdStop(){ try{ process.kill(fremdPid,'SIGSTOP'); return true; }catch(_){ return false; } }
function fremdEnde(){ for(const p of fremdAlle.splice(0)){ try{ process.kill(p,'SIGCONT'); }catch(_){} try{ process.kill(p,'SIGTERM'); }catch(_){} } fremdPid=0; }
process.on('exit',fremdEnde);
function lies(G){ return new Promise(res=>{ const dir=path.join(__dirname,'fremd-app'), cfg=path.join(process.env.XDG_CONFIG_HOME||__dirname,'fremdR'); fs.mkdirSync(cfg,{recursive:true});
  const pr=spawn3(process.execPath,['--no-sandbox',dir],{env:{...process.env,XDG_CONFIG_HOME:cfg,FREMD_MODE:'read',FREMD_MARK:G,ST_STEP:''},stdio:['ignore','pipe','ignore']});
  let out=''; pr.stdout.on('data',d=>out+=d); const k=setTimeout(()=>{ try{ pr.kill('SIGKILL'); }catch(_){} },8000);
  pr.on('exit',()=>{ clearTimeout(k); const m=out.match(/READ (\{.*\})/); res(m?JSON.parse(m[1]):{fehler:true}); }); }); }
// Vor app.exit auf das ENDE der fremd-app-Prozesse warten (Frist 3 s): Mitglieder der eigenen Prozessgruppe (verify-desktop startet jeden Schritt per setsid) aus /proc
const pgrpM=d=>{ try{ const s=fs.readFileSync('/proc/'+d+'/stat','utf8'), f=s.slice(s.lastIndexOf(')')+2).split(' '); return f[0]==='Z'?-1:Number(f[2]); }catch(_){ return -1; } };
const fremdRestM=()=>{ const pg=pgrpM('self'), r=[]; if(pg<=0) return r;
  for(const d of fs.readdirSync('/proc')){ if(!/^[0-9]+$/.test(d)||Number(d)===process.pid||pgrpM(d)!==pg) continue;
    try{ if(fs.readFileSync('/proc/'+d+'/cmdline','utf8').split(String.fromCharCode(0)).some(x=>x.endsWith(path.sep+'fremd-app'))) r.push(Number(d)); }catch(_){} } return r; };
async function fremdEndeWartM(ms=3000){ fremdEnde(); const t0=Date.now(); let rest=fremdRestM(); while(rest.length&&Date.now()-t0<ms){ await sleep(100); rest=fremdRestM(); }
  R('fremd-app-Prozesse vor dem Ende des Prüfprogramms beendet (Pass run-13 r2a-4)', rest.length===0, {rest:rest.length,ms:Date.now()-t0}); }
// Gemeinsamer Schluss von spiegel/spiegelfeld: Kopie (Strg+C), Klipper-Spiegel per ansprechbarem fremdem Prozess, dann Frist, Strg+L, Beenden
async function spiegelSchluss(wc,G,S,vor){
  strgCM(wc);
  await sleep(600); const rc=()=>Promise.race([clipboard.readText(),sleep(3000).then(()=>'HAENGT')]); const kop0=await rc(); const kop=kop0===S;
  const okQ=await fremdStart(S,'selection','Q'); await sleep(500);
  const r0=await lies(G);
  const tc=Date.now(); await Promise.race([js('AlienDesktop.clip.clear()'),sleep(6000)]); const clearMs=Date.now()-tc; await sleep(2500);
  const r1=await lies(G); const c1r=await rc(); const c1=c1r===S;
  strgL3(wc); await sleep(3000); const r2=await lies(G); const gesperrt=await js(visible('screen-lock'));
  R('Vorbedingungen'+(vor.titel||''), vor.ok&&kop&&okQ&&r0.mark>0, {...vor.info,kop,kopHaengt:kop0==='HAENGT',okQ,spiegelVorher:r0});
  R('Kopie aus CLIPBOARD gelöscht (Frist)', !c1, {c1, eigenesClipboardLesenHaengt:c1r==='HAENGT'});
  R('gespiegelte Kopie in PRIMARY nach dem Löschen (Frist) weg', r1.mark===0, {r1,clearMs});
  R('gespiegelte Kopie in PRIMARY nach Strg+L weg', r2.mark===0, {r2,gesperrt});
  const t0=Date.now();
  app.on('will-quit',ev=>{ ev.preventDefault(); const ms=Date.now()-t0; (async()=>{ const r3=await lies(G);
    R('gespiegelte Kopie in PRIMARY beim Prozessende weg', r3.mark===0, {r3,ms});
    await fremdEndeWartM(); R('Schritt vollständig',true); app.exit(0); })(); });
  app.quit();
}

// [2p]/[2q] Notes run-12 b3-1 (+ r4-1 mit ST_VOR=zitter): Bestandsliste mit Marker-Notizen über zwei Zeilen markiert; ein zweiter Prozess hält PRIMARY und wird
// angehalten; Meldungen (Pfeiltasten) bzw. ein Klick mit 1 px Zittern IN die Markierung; nach Strg+C spiegelt ein ansprechbarer fremder Prozess die Kopie nach
// PRIMARY (wie Klipper) — Frist, Strg+L und Beenden löschen sie trotzdem. PRIMARY wird dabei von AUSSEN gelesen (Lesungen im eigenen Prozess hängen mit).
async function spiegel(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='GEHEIM'+process.pid, F='fremd-haengt-'+process.pid, N=Number(process.env.ST_N||3);
  if(!(await unlockT())){ R('entsperrt',false); fremdEnde(); R('Schritt vollständig',true); app.exit(0); return; }
  const notes=Array.from({length:4},(_,i)=>'Absatz'+i+'-'+G+'-text');
  const da=await buchungenT(notes);
  await ensureFocus();
  // über ALLE vier Marker-Zeilen (Reihenfolge nach Datum): Anfang der im DOM ersten, Ende der letzten Zeile
  // die Notiz steht in der Zelle hinter der Detailangabe („… · Notiz“) im selben Textknoten
  const sp=await js(`(()=>{ const w=document.createTreeWalker(document.querySelector('#list-tbl'),NodeFilter.SHOW_TEXT); let n, f=[]; while((n=w.nextNode())){ const m=n.data.match(/Absatz[0-3]-[A-Za-z0-9]+-text/); if(m) f.push([n,m.index,m[0].length]); }
    if(f.length<4) return null; f[0][0].parentElement.scrollIntoView({block:'center'}); const r=document.createRange(), at=(m,i)=>{ r.setStart(m,i); r.setEnd(m,i+1); const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
    const l=f[f.length-1]; return {a:at(f[0][0],f[0][1]),z:at(l[0],l[1]+l[2]-1)}; })()`);
  if(!sp){ R('Bestandsliste mit vier Marker-Zeilen',false); fremdEnde(); R('Schritt vollständig',true); app.exit(0); return; }
  const a={x:sp.a.x+4,y:sp.a.y}, z={x:sp.z.x-60,y:sp.z.y};
  { mouse('mouseDown',a.x-4,a.y); for(let i=1;i<=8;i++){ mouse('mouseMove',a.x-4+(z.x+60-(a.x-4))*i/8,a.y+(z.y-a.y)*i/8,{mod:['leftButtonDown']}); await sleep(30); } mouse('mouseUp',z.x+60,z.y); }
  // PRIMARY aus einer Tabelle weicht von String(getSelection()) ab (U+FFFC der Knöpfe, Leerraum an Zellgrenzen): angeglichen bzw. über die Markerzahl vergleichen
  await sleep(500); const S=await js(`String(getSelection())`), P0=await prim(), mk=t=>t.split(G).length-1, nz=t=>String(t).replace(/\ufffc/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const pS=nz(P0)===nz(S)||(mk(P0)===mk(S)&&mk(S)>=2);
  const own=await fremdStart(F,'selection'); await sleep(300); const vorF=(await prim())===F; fremdStop(); await sleep(200);
  if(process.env.ST_VOR==='zitter'){ const m=await txtPos('#list-tbl','Absatz1-',false); mouse('mouseDown',m.x+20,m.y); await sleep(40); mouse('mouseMove',m.x+21,m.y,{mod:['leftButtonDown']}); await sleep(40); mouse('mouseUp',m.x+21,m.y); }
  else for(let i=0;i<N;i++){ keyNC3(wc,'Down'); await sleep(40); }
  await sleep(400);
  await spiegelSchluss(wc,G,S,{titel:process.env.ST_VOR==='zitter'?' (Zitter-Klick)':' (Pfeiltasten)',ok:da&&own&&vorF&&pS&&(S.split(G).length-1)>=2,info:{da,own,vorF,pS,sMarker:S.split(G).length-1}});
}

// [2t] Pass run-13 a-1 (c): Feld per Ziehen markiert → Klick auf einen Knopf (Fokus dort, die Feld-Markierung bleibt) → Frist löscht PRIMARY → Klick mit 1 px
// Zittern IN die alte Markierung: die gelöschte Markierung kommt NICHT wieder nach PRIMARY. #f-note und #f-src-btc, Knopf „＋ Kauf“.
async function fokusklick(){
  const wc=win.webContents, mouse=mouseOf2(wc), PW='PWgeheim'+process.pid+'abcdefghijklmnopqrstuvwxyz0123456789', KN=process.env.ST_KNOPF||KNOPF;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  for(const feld of (process.env.ST_FELDER||'f-note,f-src-btc').split(',')){
    await formT('',''); await fill(feld,PW); await sleep(150);
    await js(`(()=>{ const t=document.getElementById('${feld}'); t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); return true; })()`); await sleep(200);
    await clipboard.selection.clear(); await ensureFocus();
    let b=await boxM(feld); await ziehM(mouse,{x:b.l+2,y:b.y},{x:b.l+92,y:b.y},8,30); mouse('mouseUp',b.l+92,b.y); await sleep(500);
    const s1=await fsel(feld), T=s1.v.slice(s1.s,s1.e), p1=await prim();
    const k=await posM(KN,true); await sleep(150); mouse('mouseDown',k.x,k.y); mouse('mouseUp',k.x,k.y); await sleep(400);
    const nachKnopf=await lageM(feld,KN);
    await js('AlienDesktop.clip.clear()'); const weg=await leer3(); await sleep(400);
    await js(`document.getElementById('${feld}').scrollIntoView({block:'center'}); true`); await sleep(150);
    b=await boxM(feld); const m={x:b.l+2+45,y:b.y};
    const vorK=await lageM(feld,KN);
    await klickM(mouse,m,true); await sleep(700);
    const p2=await prim(), s2=await fsel(feld);
    const vorb=T.length>=8&&p1===T&&nachKnopf.kn&&nachKnopf.f[0]===s1.s&&nachKnopf.f[1]===s1.e&&weg&&vorK.f[0]<vorK.f[1];
    R(`#${feld}: markiert, Klick auf „＋ Kauf“, Frist, Klick mit 1 px Zittern IN die alte Markierung: die gelöschte Markierung kommt NICHT wieder nach PRIMARY`, vorb&&!p2.includes(T),
      {vorb,tLen:T.length,p1GleichT:p1===T,nachKnopf,weg,vorK:vorK.f,p2Len:p2.length,p2HatT:p2.includes(T),s2:[s2.s,s2.e,s2.akt]});
    { await js('App.lock(); true'); await sleep(1500); const pL=await prim();
      R(`  #${feld}: danach Sperre: PRIMARY leer`, pL==='', {nachLen:pL.length}); await relock3(); }
    await clipboard.selection.clear();
  }
}

// [2u] Pass run-13 a-1 (a): wie [2p], aber Markierung im Feld #f-note und als Geste ein Klick mit 1 px Zittern auf den Knopf (Fokus wandert, die Feld-Markierung
// bleibt). ST_FVOR=knopf (Vorgabe) | knopfstill | shift (Kontrollen).
async function spiegelfeld(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='GEHEIM'+process.pid, F='fremd-haengt-'+process.pid, KN=process.env.ST_KNOPF||KNOPF, VOR=process.env.ST_FVOR||'knopf';
  if(!(await unlockT())){ R('entsperrt',false); fremdEnde(); R('Schritt vollständig',true); app.exit(0); return; }
  const body=Array.from({length:10},(_,i)=>'Absatz '+i+' '+G+' text.').join(' ');
  await formT(body);
  await js(`(()=>{ const t=document.getElementById('f-note'); t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(200);
  await clipboard.selection.clear(); await ensureFocus();
  const i0=body.indexOf('Absatz 1 '), i1=body.indexOf('Absatz 2 ')+9; const a=await caretXY('f-note',i0), z=await caretXY('f-note',i1);
  await ziehM(mouse,{x:a.x-2,y:a.y},z,8,30); mouse('mouseUp',z.x,z.y); await sleep(600);
  const s=await fsel('f-note'); const S=s.v.slice(s.s,s.e); const pS=(await prim())===S;
  const k=await posM(KN,true); await sleep(150);
  const own=await fremdStart(F,'selection'); await sleep(300); const vorF=(await prim())===F; fremdStop(); await sleep(200);
  if(VOR==='knopf'||VOR==='knopfstill') await klickM(mouse,k,VOR==='knopf'); else keyNC3(wc,'Shift');
  await sleep(400);
  const nachVor=await lageM('f-note',KN);
  const lage=VOR==='shift'?nachVor.akt==='f-note':nachVor.kn&&nachVor.f[0]===s.s&&nachVor.f[1]===s.e;
  await spiegelSchluss(wc,G,S,{titel:' ('+VOR+')',ok:own&&vorF&&pS&&lage,info:{own,vorF,pS,lage,nachVor,sLen:S.length}});
}

// [2v] Pass run-13 a-1 (b): wie [2o] (fremde Auswahl = erstes Wort der Feld-Markierung in #f-note), Geste = Klick auf den Knopf mit/ohne 1 px Zittern, dann
// Löschen (wie Frist). ST_KV=knopf,knopfstill,knopf,knopfhalt (Vorgabe). knopfhalt (v3.12): Taste auf dem Knopf HALTEN, Umschalt drücken, loslassen — ohne
// Mausbewegung, also ohne das Neu-Merken beim ersten mousemove; nur hier unterscheidet sich selKeyAt (Seite UND Felder) vom alten selKey (Mutant selkey-alt).
async function fremdknopf(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='GEHEIM-'+process.pid, KN=process.env.ST_KNOPF||KNOPF;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  const lines=Array.from({length:12},(_,i)=>'Zeile '+i+' '+G+' text').join(' | ');
  for(const v of (process.env.ST_KV||'knopf,knopfstill,knopf,knopfhalt').split(',')){
    await formT(lines);
    await js(`(()=>{ const t=document.getElementById('f-note'); t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(150);
    await clipboard.selection.clear(); await ensureFocus();
    const i0=lines.indexOf('Zeile 1 '), i1=lines.indexOf('Zeile 2 ')+9; const a=await caretXY('f-note',i0), z=await caretXY('f-note',i1);
    await ziehM(mouse,{x:a.x-2,y:a.y},z,8,30); mouse('mouseUp',z.x,z.y); await sleep(600);
    const s=await fsel('f-note'); const S=s.v.slice(s.s,s.e); const pS=(await prim())===S; const F=S.split(' ')[0];
    await clipboard.selection.writeText(F); await sleep(200); const vorF=(await prim())===F;
    const k=await posM(KN,true); await sleep(150);
    if(v==='knopfhalt'){ mouse('mouseDown',k.x,k.y); await sleep(120); keyNC3(wc,'Shift'); await sleep(300); mouse('mouseUp',k.x,k.y); }
    else await klickM(mouse,k,v==='knopf');
    await sleep(600); const nach=await lageM('f-note',KN);
    await js('AlienDesktop.clip.clear()'); await sleep(800); const pEnd=await prim();
    const vorb=pS&&vorF&&F.length>0&&nach.kn&&nach.f[0]===s.s&&nach.f[1]===s.e;
    R(`fremde Auswahl = erstes Wort der Feld-Markierung, Klick auf „＋ Kauf“ ${v==='knopf'?'mit 1 px Zittern':v==='knopfhalt'?'gehalten + Umschalt, ohne Bewegung':'ohne Bewegung'}, Löschen: fremde Auswahl bleibt stehen`, vorb&&pEnd===F,
      {vorb,pS,vorF,nach,Flen:F.length,primNachher:pEnd===F?'fremd':pEnd===''?'leer':'anders'});
    await clipboard.selection.clear();
  }
}

// [2w] Pass run-13 r2a-1 (Rückschritt durch den a-1-Fix allein): Feld B hat eine VERDECKTE Vollmarkierung [0,len] (focus()+select() wie Tab-Fokus/Strg+A), danach
// liegt der Fokus in Feld A (Klick). PRIMARY gelöscht (wie Frist). Dann in B vom Anfang in Stufen bis hinter den Rand ziehen, Maus ruht, Chromium rollt bis ans
// Ende: der Endstand ist wieder [0,len] = der BEIM DRÜCKEN gemerkte Stand von B → ohne Neu-Merken beim ersten mousemove „nicht geändert“, kein reselect.
// Wächter gegen den Rückbau des Nachdrucks (Mutant). ST_GLV=note:feld,cp:feld (B=#f-note mit A=#f-src-btc bzw. B=#cp-cur mit A=#cp1); note:knopf/note:tab sind Kontrollen.
async function gleichfeld(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='E'+process.pid, M='mk-gl-'+process.pid;
  const cnt=t=>(t.match(new RegExp(G,'g'))||[]).length;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  await instM();
  for(const v of (process.env.ST_GLV||'note:feld,cp:feld').split(',')){ const [wo,wie]=v.split(':');
    const feld=wo==='cp'?'cp-cur':'f-note', T=`document.getElementById('${feld}')`, A=process.env.ST_GLA||(wo==='cp'?'cp1':'f-src-btc');
    const val=Array.from({length:Number(process.env.ST_GLN||(wo==='cp'?20:120))},(_,i)=>G+'x'+i).join('-');
    if(wo==='cp') await cpT(val); else await formT(val,'quelle');
    // PRIMARY vorher leeren: das select() per Skript schreibt PRIMARY nicht immer — eine fremde Auswahl (z. B. im Terminal) bliebe stehen, weg0 wäre falsch rot
    await clipboard.selection.clear(); await sleep(150);
    await js(`(()=>{ const t=${T}; t.scrollIntoView({block:'center'}); t.focus(); t.select(); return true; })()`); await sleep(400);
    const s0=await fsel(feld);
    await ensureFocus();
    if(wie==='feld'||wie==='knopf'){ const k=await posM(wie==='feld'?'#'+A:KNOPF,true); await sleep(200); mouse('mouseDown',k.x,k.y); await sleep(60); mouse('mouseUp',k.x,k.y); }
    else if(wie==='tab') keyNC3(wc,'Tab');
    await sleep(500);
    const nach=await lageM(feld), p0=await prim(), vor0={len:p0.length,marker:cnt(p0),gleichFeld:p0===s0.v,quelle:p0==='quelle'};
    await js('AlienDesktop.clip.clear()'); const weg0=await leer3(); await clipboard.selection.writeText(M); await sleep(200);
    await js(`(()=>{ const t=${T}; t.scrollIntoView({block:'center'}); t.scrollLeft=0; return true; })()`); await sleep(250);
    await ensureFocus(); await instM();
    const b=await boxM(feld), a={x:b.l+1,y:b.y};
    let stufen=0, z={x:Math.min(b.R+40,b.iw-12),y:b.y};
    mouse('mouseDown',a.x,a.y); await sleep(60);
    const nachDruck=await fsel(feld);
    for(let i=1;i<=6;i++){ const e0=await js(`${T}.selectionEnd`); mouse('mouseMove',a.x+(b.r-8-a.x)*i/6,a.y,{mod:['leftButtonDown']}); if(await until(`${T}.selectionEnd>${e0}&&${T}.selectionStart===0`,2000)) stufen++; }
    mouse('mouseMove',z.x,a.y,{mod:['leftButtonDown']}); const rollt=await until(`${T}.scrollLeft>0`,3000);
    for(let i=1;i<=6;i++){ mouse('mouseMove',Math.min(z.x+i*2,b.iw-2),a.y+(i%2),{mod:['leftButtonDown']}); await sleep(40); } z={x:Math.min(z.x+12,b.iw-2),y:a.y};
    const ende=await until(`${T}.selectionStart===0&&${T}.selectionEnd===${T}.value.length`,Number(process.env.ST_GLWAIT||30000)); await sleep(400);
    const pR=await prim(), sR=await fsel(feld), selR=sR.v.slice(sR.s,sR.e);
    mouse('mouseUp',z.x,z.y); await sleep(800);
    const ev=await instM();
    const p=await prim(), s=await fsel(feld), sel=s.v.slice(s.s,s.e);
    await js('AlienDesktop.clip.clear()'); const weg=await leer3(); const pW=await prim();
    strgL3(wc); await sleep(1500); const gesperrt=await js(visible('screen-lock')); const pL=await prim();
    const len=s0.v.length;
    const vorb=s0.s===0&&s0.e===len&&nach.akt!==feld&&nach.f[0]===0&&nach.f[1]===len&&weg0&&nachDruck.s===nachDruck.e&&ev.ds===0&&ev.md===1&&ev.mu===1&&ev.mmb>=1
      &&cnt(pR)>0&&pR!==M&&ende&&selR.length===len&&cnt(selR)>cnt(pR)&&s.s===0&&s.e===len;
    R(`#${feld}: verdeckt ganz markiert, Fokus per ${wie} weg, Frist, erneut vom Anfang bis zum Ende gezogen (Nachrollen bis ans Ende): PRIMARY = Endstand, nach Frist und Sperre leer`,
      vorb&&p===sel&&weg&&cnt(pL)===0,
      {vorb,s0:[s0.s,s0.e,len],nach,vor0,weg0,nachDruck:[nachDruck.s,nachDruck.e,nachDruck.akt],box:[Math.round(b.l),Math.round(b.R),b.iw],stufen,rollt,ende,ev,ruhe:{pLen:pR.length,pMarker:cnt(pR),selLen:selR.length,selMarker:cnt(selR)},
       pLen:p.length,pMarker:cnt(p),selLen:sel.length,gleich:p===sel,weg,nachFristMarker:cnt(pW),gesperrt,nachSperreLen:pL.length,nachSperreMarker:cnt(pL)});
    await clipboard.selection.clear(); await relock3();
  }
}

// [2x] Pass run-13 r2a-2: Markieren per Ziehen und — noch bei gedrückter Taste — zurück bis zur leeren Markierung (Abbrechen-Geste). Chromium legt jede nicht
// leere Markierung in PRIMARY und leert PRIMARY nicht, wenn sie zusammenklappt; v3.11 meldete beim Loslassen nur den leeren Endstand (report bricht bei '' ab) →
// der letzte nicht leere Stand blieb nach Frist UND Sperre stehen. Gesten wie im Pass-Fundbericht: Cursor auf 0 + Marker, in 4 Stufen ziehen bis PRIMARY Text hat,
// zurück (in einem Zug zum Anfangspunkt, vor den Feldanfang, oder in 12 Schritten je bis die Markierung geschrumpft ist), warten bis leer, loslassen, Frist, Strg+L.
// ST_ZV=<wo>:<wie>,… (wo: note = #f-note, cp = #cp-cur, zahl = #f-eur (Zahlenfeld, angezeigter Text), liste = Bestandsliste, hbquer = Handbuch über die Grenze
// Überschrift/Absatz (Pass „dquer“: lastText muss String(getSelection()) merken, nicht String(Range)); wie: punkt, aussen, gebunden)
async function zurueck(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='Z'+process.pid, M='mk-zu-'+process.pid;
  const cnt=t=>(t.match(new RegExp(G,'g'))||[]).length;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  await instM();
  const lang=Array.from({length:30},(_,i)=>G+'x'+i).join('-'), zahl='1234567890123'+String(process.pid%1000).padStart(3,'0'), notes=Array.from({length:6},(_,i)=>'Zeile'+i+'-'+G+'-text');
  let gebucht=false;
  for(const v of (process.env.ST_ZV||'note:punkt,note:aussen,note:gebunden,cp:punkt,zahl:aussen,liste:punkt,liste:gebunden,hbquer:punkt').split(',')){ const [wo,wie]=v.split(':');
    let a, z, back, T=null, info={}, num=false;
    if(wo==='liste'){ if(!gebucht){ R('Buchungen mit Marker-Notizen gespeichert', await buchungenT(notes)); gebucht=true; }
      await js(`(()=>{ App.tab('list'); getSelection().removeAllRanges(); return true; })()`); await sleep(300);
      const q=await txtPos('#list-tbl','Zeile2-',true), q2=await txtPos('#list-tbl','Zeile4-',false); if(!q||!q2){ R('liste: Marker-Zeilen gefunden',false); continue; } a={x:q.x-4,y:q.y}; z={x:q2.x+40,y:q2.y}; }
    else if(wo==='hbquer'){ await js(`(()=>{ getSelection().removeAllRanges(); App.openHelp(); return true; })()`); await sleep(400);
      // erste Überschrift mit einem Absatz darunter, auf etwa 200 px gerollt; Ziel im ersten Textknoten des Absatzes mit mindestens 12 Zeichen
      const q=await js(`(()=>{ const o=document.getElementById('help-overlay'); o.scrollTop=0; const h=[...o.querySelectorAll('h2')].find(e=>e.nextElementSibling&&e.nextElementSibling.tagName==='P');
        if(!h) return null; o.scrollTop+=h.getBoundingClientRect().top-200;
        const at=(el,i)=>{ const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())&&n.data.trim().length<12); if(!n) return null; const r=document.createRange(); r.setStart(n,i); r.setEnd(n,i+1); const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
        const pp=at(h.nextElementSibling,8), k=at(h,2); return pp&&k?{p:pp,k}:null; })()`);
      if(!q){ R('hbquer: Überschrift mit Absatz im Handbuch gefunden',false); continue; } a={x:q.p.x+40,y:q.p.y}; z={x:q.k.x+20,y:q.k.y}; }
    else { const feld=wo==='cp'?'cp-cur':wo==='zahl'?'f-eur':'f-note'; num=wo==='zahl'; T=`document.getElementById('${feld}')`;
      if(wo==='cp') await cpT(lang.slice(0,200)); else { await formT(wo==='note'?lang:''); if(num){ await fill('f-eur',zahl); await sleep(150); } }
      await js(`(()=>{ const t=${T}; t.scrollIntoView({block:'center'}); t.focus(); ${num?'':'t.setSelectionRange(0,0);'} t.scrollLeft=0; return true; })()`); await sleep(250);
      if(num){ // Cursor an den Anfang (Zahlenfeld ohne setSelectionRange): Pos1
        keyNC3(wc,'Home'); await sleep(150); }
      const b=await boxM(feld); a={x:b.l+1,y:b.y}; z={x:b.l+150,y:b.y};
      info.box=[Math.round(b.l),Math.round(b.r)]; }
    back=wie==='aussen'?{x:a.x-30,y:a.y}:{x:a.x,y:a.y};
    await clipboard.selection.writeText(M); await ensureFocus(); await instM();
    const L=T&&!num?`(${T}.selectionEnd-${T}.selectionStart)`:'String(getSelection()).length';
    if(wo==='hbquer') await js(`(()=>{ window.__qM={}; if(!window.__qOnM){ window.__qOnM=1; document.addEventListener('mousemove',e=>{ const g=getSelection(); if((e.buttons&1)&&g.rangeCount&&!g.isCollapsed){ const s=String(g), r=String(g.getRangeAt(0)); window.__qM={sel:s.length,rng:r.length,gleich:s===r}; } },true); } return true; })()`);
    mouse('mouseDown',a.x,a.y); await sleep(60); let stufen=0;
    for(let i=1;i<=4;i++){ const l=await js(L); mouse('mouseMove',a.x+(z.x-a.x)*i/4,a.y+(z.y-a.y)*i/4,{mod:['leftButtonDown']}); if(await until(`${L}>${l}`,2000)) stufen++; }
    const geschrieben=await (async()=>{ const t0=Date.now(); while(Date.now()-t0<3000){ const p=await prim(); if(p&&p!==M) return p; await sleep(100); } return await prim(); })();
    const selMitte=await js(L);
    if(wie==='gebunden'){ for(let i=1;i<=12;i++){ const l=await js(L); mouse('mouseMove',z.x+(back.x-z.x)*i/12,z.y+(back.y-z.y)*i/12,{mod:['leftButtonDown']}); await until(`${L}<${l}`,1500); } }
    else mouse('mouseMove',back.x,back.y,{mod:['leftButtonDown']});
    const leer=await until(`${L}===0`,3000); await sleep(300);
    const pVorLos=await prim();
    mouse('mouseUp',back.x,back.y); await sleep(800);
    const ev=await instM();
    const p1=await prim(), l1=await js(L);
    await js('AlienDesktop.clip.clear()'); await sleep(1500); const p2=await prim();
    strgL3(wc); await sleep(1800); const gesperrt=await js(visible('screen-lock')); const p3=await prim();
    // jeder Rest aus dem Markierungstext, auch 1 Zeichen: alles außer leer und dem eigenen Marker M (nur dieser Prozess schreibt PRIMARY)
    const rest=p=>p.length>0&&p!==M;
    if(wo==='hbquer') info.q=await js('window.__qM');
    const q=info.q||{}, querOk=wo!=='hbquer'||(q.sel>0&&q.rng>0&&q.sel!==q.rng&&pVorLos.length===q.sel);
    const quelleOk=wo==='liste'?cnt(geschrieben)>0:wo==='zahl'?zahl.includes(geschrieben.replace(/\D/g,''))&&geschrieben.length>0:wo==='hbquer'?rest(geschrieben):cnt(geschrieben)>0;
    const vorb=quelleOk&&selMitte>0&&leer&&l1===0&&rest(pVorLos)&&ev.ds===0&&ev.md===1&&ev.mu===1&&gesperrt&&querOk;
    R(`${wo==='hbquer'?'Handbuch über die Blockgrenze (Überschrift + Absatz)':wo==='liste'?'Bestandsliste':wo==='zahl'?'#f-eur (Zahlenfeld)':'#'+(wo==='cp'?'cp-cur':'f-note')}: per Ziehen markiert (PRIMARY geschrieben), ${wie==='aussen'?'zurück bis vor den Feldanfang':wie==='gebunden'?'in 12 Schritten zurück, je bis die Markierung geschrumpft ist':'in einem Zug zurück zum Anfangspunkt'}, losgelassen: nach Frist und Sperre kein Markierungstext in PRIMARY`,
      vorb&&!rest(p2)&&!rest(p3),
      {vorb,...info,stufen,mitte:{selLen:selMitte,pLen:geschrieben.length},leer,ev,vorLos:{len:pVorLos.length,rest:rest(pVorLos)},nachLos:{len:p1.length,sel:l1},
       nachFrist:{len:p2.length,rest:rest(p2)},gesperrt,nachSperre:{len:p3.length,rest:rest(p3)}});
    await clipboard.selection.clear(); await relock3();
  }
}

// [2y] Pass run-13 na-1 (Rest des r2a-2-Fixes): vom Anfang in Stufen bis hinter den Rand ziehen, Maus ruht → Chromium rollt nach, PRIMARY hinkt hinterher. Dann bei
// gedrückter Taste in EINEM Zug vor den Feldanfang (30 px links daneben) → Chromium schreibt einen kürzeren Stand nach PRIMARY und rollt bei ruhender Maus ohne
// Eingabeereignis zurück bis zur leeren Markierung. selLast stammt aus dem mousemove-Capture DIESER Bewegung = der nachgerollte Stand, der nie in PRIMARY stand —
// eine Meldung ohne peek passte nie. Lage (vorb): ein eigenes Capture spiegelt selLast — dieser gemerkte Stand muss vom PRIMARY-Stand vor dem Loslassen
// VERSCHIEDEN sein. ST_NZV=note:aussen,cp:aussen (Vorgabe), ST_NZWAIT (ms).
async function zurnach(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='N'+process.pid, M='mk-zn-'+process.pid;
  const cnt=t=>(t.match(new RegExp(G,'g'))||[]).length;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  await instM();
  await js(`(()=>{ window.__znM=null; if(!window.__znOnM){ window.__znOnM=1; let h=false;
    document.addEventListener('mousedown',e=>{ if(e.button===0){ h=true; window.__znM=null; } },true);
    document.addEventListener('mousemove',e=>{ if(!(e.buttons&1)){ h=false; return; } if(!h) return; const a=document.activeElement;
      if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')&&typeof a.selectionStart==='number'&&a.selectionStart!==a.selectionEnd) window.__znM={s:a.selectionStart,e:a.selectionEnd,id:a.id}; },true);
    document.addEventListener('mouseup',e=>{ if(e.button===0) h=false; },true); } return true; })()`);
  for(const v of (process.env.ST_NZV||'note:aussen,cp:aussen').split(',')){ const [wo]=v.split(':');
    const feld=wo==='cp'?'cp-cur':'f-note', T=`document.getElementById('${feld}')`;
    const val=Array.from({length:wo==='cp'?20:120},(_,i)=>G+'x'+i).join('-');
    if(wo==='cp') await cpT(val); else await formT(val);
    await js(`(()=>{ const t=${T}; t.scrollIntoView({block:'center'}); t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(300);
    await clipboard.selection.writeText(M); await sleep(150); await ensureFocus(); await instM();
    const b=await boxM(feld);
    const a={x:b.l+1,y:b.y}; let stufen=0, z={x:Math.min(b.R+40,b.iw-12),y:b.y};
    mouse('mouseDown',a.x,a.y); await sleep(60);
    for(let i=1;i<=6;i++){ const e0=await js(`${T}.selectionEnd`); mouse('mouseMove',a.x+(b.r-8-a.x)*i/6,a.y,{mod:['leftButtonDown']}); if(await until(`${T}.selectionEnd>${e0}&&${T}.selectionStart===0`,2000)) stufen++; }
    mouse('mouseMove',z.x,a.y,{mod:['leftButtonDown']}); const rollt=await until(`${T}.scrollLeft>0`,3000);
    for(let i=1;i<=6;i++){ mouse('mouseMove',Math.min(z.x+i*2,b.iw-2),a.y+(i%2),{mod:['leftButtonDown']}); await sleep(40); } z={x:Math.min(z.x+12,b.iw-2),y:a.y};
    const ende=await until(`${T}.selectionStart===0&&${T}.selectionEnd===${T}.value.length`,Number(process.env.ST_NZWAIT||30000)); await sleep(400);
    const pR=await prim(), sR=await fsel(feld), selR=sR.v.slice(sR.s,sR.e);
    const back={x:b.l-30,y:a.y};
    mouse('mouseMove',back.x,back.y,{mod:['leftButtonDown']}); await sleep(300);
    const sB=await fsel(feld), pB=await prim();
    const leer=await until(`${T}.selectionStart===${T}.selectionEnd`,Number(process.env.ST_NZWAIT||30000)); await sleep(400);
    const pVorLos=await prim(), gm=await js('window.__znM'), gem=gm&&gm.id===feld?sR.v.slice(gm.s,gm.e):'';
    mouse('mouseUp',back.x,back.y); await sleep(800);
    const ev=await instM();
    const p1=await prim(), s1=await fsel(feld);
    await js('AlienDesktop.clip.clear()'); await sleep(1500); const p2=await prim();
    strgL3(wc); await sleep(1800); const gesperrt=await js(visible('screen-lock')); const p3=await prim();
    const rest=p=>p.length>0&&val.includes(p);
    // (Notes prüfte zusätzlich sB.e>sB.s 300 ms nach dem Zug — im breiten Tresor-Feld klappt Chromium bis dahin schon zusammen; dass der Zug einen KÜRZEREN Stand
    // nach PRIMARY schrieb, zeigt pVorLos≠pR mit Rest)
    const vorb=ende&&cnt(pR)>0&&pR!==M&&cnt(selR)>cnt(pR)&&pVorLos!==pR&&leer&&rest(pVorLos)&&gem.length>0&&gem!==pVorLos&&s1.s===s1.e&&ev.ds===0&&ev.md===1&&ev.mu===1&&gesperrt;
    R(`#${feld}: nachgerollt (PRIMARY hinkt), in einem Zug links vor das Feld zurück, Chromium rollt bis zur leeren Markierung, losgelassen: nach Frist und Sperre kein Feldtext in PRIMARY`,
      vorb&&!rest(p2)&&!rest(p3),
      {vorb,box:[Math.round(b.l),Math.round(b.R),b.iw],stufen,rollt,ende,ruhe:{pLen:pR.length,pMarker:cnt(pR),selLen:selR.length,selMarker:cnt(selR)},nachZug:{s:sB.s,e:sB.e,pLen:pB.length,pMarker:cnt(pB)},leer,
       vorLos:{len:pVorLos.length,marker:cnt(pVorLos),rest:rest(pVorLos)},gemerkt:{len:gem.length,marker:cnt(gem),gleichPrim:gem===pVorLos,primAnfang:pVorLos.length>0&&gem.startsWith(pVorLos)},
       ev,nachLos:{len:p1.length,marker:cnt(p1)},nachFrist:{len:p2.length,marker:cnt(p2),rest:rest(p2)},gesperrt,nachSperre:{len:p3.length,marker:cnt(p3),rest:rest(p3)}});
    await clipboard.selection.clear(); await relock3();
  }
}

// [2z] Pass run-13 na-2: die Passphrase in einem Gate-Feld per Ziehen markieren (Chromium schreibt PRIMARY, gemeldet wird erst im mouseup), Taste HALTEN, dann
// Fensterwechsel (blur), Minimieren oder Verstecken. Der blur-Zweig von DESK.onBackground und onHidden leerten das Feld (clearGateInputs), bevor etwas gemeldet war;
// beim Loslassen meldete onSel ''. Varianten (ST_HWV=blur,min,ohne,hide,cpmin,cphide): #lock-pass (Sperrbildschirm, DEK null) blur/minimiert/versteckt, „ohne“ =
// Kontrolle (erst loslassen, dann blur), #cp-cur (Einstellungen, entsperrt; der Tresor sperrt im Hintergrund nicht sofort) minimiert/versteckt. Lage (vorb): beim
// Wegwechseln war die Taste noch gedrückt (kein mouseup davor; „ohne“: genau eins), kein neues Drücken/Ziehen-und-Ablegen danach. Geprüft wird auch PRIMARY DIREKT
// nach dem Wegwechseln (v3.12): gesperrt bzw. aus einem Gate-Feld löscht die App sofort — sonst läge die Passphrase bis zum Loslassen und zur Frist zum Mittelklick
// im anderen Fenster bereit (ohne diese Prüfung blieb der Mutant halt-weg grün: das Loslassen meldet über selLast, die Frist löscht danach).
async function haltweg(){
  const wc=win.webContents, mouse=mouseOf2(wc), G='H'+process.pid, M='mk-hw-'+process.pid;
  const cnt=t=>(t.match(new RegExp(G,'g'))||[]).length;
  if(!(await unlockT())){ R('entsperrt',false); return; }
  await instM();
  const folge=[]; for(const n of ['blur','focus','minimize','restore','hide','show']) win.on(n,()=>folge.push(n));
  for(const wie of (process.env.ST_HWV||'blur,min,ohne,hide,cpmin,cphide').split(',')){
    const cp=wie.startsWith('cp'), fid=cp?'cp-cur':'lock-pass', F=`document.getElementById('${fid}')`, weg=/min/.test(wie)?'min':/hide/.test(wie)?'hide':'blur';
    if(cp){ await relock3(); await js(`App.tab('settings'); true`); await sleep(500); await js(`document.getElementById('cp-cur').scrollIntoView({block:'center'}); true`); await sleep(300); }
    else if(!(await js(visible('screen-lock')))){ await js('App.lock(); true'); await until(visible('screen-lock'),5000); await sleep(500); }
    await ensureFocus();
    const val=Array.from({length:8},(_,i)=>G+'p'+i).join('-');
    await fill(fid,val);
    await js(`(()=>{ const t=${F}; t.focus(); t.setSelectionRange(0,0); t.scrollLeft=0; return true; })()`); await sleep(300);
    await clipboard.selection.writeText(M); await sleep(150); await ensureFocus(); await instM(); folge.length=0;
    const b=await boxM(fid), a={x:b.l+1,y:b.y}, z={x:a.x+Math.min(160,(b.r-b.l)*0.6),y:b.y};
    mouse('mouseDown',a.x,a.y); await sleep(60); let stufen=0;
    for(let i=1;i<=4;i++){ const e0=await js(`${F}.selectionEnd`); mouse('mouseMove',a.x+(z.x-a.x)*i/4,a.y,{mod:['leftButtonDown']}); if(await until(`${F}.selectionEnd>${e0}`,2000)) stufen++; }
    const geschrieben=await (async()=>{ const t0=Date.now(); while(Date.now()-t0<3000){ const p=await prim(); if(cnt(p)>0) return p; await sleep(100); } return await prim(); })();
    const selMitte=await js(`(()=>{ const t=${F}; return t.selectionEnd-t.selectionStart; })()`);
    if(wie==='ohne'){ mouse('mouseUp',z.x,z.y); await sleep(600); }
    const evVor=await instM();
    if(weg==='min'){ win.minimize(); await sleep(1200); }
    else if(weg==='hide'){ win.hide(); await sleep(1200); }
    else { win.blur(); await sleep(1200); }
    const geleert=await js(`${F}.value===''`), pWeg=await prim();
    if(weg==='min') await restoreFocused(); else if(weg==='hide'){ win.show(); await sleep(300); await ensureFocus(); } else { win.focus(); await ensureFocus(); }
    await sleep(400);
    if(wie!=='ohne'){ mouse('mouseUp',z.x,z.y); await sleep(800); }
    const evNach=await instM(), wf=folge.slice();
    const p1=await prim();
    await js('AlienDesktop.clip.clear()'); await sleep(1500); const p2=await prim();
    await relock3(); await sleep(600); const p3=await prim();
    const gehalten=wie==='ohne'?evVor.mu===1:evVor.mu===0;
    const vorb=cnt(geschrieben)>0&&selMitte>0&&geleert&&evVor.md===1&&evVor.ds===0&&gehalten&&evNach.md===0&&evNach.ds===0;
    const wegText=weg==='min'?'Fenster minimiert':weg==='hide'?'Fenster versteckt':'Fensterwechsel (blur)';
    R(`#${fid} per Ziehen markiert, ${wie==='ohne'?'losgelassen, dann Fensterwechsel (Kontrolle)':'Taste gehalten, '+wegText}: danach (Wegwechsel, Frist, Entsperren) keine Passphrase in PRIMARY`,
      vorb&&cnt(pWeg)===0&&cnt(p2)===0&&cnt(p3)===0,
      {vorb,stufen,mitte:{sel:selMitte,pLen:geschrieben.length,pMarker:cnt(geschrieben)},evVor,evNach,folge:wf,geleert,nachWeg:{len:pWeg.length,marker:cnt(pWeg)},
       nachLos:{len:p1.length,marker:cnt(p1)},nachFrist:{len:p2.length,marker:cnt(p2)},nachEntsperren:{len:p3.length,marker:cnt(p3)}});
    await clipboard.selection.clear();
  }
}

app.on('browser-window-created',(_e,w)=>{ if(win) return; win=w;
  w.webContents.once('did-finish-load',async()=>{
    try{
      await until(`document.readyState==='complete'&&typeof App!=='undefined'`,15000); await js('void (window.confirm=()=>true)');   // Rückfragen bestätigen (kein Dialog im Test)
      if(STEP==='fresh') await fresh(); else if(STEP==='restart') await restart(); else if(STEP==='unreadable') await unreadable();
      else if(STEP==='background') await background();
      else if(STEP==='markierung') await markierung();
      else if(STEP==='m311') await m311();
      else if(STEP==='sichern') await sichern();
      else if(STEP==='m312') await m312();
      else if(STEP==='nachrollen') await nachrollen();
      else if(STEP==='markklick') await markklick();
      else if(STEP==='sperrziehen') await sperrziehen();
      else if(STEP==='fremdanfang') await fremdanfang();
      else if(STEP==='spiegel'){ await spiegel(); return; }   // endet in will-quit (eigene Endmarke)
      else if(STEP==='fokusklick') await fokusklick();
      else if(STEP==='spiegelfeld'){ await spiegelfeld(); return; }   // endet in will-quit (eigene Endmarke)
      else if(STEP==='fremdknopf') await fremdknopf();
      else if(STEP==='gleichfeld') await gleichfeld();
      else if(STEP==='zurueck') await zurueck();
      else if(STEP==='zurnach') await zurnach();
      else if(STEP==='haltweg') await haltweg();
      else if(STEP==='quit'||STEP==='quithang'){ await quitStep(STEP==='quithang'); return; }   // endet in will-quit (eigene Endmarke)
      else if(STEP==='quitslow'){ await quitSlow(); return; }
      else if(STEP==='quitreject'){ await quitReject(); return; }
      else if(STEP==='quitlate'){ await quitLate(); return; }
      else if(STEP==='hold'){ R('läuft',true); await sleep(Number(process.env.ST_HOLD||8000)); }
      else R('unbekannter Schritt '+STEP,false);   // vertippter Schrittname wäre sonst mit der Endmarke grün (Pass C-9)
      if(STEP!=='hold') R('Schritt vollständig',true);   // verify-desktop verlangt die Endmarke (Muster Alien Notes v1.7 A-4)
    }catch(e){ R('Ausnahme im Prüfprogramm',false,String(e&&e.stack||e)); }
    app.exit(0);
  });
});
