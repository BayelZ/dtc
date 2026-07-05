import React from "react";
import { Logo } from "@/components/ui/Logo";
import { TierBadge } from "@/components/grading/TierBadge";
import { getInitials, formatXP } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export type NavPage="Dashboard"|"Challenges"|"Leaderboard"|"Profile"|"Shop Portal";
const NAV_ITEMS:NavPage[]=["Dashboard","Challenges","Leaderboard","Profile","Shop Portal"];

export const Nav:React.FC<{currentPage:NavPage;profile:Partial<Profile>|null;onNavigate:(p:NavPage)=>void;onLogout:()=>void}> = ({currentPage,profile,onNavigate,onLogout}) => {
  const displayName=profile?.full_name??"Tech";
  return (
    <nav aria-label="Main navigation" style={{background:"#1a1a1a",borderBottom:"0.5px solid #2e2e2e",padding:"0 1.25rem",display:"flex",alignItems:"center",gap:2,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,padding:"12px 0"}}>
        <Logo size="sm" />
        <span style={{fontSize:10,background:"#2a1a12",color:"#ff7a45",border:"0.5px solid #5a2e12",padding:"2px 8px",borderRadius:5,fontWeight:500,whiteSpace:"nowrap"}}>Beta · Houston</span>
      </div>
      {NAV_ITEMS.map(item=>(
        <button key={item} onClick={()=>onNavigate(item)} aria-current={currentPage===item?"page":undefined}
          style={{background:"none",border:"none",cursor:"pointer",padding:"14px 8px",fontSize:13,color:currentPage===item?"#E85D24":"#888",borderBottom:currentPage===item?"2px solid #E85D24":"2px solid transparent",fontWeight:currentPage===item?500:400,whiteSpace:"nowrap"}}>
          {item}
        </button>
      ))}
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
        {profile?.tier && <TierBadge tier={profile.tier} size="sm" />}
        <span style={{fontSize:12,color:"#888"}}>{formatXP(profile?.xp??0)} XP</span>
        <button onClick={onLogout} title={`Logged in as ${displayName} — click to log out`}
          style={{width:30,height:30,borderRadius:"50%",background:"#2a1a12",border:"0.5px solid #E85D24",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,color:"#E85D24",cursor:"pointer"}}>
          {getInitials(displayName)}
        </button>
      </div>
    </nav>
  );
};
