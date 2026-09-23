'use strict';
// Sachwert-Tresor Desktop — Brücke zur App. Mehr als diese Aufrufe gibt es nicht; die Seite sieht weder Node noch Pfade.
// Genau sieben Schlüssel (verify-desktop.mjs prüft): clip, store, saveBackup, saveText, savePdf, onLock, onBackground.
const {contextBridge,ipcRenderer}=require('electron');
const sync=(ch,...a)=>{ const r=ipcRenderer.sendSync(ch,...a); if(!r||!r.ok) throw new Error('store'); return r; };

contextBridge.exposeInMainWorld('AlienDesktop',{
  clip:{   // Kopie mit KDE-Hinweis, wird beim Sperren/Beenden gelöscht — nur write/clear (keine Auswahl-Überwachung, s. DESKTOP-INVARIANTEN.md)
    write:o=>ipcRenderer.invoke('clip:write',String(o&&o.text||'')),
    clear:()=>ipcRenderer.invoke('clip:clear')
  },
  store:{   // der Tresor als Datei; synchron wie localStorage, wirft bei jedem Fehler
    read:()=>sync('store:read').data,
    write:s=>{ sync('store:write',String(s)); },
    del:()=>{ sync('store:del'); }
  },
  saveBackup:(name,content)=>ipcRenderer.invoke('backup:save',String(name),String(content)),   // .vault → Dateiname oder null (abgebrochen)
  saveText:(name,content)=>ipcRenderer.invoke('export:save',String(name),String(content)),     // .csv/.txt (Klartext) → Dateiname oder null
  savePdf:name=>ipcRenderer.invoke('print:pdf',String(name)),                                    // Nachlass-Anhang: Seite mit Druck-CSS → .pdf
  onLock:cb=>{ if(typeof cb==='function') ipcRenderer.on('lock',()=>cb()); },
  onBackground:cb=>{ if(typeof cb==='function') ipcRenderer.on('bg',(_e,h)=>cb(h==='blur'?'blur':!!h)); }   // Fenster minimiert/versteckt (true), zurück (false), Fensterwechsel ('blur': nur Gate-Hygiene, keine Sperre)
});
