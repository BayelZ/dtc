import React from "react";
import { Sticker, type StickerDef } from "./Sticker";

// The decal strip along the bottom of the profile/bio card. Deliberately a bounded strip rather
// than free placement over the card: this panel is also the candidate view a shop owner reads,
// so decals must never land on top of the name, tier or bio.
//
// `art` is the catalog (from /api/gear, or the local catalog on /gear-pilot) — the strip only
// renders slugs it can find art for, so a decal removed from the catalog degrades to nothing
// rather than crashing.
export const StickerStrip:React.FC<{
  slugs:string[]; art:StickerDef[]; isOwnProfile?:boolean; onCustomize?:()=>void;
}> = ({slugs,art,isOwnProfile,onCustomize}) => {
  const byId=new Map(art.map(a=>[a.slug,a]));
  const stickers=slugs.map(s=>byId.get(s)).filter((s):s is StickerDef=>!!s);
  if (stickers.length===0 && !isOwnProfile) return null;

  return (
    <div style={{position:"relative",marginTop:18,paddingTop:14,
      borderTop:"0.5px dashed var(--border)",display:"flex",
      alignItems:"center",gap:14,flexWrap:"wrap",minHeight:46}}>
      {stickers.length>0 ? (
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {stickers.map(s=>(
            <span key={s.slug} title={s.name}><Sticker sticker={s} size={52} /></span>
          ))}
        </div>
      ) : (
        <span style={{fontSize:12.5,color:"var(--text-faint)"}}>
          No decals on the box yet — earn them by working cases.
        </span>
      )}
      {isOwnProfile && onCustomize && (
        <button onClick={onCustomize}
          style={{marginLeft:"auto",background:"none",border:"0.5px solid var(--border)",
            borderRadius:6,color:"var(--text-muted)",font:"inherit",fontSize:12,
            padding:"5px 11px",cursor:"pointer",whiteSpace:"nowrap"}}>
          Gear ›
        </button>
      )}
    </div>
  );
};
