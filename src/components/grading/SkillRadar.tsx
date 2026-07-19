import React from "react";
import type { SkillScore, SkillDomain } from "@/lib/supabase/types";
import { SKILL_DOMAIN_ICONS } from "@/lib/supabase/types";
import { calcAccuracy } from "@/lib/utils";

const DOMAINS:SkillDomain[]=["Electrical","Fuel","Emissions","Drivetrain","Network"];

export const SkillRadar:React.FC<{scores:SkillScore[];maxXP?:number}> = ({scores,maxXP}) => {
  const scoreMap=Object.fromEntries(scores.map(s=>[s.domain,s])) as Partial<Record<SkillDomain,SkillScore>>;
  const allXP=DOMAINS.map(d=>scoreMap[d]?.xp??0);
  const cap=maxXP??Math.max(...allXP,100);
  return (
    <div>
      <p style={{fontSize:13,fontWeight:500,margin:"0 0 14px"}}>Skill domains</p>
      {DOMAINS.map(domain=>{
        const s=scoreMap[domain]; const xp=s?.xp??0;
        const acc=s?calcAccuracy(s.correct,s.attempts*3):0;
        const pct=Math.round((xp/cap)*100); const icon=SKILL_DOMAIN_ICONS[domain];
        const barColor=xp===0?"var(--border)":pct>66?"var(--accent)":pct>33?"var(--gold)":"var(--info)";
        return (
          <div key={domain} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:13,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>{icon}</span>{domain}</span>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                {s && <span style={{fontSize:11,color:"var(--text-muted)"}}>{acc}% acc · {s.attempts} tries</span>}
                <span style={{fontSize:12,color:"var(--text-muted)"}}>{xp>0?`${xp} XP`:"—"}</span>
              </div>
            </div>
            <div style={{height:6,background:"var(--bg-raised)",borderRadius:3}}>
              <div style={{height:6,width:`${pct}%`,background:barColor,borderRadius:3,transition:"width 0.5s ease",minWidth:xp>0?4:0}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
