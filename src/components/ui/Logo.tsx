import React from "react";
export const Logo:React.FC<{size?:"sm"|"md"|"lg"}> = ({size="md"}) => {
  const dim=size==="sm"?28:size==="lg"?52:40, font=size==="sm"?13:size==="lg"?24:20, title=size==="sm"?14:size==="lg"?22:18;
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:dim,height:dim,background:"#E85D24",borderRadius:Math.round(dim/4),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#fff",fontSize:font,fontWeight:700}}>D</span></div>
      <div><div style={{fontSize:title,fontWeight:500,color:"#f0f0f0",letterSpacing:1}}>DTC</div>{size!=="sm"&&<div style={{fontSize:11,color:"#888",letterSpacing:2,textTransform:"uppercase"}}>Diag Tech Challenge</div>}</div>
    </div>
  );
};
