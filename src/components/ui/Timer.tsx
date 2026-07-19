import React, { useEffect, useState, useRef } from "react";
export const Timer:React.FC<{seconds:number;onExpire:()=>void}> = ({seconds,onExpire}) => {
  const [left,setLeft]=useState(seconds);
  const ref=useRef<ReturnType<typeof setInterval>|null>(null);
  const fired=useRef(false);
  const onExpireRef=useRef(onExpire);
  useEffect(()=>{ onExpireRef.current=onExpire; },[onExpire]);
  useEffect(()=>{
    fired.current=false; setLeft(seconds);
    ref.current=setInterval(()=>{ setLeft(p=>{ if(p<=1){clearInterval(ref.current!); if(!fired.current){fired.current=true;onExpireRef.current();} return 0;} return p-1; }); },1000);
    return ()=>clearInterval(ref.current!);
  },[seconds]);
  const pct=(left/seconds)*100; const color=left>20?"var(--good)":left>10?"var(--gold)":"var(--bad)";
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:13,fontWeight:500,color,minWidth:32,textAlign:"right"}}>{left}s</span>
      <div style={{flex:1,height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:4,width:`${pct}%`,background:color,borderRadius:2,transition:"width 1s linear"}}/></div>
    </div>
  );
};
