import React from "react";
const SPECIALTY_COLORS:Record<string,[string,string,string]>={ Diesel:["color-mix(in srgb, var(--gold) 14%, var(--bg))","var(--gold)","color-mix(in srgb, var(--gold) 35%, var(--bg))"], Automotive:["color-mix(in srgb, var(--info) 14%, var(--bg))","var(--info)","color-mix(in srgb, var(--info) 35%, var(--bg))"], Both:["var(--good-bg)","var(--good)","var(--good-border)"] };
const DIFFICULTY_COLORS:Record<string,[string,string,string]>={ Easy:["var(--good-bg)","var(--good)","var(--good-border)"], Medium:["color-mix(in srgb, var(--gold) 14%, var(--bg))","var(--gold)","color-mix(in srgb, var(--gold) 35%, var(--bg))"], Hard:["var(--bad-bg)","var(--bad)","var(--bad-border)"] };
export const Badge:React.FC<{label:string;variant?:"specialty"|"difficulty"|"custom";style?:React.CSSProperties}> = ({label,variant="custom",style}) => {
  let bg="var(--accent-tint)",color="var(--accent-hi)",border="color-mix(in srgb, var(--accent) 35%, var(--bg))";
  if (variant==="specialty") [bg,color,border]=SPECIALTY_COLORS[label]??[bg,color,border];
  if (variant==="difficulty") [bg,color,border]=DIFFICULTY_COLORS[label]??[bg,color,border];
  return <span style={{background:bg,color,border:`0.5px solid ${border}`,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:5,display:"inline-block",whiteSpace:"nowrap",...style}}>{label}</span>;
};
