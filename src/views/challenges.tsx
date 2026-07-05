import React, { useState } from "react";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { ChallengeArena } from "@/components/challenge/ChallengeArena";
import { useChallenges } from "@/hooks/useChallenges";
import { CHALLENGE_TYPES, CHALLENGE_TYPE_LABELS } from "@/lib/constants";
import type { Challenge, Profile } from "@/lib/supabase/types";

export const ChallengesPage:React.FC<{profile:Partial<Profile>|null;onXP:(xp:number)=>void}> = ({onXP}) => {
  const { challenges, loading } = useChallenges();
  const [active,setActive]=useState<Challenge|null>(null);
  const [filterSpec,setFilterSpec]=useState("All");
  const [filterType,setFilterType]=useState("All");
  const [completed,setCompleted]=useState<Set<string>>(new Set());

  if (active) return <ChallengeArena challenge={active} onBack={()=>setActive(null)} onComplete={xp=>{ onXP(xp); setCompleted(s=>new Set(s).add(active.id)); }} />;

  const filtered=challenges.filter(c=>(filterSpec==="All"||c.specialty===filterSpec)&&(filterType==="All"||c.type===filterType));
  const FB=({val,label,current,set}:{val:string;label:string;current:string;set:(v:string)=>void}) => (
    <button onClick={()=>set(val)} style={{padding:"6px 14px",fontSize:12,border:`0.5px solid ${current===val?"#E85D24":"#2e2e2e"}`,borderRadius:6,background:current===val?"#2a1a12":"#1a1a1a",color:current===val?"#ff7a45":"#888",cursor:"pointer"}}>{label}</button>
  );

  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 1rem"}}>Challenge arena</h1>
      <div style={{display:"flex",gap:8,marginBottom:"1.25rem",flexWrap:"wrap"}}>
        {["All","Automotive","Diesel"].map(s=><FB key={s} val={s} label={s} current={filterSpec} set={setFilterSpec} />)}
        <div style={{width:1,background:"#2e2e2e",margin:"0 4px"}} />
        {["All",...CHALLENGE_TYPES].map(t=><FB key={t} val={t} label={t==="All"?"All types":CHALLENGE_TYPE_LABELS[t]??t} current={filterType} set={setFilterType} />)}
      </div>
      {loading ? <p style={{color:"#888"}}>Loading challenges…</p> : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
          {filtered.map(c=><ChallengeCard key={c.id} challenge={c} completed={completed.has(c.id)} onClick={()=>setActive(c)} />)}
          {filtered.length===0 && <p style={{gridColumn:"1/-1",textAlign:"center",color:"#888",padding:"2rem"}}>No challenges match this filter.</p>}
        </div>
      )}
    </div>
  );
};
