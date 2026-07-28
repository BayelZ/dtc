import React from "react";
import { Sticker } from "@/components/gear/Sticker";
import type { StickerKind, StickerRarity } from "@/lib/supabase/types";

// One catalog entry as the UI needs it. Satisfied by the /api/gear response and by the local
// prototype catalog on /gear-pilot, so this view is shared by both.
export interface GearItem {
  slug:string; name:string; requirement:string;
  kind:StickerKind; rarity:StickerRarity; legend:string; color:string;
  unlocked:boolean;
  /** 0..1, optional — only the prototype computes this today (rules stay server-side). */
  progress?:number;
}

// Grid: comfortable cards on desktop, two-up on phones. A single column on mobile turned
// twelve decals into endless scrolling, and a decal card doesn't need to be 340px wide.
const GEAR_CSS = `
.gear-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
@media (max-width:640px){
  .gear-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .gear-card{padding:12px 8px 10px !important}
  .gear-card-name{font-size:12.5px !important}
  .gear-req{font-size:10.5px !important}
}
`;

const RARITY: Record<StickerRarity, { label:string; color:string }> = {
  standard: { label:"Standard", color:"var(--text-faint)" },
  earned:   { label:"Earned",   color:"var(--info)" },
  rare:     { label:"Rare",     color:"var(--gold)" },
};

export const GearPage:React.FC<{
  items:GearItem[]; equipped:string[]; maxEquipped:number;
  onToggle:(slug:string)=>void; loading?:boolean; error?:string|null; saving?:boolean;
}> = ({items,equipped,maxEquipped,onToggle,loading,error,saving}) => {
  const unlockedCount = items.filter(i=>i.unlocked).length;
  const full = equipped.length>=maxEquipped;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <style>{GEAR_CSS}</style>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Gear</h1>
      <p style={{fontSize:13,color:"var(--text-muted)",margin:"0 0 6px"}}>
        Decals for your profile. Every one is earned — nothing here costs XP, so decorating never
        moves your rank.
      </p>
      <p style={{fontSize:12.5,color:"var(--text-faint)",margin:"0 0 1.5rem"}}>
        {unlockedCount} of {items.length} unlocked · {equipped.length}/{maxEquipped} on your box
        {full && <span style={{color:"var(--gold)"}}> · box full, remove one to swap</span>}
        {saving && <span style={{color:"var(--text-faint)"}}> · saving…</span>}
      </p>

      {error && <p style={{fontSize:13,color:"var(--bad)",margin:"0 0 14px"}}>{error}</p>}
      {loading && items.length===0 && <p style={{color:"var(--text-muted)"}}>Loading gear…</p>}

      <div className="gear-grid">
        {items.map(s=>{
          const on=equipped.includes(s.slug);
          const r=RARITY[s.rarity]??RARITY.standard;
          const pct=s.progress!=null?Math.round(s.progress*100):null;
          return (
            <div key={s.slug} className="gear-card"
              style={{background:"var(--bg-card)",borderRadius:10,padding:"16px 14px 14px",
                border:`0.5px solid ${on?"var(--accent)":"var(--border)"}`,
                display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
              <Sticker sticker={s} size={78} locked={!s.unlocked} />
              <div style={{textAlign:"center"}}>
                <div className="gear-card-name" style={{fontSize:13.5,fontWeight:600,color:s.unlocked?"var(--text)":"var(--text-muted)"}}>{s.name}</div>
                <div style={{fontSize:9.5,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:r.color,marginTop:3}}>{r.label}</div>
              </div>

              {s.unlocked ? (
                <button onClick={()=>onToggle(s.slug)} disabled={(!on&&full)||saving}
                  style={{marginTop:"auto",width:"100%",padding:"7px 10px",borderRadius:6,
                    font:"inherit",fontSize:12.5,fontWeight:600,
                    cursor:(!on&&full)||saving?"not-allowed":"pointer",
                    background:on?"var(--accent)":"var(--bg-raised)",
                    color:on?"var(--accent-contrast)":"var(--text)",
                    border:on?"none":"0.5px solid var(--border)",
                    opacity:(!on&&full)||saving?0.45:1}}>
                  {on?"On your box ✓":full?"Box full":"Put on box"}
                </button>
              ) : (
                <div style={{marginTop:"auto",width:"100%"}}>
                  <p className="gear-req" style={{fontSize:11.5,color:"var(--text-faint)",margin:"0 0 7px",lineHeight:1.45,textAlign:"center"}}>
                    {s.requirement}
                  </p>
                  {pct!=null && pct>0 && pct<100 && (
                    <div style={{height:4,background:"var(--bg-raised)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:4,width:`${pct}%`,background:"var(--accent)",opacity:0.65}} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
