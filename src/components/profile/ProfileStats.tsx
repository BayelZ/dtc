import React from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { formatXP } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

interface StatCard { label:string; val:string; icon:IconName; color:string; }

interface ProfileStatsProps {
  profile:Profile;
  rank:number|null;
  earnedCount:number;
  totalBadges:number;
}

export const ProfileStats:React.FC<ProfileStatsProps> = ({profile,rank,earnedCount,totalBadges}) => {
  const cards:StatCard[] = [
    { label:"Total XP", val:formatXP(profile.xp), icon:"zap", color:"var(--accent)" },
    { label:`${profile.specialty} rank`, val:rank!=null?`#${rank}`:"—", icon:"trophy", color:"var(--gold)" },
    { label:"Achievements", val:`${earnedCount}/${totalBadges}`, icon:"shield", color:"#2BB8A8" },
    { label:"Streak", val:`${profile.streak} days`, icon:"flame", color:"#ff6b9d" },
  ];

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4, minmax(0,1fr))",gap:12,marginBottom:18}}>
      {cards.map(card=>(
        <div key={card.label} style={{position:"relative",background:"var(--bg-card)",border:"0.5px solid var(--border)",borderLeft:`3px solid ${card.color}`,borderRadius:8,padding:"14px 16px",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-6,top:-6,opacity:0.1}}>
            <Icon icon={card.icon} size={64} color={card.color} strokeWidth={1.5} />
          </div>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <Icon icon={card.icon} size={14} color={card.color} strokeWidth={2.2} />
            <p style={{fontSize:12,color:"var(--text-muted)",margin:0}}>{card.label}</p>
          </div>
          <p style={{position:"relative",fontSize:26,fontWeight:600,margin:0,color:card.color}}>{card.val}</p>
        </div>
      ))}
    </div>
  );
};
