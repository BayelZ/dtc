import React, { useState } from "react";
import { THEMES, applyTheme, getStoredThemeId } from "@/lib/themes";

// Shown on the user's own profile. Theme choice is per-device (localStorage);
// the boot script in _document.tsx re-applies it before first paint.
export const ThemePicker:React.FC = () => {
  const [selected,setSelected]=useState(getStoredThemeId);

  const pick=(id:string)=>{ applyTheme(id); setSelected(id); };

  return (
    <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"16px 18px",marginBottom:18}}>
      <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:12}}>Paint</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {THEMES.map(t=>{
          const active=t.id===selected;
          return (
            <button key={t.id} onClick={()=>pick(t.id)} title={t.blurb}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:t.swatch.bg,
                border:active?"2px solid var(--accent)":"1px solid var(--border)",borderRadius:8,cursor:"pointer",
                outlineOffset:2,boxShadow:active?"0 0 0 1px var(--bg)":"none"}}>
              <span aria-hidden style={{display:"inline-flex",gap:3}}>
                <span style={{width:12,height:12,borderRadius:3,background:t.swatch.card,border:"1px solid rgba(128,128,128,.35)"}} />
                <span style={{width:12,height:12,borderRadius:3,background:t.swatch.accent}} />
              </span>
              <span style={{fontSize:12,fontWeight:active?700:500,color:t.swatch.text}}>{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
