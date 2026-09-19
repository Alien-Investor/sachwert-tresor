// Roundtrip-Test: bildet die exakte App-Krypto + Merge-Logik nach (Node WebCrypto).
// Beweist: Export -> .vault-Datei -> Import auf anderem Gerät ist verlustfrei,
// und der Import-Sanitizer weist präparierte Einträge ab.
// Sample-Einträge nutzen das ECHTE App-Schema (btc/source/fineness/grams …).
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
const ITER = 600000;

// Versionsanzeige (Einstellungen) muss zur Datei VERSION passen — sonst zeigt die App eine alte Nummer
{ const {readFileSync}=await import('node:fs');
  const vn=(readFileSync('VERSION','utf8').match(/^VERSION_NAME=(.+)$/m)||[])[1]?.trim();
  const av=(readFileSync('app.js','utf8').match(/^const APP_VERSION = '([^']*)';/m)||[])[1];
  if(!vn||av!==vn) throw new Error(`APP_VERSION (${av}) != VERSION_NAME (${vn})`);
  console.log('  ✓ APP_VERSION', av, '= VERSION_NAME'); }

const bufToB64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');
const b64ToBuf = b64 => Uint8Array.from(Buffer.from(b64, 'base64')).buffer;

async function deriveKey(pass, salt){
  const base = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptObj(obj, key){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(JSON.stringify(obj)));
  return {iv:bufToB64(iv), ct:bufToB64(ct)};
}
async function decryptBlob(blob, key){
  const pt = await subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b64ToBuf(blob.iv))}, key, b64ToBuf(blob.ct));
  return JSON.parse(dec.decode(pt));
}
// persist(): wie in index.html – blob + magic/kdf/iter/salt
async function persistBlob(vault, key, salt){
  const blob = await encryptObj(vault, key);
  blob.magic='AISV1'; blob.kdf='PBKDF2-SHA256'; blob.iter=ITER; blob.salt=bufToB64(salt);
  return JSON.stringify(blob); // == Inhalt der .vault-Datei
}
// sanitizeEntry + mergeEntries: 1:1 wie in index.html (Import-Härtung)
function sanitizeEntry(e){
  if(!e || typeof e!=='object') return null;
  if(typeof e.id!=='string' || !/^[0-9a-f]{1,64}$/i.test(e.id)) return null;
  if(['btc','gold','silver'].indexOf(e.type)<0) return null;
  const dir = e.dir==null ? 'buy' : e.dir;
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
function mergeEntries(local, incoming){
  const byId=new Map(local.map(e=>[e.id,e]));
  let added=0;
  for(const raw of (incoming||[])){ const e=sanitizeEntry(raw); if(e&&!byId.has(e.id)){ byId.set(e.id,e); added++; } }
  return {entries:Array.from(byId.values()), added};
}
// sanitizeSnaps + mergeSnaps: 1:1 wie in app.js (Preisstände aus fremden .vault-Dateien, v2.12)
const PRICE_HIST_MAX=2000;
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const dayT = d => Date.parse(d+'T12:00:00Z');
const isoOf = ts => new Date(ts).toISOString().slice(0,10);
function validDay(d){
  if(typeof d!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t=dayT(d);
  return isFinite(t) && isoOf(t)===d;
}
const notFuture = d => validDay(d) && d<=todayStr();
function sanitizeSnaps(arr){
  if(!Array.isArray(arr)) return [];
  const num=v=>{const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)&&n>0?String(n):'';};
  const out=[];
  for(const r of arr){
    if(!r||typeof r!=='object') continue;
    if(!notFuture(r.d)) continue;
    const sn={d:r.d, btc:num(r.btc), gold:num(r.gold), silver:num(r.silver)};
    if(!sn.btc&&!sn.gold&&!sn.silver) continue;
    out.push(sn);
  }
  return out;
}
function mergeSnaps(local, incoming){
  const byDay=new Map(sanitizeSnaps(local).map(sn=>[sn.d,sn]));
  for(const sn of sanitizeSnaps(incoming)) if(!byDay.has(sn.d)) byDay.set(sn.d,sn);
  return Array.from(byDay.values()).sort((a,b)=>a.d.localeCompare(b.d)).slice(-PRICE_HIST_MAX);
}

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FEHLER:',m);} };

// Realistische Beispiel-Einträge im ECHTEN App-Schema (wie App.addEntry sie erzeugt)
const sampleEntries = [
  {id:'a1', type:'btc',    dir:'buy',      date:'2025-01-15', eur:2500, note:'', btc:0.04210000, source:'Bisq',        kyc:false},
  {id:'a2', type:'btc',    dir:'sell',     date:'2025-06-01', eur:900,  note:'', btc:0.01000000, source:'Kraken',      noKyc:false},
  {id:'a3', type:'btc',    dir:'withdraw', date:'2025-07-02', eur:0,    note:'', btc:0.00500000, source:'Cold Wallet'},
  {id:'a4', type:'gold',   dir:'buy',      date:'2025-02-10', eur:3800, note:'', count:2, qty:1, unit:'oz', grams:62.206954, form:'Münze', fineness:999.9, source:'Degussa'},
  {id:'a5', type:'silver', dir:'buy',      date:'2025-03-05', eur:950,  note:'', count:1, qty:1, unit:'kg', grams:1000,      form:'Barren', fineness:999,   source:'ESG'},
];

async function main(){
  console.log('=== Test 1: Crypto-Roundtrip (Export -> Datei -> Import, gleiche Passphrase) ===');
  const passA='korrekt-pferd-batterie-klammer';
  const saltA=crypto.getRandomValues(new Uint8Array(16));
  const keyA=await deriveKey(passA, saltA);
  const vaultA={version:1, entries:sampleEntries, totp:{enabled:true,secret:'JBSWY3DPEHPK3PXP'}, prices:{btc:'90000',gold:'',silver:''}, unit:'oz', autolock:5};
  const file=await persistBlob(vaultA, keyA, saltA);
  // anderes Gerät: gleiche Passphrase, Salt kommt aus der Datei
  const blob=JSON.parse(file);
  const keyImport=await deriveKey(passA, new Uint8Array(b64ToBuf(blob.salt)));
  const decrypted=await decryptBlob(blob, keyImport);
  ok(JSON.stringify(decrypted.entries)===JSON.stringify(sampleEntries), 'alle 5 Einträge bit-genau wiederhergestellt');
  ok(decrypted.entries[0].btc===0.0421, 'BTC-Nachkommastellen erhalten (0.0421)');
  ok(decrypted.entries[3].fineness===999.9 && decrypted.entries[3].count===2 && decrypted.entries[3].grams===62.206954, 'Metall-Feinheit, Stückzahl & Gramm erhalten');
  ok(decrypted.totp.secret==='JBSWY3DPEHPK3PXP', 'TOTP-Secret erhalten');
  ok(blob.magic==='AISV1'&&blob.iter===ITER, 'Datei-Header korrekt (magic/iter)');

  console.log('\n=== Test 2: Falsche Passphrase wird abgewiesen ===');
  try{ const kBad=await deriveKey('falsch', new Uint8Array(b64ToBuf(blob.salt))); await decryptBlob(blob,kBad); ok(false,'falsche Passphrase hätte fehlschlagen müssen'); }
  catch(e){ ok(true,'falsche Passphrase -> Entschlüsselung schlägt fehl (GCM-Auth)'); }

  console.log('\n=== Test 3: Merge auf Zweitgerät (additiv per id, sanitisiert) ===');
  // Gerät B hat eigene, abweichende Passphrase + teils eigene Einträge
  const local=[ sampleEntries[0], {id:'b9', type:'btc', dir:'buy', date:'2025-08-01', eur:700, note:'', btc:0.01, source:'Geschenk', kyc:false} ];
  const {entries, added}=mergeEntries(local, decrypted.entries);
  ok(added===4, `4 neue Einträge übernommen (a2..a5), a1 als Dublette übersprungen — added=${added}`);
  ok(entries.length===6, `Gesamt 6 Einträge (b9 lokal bleibt) — len=${entries.length}`);
  ok(entries.some(e=>e.id==='b9'), 'lokaler Eintrag b9 bleibt erhalten');
  const a4m=entries.find(e=>e.id==='a4');
  ok(a4m && a4m.grams===62.206954 && a4m.form==='Münze' && a4m.unit==='oz', 'Metall-Eintrag übersteht den Sanitizer unverändert');

  console.log('\n=== Test 4: Bekannte Grenze — Edit synct NICHT (additiver Merge) ===');
  const edited=sampleEntries.map(e=>e.id==='a1'?{...e, btc:0.99999999, eur:99999}:e);
  const localWithA1=[ sampleEntries[0] ]; // hat a1 mit Originalbetrag
  const m=mergeEntries(localWithA1, edited);
  const a1after=m.entries.find(e=>e.id==='a1');
  ok(a1after.btc===0.0421, 'a1 behält Originalbetrag — Edit wurde NICHT übernommen (dokumentierte Grenze)');

  console.log('\n=== Test 5: Idempotenz — zweiter Import derselben Datei ändert nichts ===');
  const again=mergeEntries(entries, decrypted.entries);
  ok(again.added===0 && again.entries.length===6, 'erneuter Import: 0 neu, Bestand stabil');

  console.log('\n=== Test 6: Import-Härtung — präparierte .vault-Einträge werden abgewiesen ===');
  const evil=[
    {id:"x') || App.wipeLocal() || ('", type:'btc', dir:'buy', date:'2025-01-01', eur:1, btc:0.1},   // id-Injection in onclick
    {id:'ee01', type:'btc', dir:'buy', date:'<img src=x onerror=alert(1)>', eur:1, btc:0.1},          // HTML im Datum
    {id:'ee02', type:'<script>', dir:'buy', date:'2025-01-01', eur:1, btc:0.1},                       // Typ außerhalb Whitelist
    {id:'ee03', type:'btc', dir:'exfil', date:'2025-01-01', eur:1, btc:0.1},                          // Richtung außerhalb Whitelist
    {id:'ee04', type:'btc', dir:'buy', date:'2025-01-01', eur:1, btc:-5},                             // negative Menge
    {id:'ee05', type:'gold', dir:'buy', date:'2025-01-01', eur:1, qty:1, unit:'oz'},                  // Metall ohne grams
  ];
  const rEvil=mergeEntries([], evil);
  ok(rEvil.added===0, `alle 6 präparierten Einträge abgewiesen — added=${rEvil.added}`);
  const long={id:'ee10', type:'btc', dir:'buy', date:'2025-01-01', eur:1, btc:0.1, note:'N'.repeat(9999), source:'S'.repeat(9999), extra:'wird verworfen'};
  const rLong=mergeEntries([], [long]);
  ok(rLong.added===1 && rLong.entries[0].note.length===500 && rLong.entries[0].source.length===200, 'Überlange Strings werden gekappt (note 500, source 200)');
  ok(!('extra' in rLong.entries[0]), 'unbekannte Felder werden verworfen (Whitelist)');
  const legacy={id:'ee11', type:'btc', date:'2024-05-05', eur:100, btc:0.002, source:'Altbestand'};   // Altdaten ohne dir
  const rLeg=mergeEntries([], [legacy]);
  ok(rLeg.added===1 && rLeg.entries[0].dir==='buy', 'Altdaten ohne dir werden als Kauf übernommen');

  console.log('\n=== Test 7: Mehrwährung (cur/eurRef) — Whitelist + Normalisierung ===');
  const fx=[
    {id:'cc01', type:'btc', dir:'buy', date:'2026-07-01', eur:500, cur:'USD', eurRef:462.5, btc:0.005},   // sauberer USD-Kauf mit EUR-Gegenwert
    {id:'cc02', type:'gold', dir:'buy', date:'2026-07-02', eur:900, cur:'CHF', count:1, qty:1, unit:'oz', grams:31.1034768}, // CHF ohne eurRef
    {id:'cc03', type:'btc', dir:'buy', date:'2026-07-03', eur:100, cur:'JPY', btc:0.001},                 // Währung außerhalb Whitelist
    {id:'cc04', type:'btc', dir:'buy', date:'2026-07-04', eur:100, cur:'<script>', btc:0.001},            // Injection statt Währung
    {id:'cc05', type:'btc', dir:'buy', date:'2026-07-05', eur:100, cur:'EUR', eurRef:99, btc:0.001},      // eurRef bei EUR ist sinnlos
    {id:'cc06', type:'btc', dir:'buy', date:'2026-07-06', eur:100, cur:'USD', eurRef:'evil', btc:0.001},  // eurRef kein Betrag
  ];
  const rFx=mergeEntries([], fx);
  ok(rFx.added===6, `alle 6 Einträge übernommen (Währung wird normalisiert, nie abgewiesen) — added=${rFx.added}`);
  const g=id=>rFx.entries.find(e=>e.id===id);
  ok(g('cc01').cur==='USD' && g('cc01').eurRef===462.5, 'USD + EUR-Gegenwert bleiben erhalten');
  ok(g('cc02').cur==='CHF' && !('eurRef' in g('cc02')), 'CHF ohne eurRef bleibt ohne eurRef');
  ok(g('cc03').cur==='EUR' && g('cc04').cur==='EUR', 'unbekannte/böse Währung wird auf EUR normalisiert');
  ok(!('eurRef' in g('cc05')), 'eurRef bei EUR-Buchung wird verworfen');
  ok(!('eurRef' in g('cc06')), 'nicht-numerischer eurRef wird verworfen');
  const legacyCur={id:'cc07', type:'btc', dir:'buy', date:'2024-01-01', eur:100, btc:0.001};              // Altdaten ohne cur
  const rLC=mergeEntries([], [legacyCur]);
  ok(rLC.entries[0].cur==='EUR', 'Altdaten ohne cur werden als EUR übernommen');

  console.log('\n[8] Preisstände aus einer importierten .vault (sanitizeSnaps/mergeSnaps, v2.12)');
  const badDays=mergeSnaps([], [
    {d:'9999-99-99', btc:'1'},                                    // Form stimmt, Datum existiert nicht -> NaN im Chart
    {d:'2026-02-30', btc:'1'},                                    // 30. Februar
    {d:'9999-12-31', btc:'5000000'},                              // gültig, aber Zukunft -> bliebe fuer immer der letzte Punkt
    {d:'0000-00-00', btc:'1'},
  ]);
  ok(badDays.length===0, `unsinnige und zukuenftige Datumsangaben werden verworfen (sind ${badDays.length})`);
  const snaps=mergeSnaps([], [
    {d:'2026-01-02', btc:'58000', gold:'82.5', silver:'0.95'},   // gültig
    {d:'2026-01-03', btc:58000},                                  // Zahl statt String ist erlaubt
    {d:'02.01.2026', btc:'58000'},                                // falsches Datumsformat
    {d:'2026-01-04'},                                             // kein einziger Preis
    {d:'2026-01-05', btc:'-5', gold:'abc'},                       // unbrauchbare Zahlen
    {d:'2026-01-06', btc:'<script>alert(1)</script>'},            // Injection statt Zahl
    'kaputt', null, 42,                                           // gar keine Objekte
  ]);
  ok(snaps.length===2, `nur die zwei brauchbaren Stände übernommen (sind ${snaps.length})`);
  ok(snaps[0].d==='2026-01-02' && snaps[0].btc==='58000' && snaps[0].gold==='82.5', 'gültiger Stand bleibt vollständig');
  ok(snaps[1].btc==='58000' && typeof snaps[1].btc==='string', 'Zahl wird als String normalisiert');
  ok(!snaps.some(s=>/script/.test(s.btc+s.gold+s.silver)), 'kein Injection-String überlebt die Whitelist');
  const mine=[{d:'2026-01-02', btc:'60000', gold:'', silver:''}];
  const merged=mergeSnaps(mine, [{d:'2026-01-02', btc:'58000'}, {d:'2026-01-09', btc:'61000'}]);
  ok(merged.length===2 && merged[0].btc==='60000', 'bei gleichem Tag gewinnt der lokale Stand');
  ok(merged[1].d==='2026-01-09', 'neuer Tag aus der Fremddatei kommt dazu');
  ok(merged[0].d < merged[1].d, 'Ergebnis ist nach Datum sortiert');
  const many=Array.from({length:PRICE_HIST_MAX+50},(_,i)=>({d:'20'+String(10+Math.floor(i/365)).padStart(2,'0')+'-01-01', btc:String(1000+i)}));
  ok(mergeSnaps([], many).length<=PRICE_HIST_MAX, 'Deckel PRICE_HIST_MAX greift');

  console.log(`\n=== Ergebnis: ${pass} OK, ${fail} Fehler ===`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error('CRASH',e);process.exit(2);});
