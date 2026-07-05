import React, { useEffect, useState, useRef } from "react";
export const XPBurst:React.FC<{amount:number;onDone:()=>void}> = ({amount,onDone}) => {
  const [visible,setVisible]=useState(true); const ref=useRef(onDone);
  useEffect(()=>{ ref.current=onDone; },[onDone]);
  useEffect(()=>{ const t=setTimeout(()=>{setVisible(false);ref.current();},1800); return ()=>clearTimeout(t); },[]);
  if (!visible) return null;
  return <div aria-hidden style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:999,pointerEvents:"none",textAlign:"center"}}><div style={{fontSize:52,fontWeight:700,color:"#E85D24",animation:"xpPop 1.8s ease forwards"}}>+{amount} XP</div></div>;
};
