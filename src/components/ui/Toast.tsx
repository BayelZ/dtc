import React, { useEffect, useState } from "react";
export type ToastType="success"|"warning"|"error";
const STYLES:Record<ToastType,{bg:string;border:string;color:string}>={ success:{bg:"#1a2e1a",border:"#2d5a2d",color:"#6fcf6f"}, warning:{bg:"#2a2010",border:"#5a4010",color:"#e6b84a"}, error:{bg:"#2e1a1a",border:"#5a2d2d",color:"#ff7070"} };
export const Toast:React.FC<{message:string;type?:ToastType;duration?:number;onDone?:()=>void}> = ({message,type="success",duration=3000,onDone}) => {
  const [visible,setVisible]=useState(true); const s=STYLES[type];
  useEffect(()=>{ const t=setTimeout(()=>{setVisible(false);onDone?.();},duration); return ()=>clearTimeout(t); },[duration,onDone]);
  if (!visible) return null;
  return <div role="status" style={{position:"fixed",bottom:24,right:24,zIndex:1000,background:s.bg,border:`0.5px solid ${s.border}`,color:s.color,padding:"10px 16px",borderRadius:6,fontSize:13,fontWeight:500,maxWidth:320}}>{message}</div>;
};
