import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { tierColors } from "@/lib/utils";
import type { BadgeWithStatus } from "@/hooks/useBadges";

const PRIMARY = "#E85D24";
const VISIBLE_COUNT = 4;

const BADGE_ICON:Record<string,IconName> = {
  "First Start":"flag",
  "Perfect Run":"check-circle",
  "Streak Week":"flame",
  "Diesel Head":"fuel",
};
const badgeIcon=(b:BadgeWithStatus):IconName => b.tier ? "shield" : (BADGE_ICON[b.name]??"trophy");

export const AchievementsList:React.FC<{badges:BadgeWithStatus[]}> = ({badges}) => {
  const [showAll,setShowAll]=useState(false);

  const earnedCount=badges.filter(b=>b.earned).length;
  const sorted=[...badges].sort((a,b)=> a.earned===b.earned?0:a.earned?-1:1);
  const visible=showAll?sorted:sorted.slice(0,VISIBLE_COUNT);
  const hasMore=sorted.length>VISIBLE_COUNT;

  return (
    <div style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:10,padding:"1.5rem"}}>
      <p style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>Achievements</p>
      <p style={{fontSize:13,color:"#666",margin:"0 0 16px"}}>{earnedCount} earned · {badges.length-earnedCount} locked</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visible.map(b=>{
          const accentColor=b.tier?tierColors(b.tier).color:PRIMARY;
          const rowBg=b.earned?accentColor+"14":"transparent";
          const rowBorder=b.earned?accentColor+"3a":"#2e2e2e";
          const circleBg=b.earned?accentColor+"22":"#242424";
          const circleBorder=b.earned?accentColor+"77":"#2e2e2e";
          const glow=b.earned?`0 0 18px ${accentColor}40`:"none";
          return (
            <div key={b.id} style={{display:"flex",alignItems:"center",gap:16,padding:"14px 16px",borderRadius:10,background:rowBg,border:`0.5px solid ${rowBorder}`,opacity:b.earned?1:0.5}}>
              <div style={{width:52,height:52,borderRadius:"50%",flexShrink:0,background:circleBg,border:`1.5px solid ${circleBorder}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:glow}}>
                <Icon icon={badgeIcon(b)} size={26} color={b.earned?accentColor:"#666"} strokeWidth={b.earned?2.1:1.6} />
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:15,fontWeight:600,margin:"0 0 3px",color:b.earned?"#f0f0f0":"#999"}}>{b.name}</p>
                <p style={{fontSize:13,color:"#666",margin:0,lineHeight:1.4}}>{b.description}</p>
              </div>
              {b.earned
                ? <Icon icon="check-circle" size={20} color={accentColor} strokeWidth={2} />
                : <Icon icon="lock" size={18} color="#666" strokeWidth={2} />}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button onClick={()=>setShowAll(s=>!s)} style={{display:"block",margin:"16px auto 0",padding:"8px 20px",fontSize:13,fontWeight:500,background:"#242424",color:"#f0f0f0",border:"0.5px solid #3e3e3e",borderRadius:6,cursor:"pointer"}}>
          {showAll?"Show less":`See all (${sorted.length})`}
        </button>
      )}
    </div>
  );
};
