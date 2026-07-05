import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/grading/TierBadge";
import { TierProgress } from "@/components/grading/TierProgress";
import { useChallenges } from "@/hooks/useChallenges";
import { formatXP } from "@/lib/utils";
import { CHALLENGE_TYPE_ICONS } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/types";
import type { NavPage } from "@/components/layout/Nav";

export const DashboardPage:React.FC<{profile:Partial<Profile>|null;onNavigate:(p:NavPage)=>void}> = ({profile,onNavigate}) => {
  const { challenges, loading } = useChallenges();
  const name=profile?.full_name??"Tech", xp=profile?.xp??0, streak=profile?.streak??0, spec=profile?.specialty??"Automotive", tier=profile?.tier??"Bronze";
  return (
    <div>
      <div style={{marginBottom:"1.5rem"}}>
        <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Good morning, {name}</h1>
        <p style={{fontSize:14,color:"#888",margin:0}}>Houston Beta · {spec} specialist</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:"1.5rem"}}>
        {[{label:"Total XP",value:formatXP(xp),sub:"Lifetime"},{label:"Streak",value:`${streak}d`,sub:"Current"},{label:"Specialty",value:spec,sub:"Primary focus"},{label:"Region",value:"Houston",sub:"Beta area"}].map(s=>(
          <div key={s.label} style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:8,padding:"1rem"}}>
            <p style={{fontSize:12,color:"#888",margin:"0 0 4px"}}>{s.label}</p>
            <p style={{fontSize:22,fontWeight:500,margin:"0 0 2px"}}>{s.value}</p>
            <p style={{fontSize:11,color:"#555",margin:0}}>{s.sub}</p>
          </div>
        ))}
      </div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <TierBadge tier={tier} size="md" showLabel />
          <span style={{fontSize:12,color:"#888"}}>{xp.toLocaleString()} XP total</span>
        </div>
        <TierProgress xp={xp} />
      </Card>

      <Card>
        <p style={{fontSize:13,fontWeight:500,margin:"0 0 12px"}}>All challenges {loading && <span style={{fontSize:11,color:"#555"}}>loading…</span>}</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
          {challenges.map(c=>(
            <div key={c.id} onClick={()=>onNavigate("Challenges")} style={{border:"0.5px solid #2e2e2e",borderRadius:6,padding:"10px 12px",cursor:"pointer",background:"#242424"}}>
              <div style={{display:"flex",gap:6,marginBottom:6}}><span style={{fontSize:13}}>{CHALLENGE_TYPE_ICONS[c.type]??"❓"}</span></div>
              <p style={{fontSize:13,fontWeight:500,margin:"0 0 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</p>
              <div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={c.specialty} variant="specialty" /><span style={{fontSize:11,color:"#555"}}>{c.xp_reward} XP</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
