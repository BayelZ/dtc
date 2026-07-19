import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CHALLENGE_TYPE_ICONS, CHALLENGE_TYPE_LABELS } from "@/lib/constants";
import type { Challenge } from "@/lib/supabase/types";

export const ChallengeCard:React.FC<{challenge:Challenge;completed?:boolean;onClick:()=>void}> = ({challenge,completed,onClick}) => (
  <Card onClick={onClick} hoverable style={{border:`0.5px solid ${completed?"var(--good-border)":"var(--border)"}`,background:completed?"var(--good-bg)":"var(--bg-card)",position:"relative"}}>
    {completed && <span style={{position:"absolute",top:10,right:12,fontSize:11,color:"var(--good)"}}>✓ completed</span>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:32,height:32,borderRadius:8,background:"var(--accent-tint)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{CHALLENGE_TYPE_ICONS[challenge.type]??"❓"}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:14,fontWeight:500,margin:0,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{challenge.title}</p>
        <p style={{fontSize:11,color:"var(--text-muted)",margin:0}}>{CHALLENGE_TYPE_LABELS[challenge.type]??challenge.type}</p>
      </div>
    </div>
    <p style={{fontSize:12,color:"var(--text-muted)",margin:"0 0 10px",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{challenge.description}</p>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
      <Badge label={challenge.specialty} variant="specialty" />
      {(challenge.tags??[]).slice(0,2).map(t=><span key={t} style={{fontSize:11,color:"var(--text-faint)",background:"var(--bg-raised)",padding:"2px 6px",borderRadius:4}}>{t}</span>)}
      <span style={{marginLeft:"auto",fontSize:12,fontWeight:500,color:"var(--accent)"}}>{challenge.xp_reward} XP</span>
    </div>
  </Card>
);
