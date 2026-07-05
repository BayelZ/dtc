import React from "react";
import type { Tier } from "@/lib/supabase/types";
import { tierIcon, tierColors } from "@/lib/utils";

export const TierBadge:React.FC<{tier:Tier;size?:"sm"|"md"|"lg";showLabel?:boolean;animated?:boolean}> = ({tier,size="md",showLabel=false,animated=false}) => {
  const {bg,color,border}=tierColors(tier); const icon=tierIcon(tier);
  const pad=size==="sm"?"2px 8px":size==="lg"?"6px 14px":"3px 10px";
  const font=size==="sm"?11:size==="lg"?15:12; const iconSz=size==="sm"?12:size==="lg"?20:14;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:pad,background:bg,border:`0.5px solid ${border}`,borderRadius:20,animation:animated?"tierPulse 1s ease 3":undefined}}>
      <span style={{fontSize:iconSz}}>{icon}</span>
      {showLabel && <span style={{fontSize:font,fontWeight:600,color}}>{tier}</span>}
    </span>
  );
};
