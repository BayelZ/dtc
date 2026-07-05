import React from "react";
import { xpToNextTier, tierIcon, tierColors, formatXP } from "@/lib/utils";

export const TierProgress:React.FC<{xp:number;showLabel?:boolean}> = ({xp,showLabel=true}) => {
  const { next, needed, progress } = xpToNextTier(xp);
  const { color } = tierColors(next);
  const isMaster = needed===0;
  return (
    <div>
      {showLabel && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:12,color:"#888"}}>{isMaster?"Max tier reached":`Next: ${tierIcon(next)} ${next}`}</span>
          {!isMaster && <span style={{fontSize:12,color:"#888"}}>{formatXP(needed)} XP to go</span>}
        </div>
      )}
      <div style={{height:6,background:"#2e2e2e",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:6,width:`${isMaster?100:progress}%`,background:color,borderRadius:3,transition:"width 0.6s ease"}} />
      </div>
      {showLabel && !isMaster && <div style={{marginTop:4}}><span style={{fontSize:10,color:"#555"}}>{progress}% complete</span></div>}
    </div>
  );
};
