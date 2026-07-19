import React, { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { TierBadge } from "@/components/grading/TierBadge";
import { getInitials, formatXP } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export type NavPage="Dashboard"|"Challenges"|"Leaderboard"|"Profile"|"Shop Portal"|"Disputes";
const NAV_ITEMS:NavPage[]=["Dashboard","Challenges","Leaderboard","Profile","Shop Portal"];

export const Nav:React.FC<{currentPage:NavPage;profile:Partial<Profile>|null;onNavigate:(p:NavPage)=>void;onLogout:()=>void}> = ({currentPage,profile,onNavigate,onLogout}) => {
  const displayName=profile?.full_name??"Tech";
  const [menuOpen,setMenuOpen]=useState(false);
  const navigate=(item:NavPage)=>{ onNavigate(item); setMenuOpen(false); };
  const navItems:NavPage[]=profile?.is_admin?[...NAV_ITEMS,"Disputes"]:NAV_ITEMS;
  return (
    <nav aria-label="Main navigation" style={{background:"var(--bg-card)",borderBottom:"0.5px solid var(--border)",position:"sticky",top:0,zIndex:100}}>
      <div style={{padding:"0 1.25rem",display:"flex",alignItems:"center",gap:2}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,padding:"12px 0"}}>
          <Logo size="sm" />
          <span className="nav-beta-badge" style={{fontSize:10,background:"var(--accent-tint)",color:"var(--accent-hi)",border:"0.5px solid color-mix(in srgb, var(--accent) 35%, var(--bg))",padding:"2px 8px",borderRadius:5,fontWeight:500,whiteSpace:"nowrap"}}>Beta · Houston</span>
        </div>
        <div className="nav-items">
          {navItems.map(item=>(
            <button key={item} onClick={()=>navigate(item)} aria-current={currentPage===item?"page":undefined}
              style={{background:"none",border:"none",cursor:"pointer",padding:"14px 8px",fontSize:13,color:currentPage===item?"var(--accent)":"var(--text-muted)",borderBottom:currentPage===item?"2px solid var(--accent)":"2px solid transparent",fontWeight:currentPage===item?500:400,whiteSpace:"nowrap"}}>
              {item}
            </button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          {profile?.tier && <TierBadge tier={profile.tier} size="sm" />}
          <span style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>{formatXP(profile?.xp??0)} XP</span>
          <button onClick={onLogout} title={`Logged in as ${displayName} — click to log out`}
            style={{width:30,height:30,flexShrink:0,borderRadius:"50%",background:"var(--accent-tint)",border:"0.5px solid var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,color:"var(--accent)",cursor:"pointer"}}>
            {getInitials(displayName)}
          </button>
          <button className="nav-hamburger" onClick={()=>setMenuOpen(o=>!o)} aria-label="Toggle navigation menu" aria-expanded={menuOpen}
            style={{width:30,height:30,flexShrink:0,background:"none",border:"0.5px solid var(--border)",borderRadius:6,color:"var(--text)",fontSize:16,cursor:"pointer",alignItems:"center",justifyContent:"center"}}>
            {menuOpen?"✕":"☰"}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="nav-mobile-menu" style={{display:"flex",flexDirection:"column",borderTop:"0.5px solid var(--border)",padding:"4px 1.25rem"}}>
          {navItems.map(item=>(
            <button key={item} onClick={()=>navigate(item)} aria-current={currentPage===item?"page":undefined}
              style={{background:"none",border:"none",cursor:"pointer",padding:"12px 0",fontSize:14,textAlign:"left",color:currentPage===item?"var(--accent)":"var(--text-dim)",fontWeight:currentPage===item?500:400,borderBottom:"0.5px solid var(--border)"}}>
              {item}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};
