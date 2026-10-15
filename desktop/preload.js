'use strict';
// Sachwert-Tresor Desktop — Brücke zur App. Mehr als diese Aufrufe gibt es nicht; die Seite sieht weder Node noch Pfade.
// Genau sieben Schlüssel (verify-desktop.mjs prüft): clip, store, saveBackup, saveText, savePdf, onLock, onBackground.
const {contextBridge,ipcRenderer}=require('electron');
const sync=(ch,...a)=>{ const r=ipcRenderer.sendSync(ch,...a); if(!r||!r.ok) throw new Error('store'); return r; };

contextBridge.exposeInMainWorld('AlienDesktop',{
  clip:{   // Kopie mit KDE-Hinweis; Kopie und gemeldete Markierung werden nach der Frist, beim Sperren und Beenden gelöscht (nur Eigenes)
    write:o=>ipcRenderer.invoke('clip:write',String(o&&o.text||'')),
    clear:()=>ipcRenderer.invoke('clip:clear'),
    selected:t=>ipcRenderer.invoke('clip:selected',String(t||''))   // markierter Text (X11-Auswahl) → wird mit der Frist mitgelöscht
  },
  store:{   // der Tresor als Datei; synchron wie localStorage, wirft bei jedem Fehler
    read:()=>sync('store:read').data,
    write:s=>{ sync('store:write',String(s)); },
    del:()=>{ sync('store:del'); }
  },
  saveBackup:(name,content)=>ipcRenderer.invoke('backup:save',String(name),String(content)),   // .vault → Dateiname oder null (abgebrochen)
  // Klartext zweistufig (v3.11, wie Alien Notes 1.12): erst der Dialog → Kennung oder null, dann schreibt write nur, solange die App noch offen ist → Dateiname
  saveText:{ pick:name=>ipcRenderer.invoke('export:pick',String(name)),                          // .csv/.txt
             write:(tok,content)=>ipcRenderer.invoke('export:write',String(tok),String(content)) },
  savePdf:{ pick:name=>ipcRenderer.invoke('print:pick',String(name)),                            // Nachlass-Anhang .pdf: die Hülle rendert erst bei write
            write:tok=>ipcRenderer.invoke('print:write',String(tok)) },
  onLock:cb=>{ if(typeof cb==='function') ipcRenderer.on('lock',()=>cb()); },
  onBackground:cb=>{ if(typeof cb==='function') ipcRenderer.on('bg',(_e,h)=>cb(h==='blur'?'blur':!!h)); }   // Fenster minimiert/versteckt (true), zurück (false), Fensterwechsel ('blur': nur Gate-Hygiene, keine Sperre)
});
