import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TierBadge } from "@/components/grading/TierBadge";
import { TierProgress } from "@/components/grading/TierProgress";
import { useChallenges } from "@/hooks/useChallenges";
import { usePileStats } from "@/hooks/useComebacks";
import { formatXP } from "@/lib/utils";
import { CHALLENGE_TYPE_ICONS } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/types";
import type { NavPage } from "@/components/layout/Nav";

export const DashboardPage:React.FC<{profile:Partial<Profile>|null;onNavigate:(p:NavPage)=>void;onOpenBench:()=>void}> = ({profile,onNavigate,onOpenBench}) => {
  const { challenges, loading } = useChallenges();
  const pile = usePileStats(profile?.id);
  const name=profile?.full_name??"Tech", xp=profile?.xp??0, streak=profile?.streak??0, spec=profile?.specialty??"Automotive", tier=profile?.tier??"Bronze";
  return (
    <div>
      <div style={{marginBottom:"1.5rem"}}>
        <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Good morning, {name}</h1>
        <p style={{fontSize:14,color:"var(--text-muted)",margin:0}}>Houston Beta · {spec} specialist</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:"1.5rem"}}>
        {[{label:"Total XP",value:formatXP(xp),sub:"Lifetime"},{label:"Streak",value:`${streak}d`,sub:"Current"},{label:"Specialty",value:spec,sub:"Primary focus"},{label:"Region",value:"Houston",sub:"Beta area"}].map(s=>(
          <div key={s.label} style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:8,padding:"1rem",minWidth:0}}>
            <p style={{fontSize:12,color:"var(--text-muted)",margin:"0 0 4px"}}>{s.label}</p>
            <p style={{fontSize:22,fontWeight:500,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.value}</p>
            <p style={{fontSize:11,color:"var(--text-faint)",margin:0}}>{s.sub}</p>
          </div>
        ))}
      </div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <TierBadge tier={tier} size="md" showLabel />
          <span style={{fontSize:12,color:"var(--text-muted)"}}>{xp.toLocaleString()} XP total</span>
        </div>
        <TierProgress xp={xp} />
      </Card>

      {/* Comeback Pile — deliberately the only blue element in the black shop */}
      <div role="button" tabIndex={0} onClick={onOpenBench} onKeyDown={e=>e.key==="Enter"&&onOpenBench()}
        style={{background:"#0C2740",border:pile.open>0?"1px dashed rgba(233,238,242,0.55)":"1px solid #1E4568",
          borderRadius:8,padding:"1rem",marginBottom:16,cursor:"pointer",outline:"none",
          display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:11,letterSpacing:".16em",textTransform:"uppercase",color:"#8FB0C4",margin:"0 0 4px",
            fontFamily:"ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"}}>Comeback pile</p>
          <p style={{fontSize:20,fontWeight:700,margin:0,color:"#E9EEF2"}}>
            {pile.loading?"…":pile.open>0?`${pile.open} waiting`:"Bench clear"}
          </p>
          <p style={{fontSize:11,margin:"4px 0 0",color:pile.open>0?"#C9705A":"#8FB0C4"}}>
            {pile.open>0?"Jobs came back — no clock, no XP":"No comebacks. The way it should be."}
          </p>
        </div>
        <span style={{background:"#E9EEF2",color:"#0C2740",borderRadius:5,padding:"9px 14px",fontSize:12,fontWeight:800,
          letterSpacing:".06em",textTransform:"uppercase"}}>
          {pile.open>0?"Make it right":"Visit the bench"}
        </span>
      </div>

      <Card>
        <p style={{fontSize:13,fontWeight:500,margin:"0 0 12px"}}>All challenges {loading && <span style={{fontSize:11,color:"var(--text-faint)"}}>loading…</span>}</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
          {challenges.map(c=>(
            <div key={c.id} onClick={()=>onNavigate("Challenges")} style={{border:"0.5px solid var(--border)",borderRadius:6,padding:"10px 12px",cursor:"pointer",background:"var(--bg-raised)"}}>
              <div style={{display:"flex",gap:6,marginBottom:6}}><span style={{fontSize:13}}>{CHALLENGE_TYPE_ICONS[c.type]??"❓"}</span></div>
              <p style={{fontSize:13,fontWeight:500,margin:"0 0 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</p>
              <div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={c.specialty} variant="specialty" /><span style={{fontSize:11,color:"var(--text-faint)"}}>{c.xp_reward} XP</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
