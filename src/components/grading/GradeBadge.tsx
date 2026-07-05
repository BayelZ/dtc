import React from "react";
import type { Grade } from "@/lib/supabase/types";
import { gradeColor, gradeLabel } from "@/lib/utils";

export const GradeBadge:React.FC<{grade:Grade;size?:"sm"|"md"|"lg";showLabel?:boolean}> = ({grade,size="md",showLabel=false}) => {
  const color=gradeColor(grade); const label=gradeLabel(grade);
  const dim=size==="sm"?28:size==="lg"?56:40; const font=size==="sm"?13:size==="lg"?24:18;
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
      <div style={{width:dim,height:dim,borderRadius:"50%",background:`${color}22`,border:`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{fontSize:font,fontWeight:700,color,lineHeight:1}}>{grade}</span>
      </div>
      {showLabel && <span style={{fontSize:13,color,fontWeight:500}}>{label}</span>}
    </div>
  );
};
