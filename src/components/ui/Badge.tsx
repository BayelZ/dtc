import React from "react";
const SPECIALTY_COLORS:Record<string,[string,string,string]>={ Diesel:["#2a2010","#e6b84a","#5a4010"], Automotive:["#0f1e2e","#5aade6","#1a3a5a"], Both:["#1a2e1a","#6fcf6f","#2d5a2d"] };
const DIFFICULTY_COLORS:Record<string,[string,string,string]>={ Easy:["#1a2e1a","#6fcf6f","#2d5a2d"], Medium:["#2a2010","#e6b84a","#5a4010"], Hard:["#2e1a1a","#ff7070","#5a2d2d"] };
export const Badge:React.FC<{label:string;variant?:"specialty"|"difficulty"|"custom";style?:React.CSSProperties}> = ({label,variant="custom",style}) => {
  let bg="#2a1a12",color="#ff7a45",border="#5a2e12";
  if (variant==="specialty") [bg,color,border]=SPECIALTY_COLORS[label]??[bg,color,border];
  if (variant==="difficulty") [bg,color,border]=DIFFICULTY_COLORS[label]??[bg,color,border];
  return <span style={{background:bg,color,border:`0.5px solid ${border}`,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:5,display:"inline-block",whiteSpace:"nowrap",...style}}>{label}</span>;
};
