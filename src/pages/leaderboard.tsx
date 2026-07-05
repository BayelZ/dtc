import React, { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TierBadge } from "@/components/grading/TierBadge";
import type { LeaderboardRow, Profile, Tier } from "@/lib/supabase/types";

export const LeaderboardPage:React.FC<{profile:Partial<Profile>|null}> = ({profile}) => {
  const [rows,setRows]=useState<LeaderboardRow[]>([]);
  const [loading,setLd]=useState(true);
  const [filter,setFilter]=useState("All");
  // FIX: leaderboard VIEW has no guaranteed order — order in the consuming query
  useEffect(()=>{ getSupabase().from("leaderboard").select("*").order("xp",{ascending:false}).limit(50).then(({data})=>{ setRows(data??[]); setLd(false); }); },[]);
  const displayed = filter==="All" ? rows : rows.filter(r=>r.specialty===filter);
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Houston leaderboard</h1>
      <p style={{fontSize:13,color:"#888",margin:"0 0 1.25rem"}}>Beta region · All-time</p>
      <div style={{display:"flex",gap:8,marginBottom:"1.25rem"}}>
        {["All","Automotive","Diesel"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 14px",fontSize:12,border:`0.5px solid ${filter===s?"#E85D24":"#2e2e2e"}`,borderRadius:6,background:filter===s?"#2a1a12":"#1a1a1a",color:filter===s?"#ff7a45":"#888",cursor:"pointer"}}>{s}</button>
        ))}
      </div>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"36px 1fr 70px 100px 70px 60px",gap:8,padding:"0 0 8px",borderBottom:"0.5px solid #2e2e2e",marginBottom:4}}>
          {["#","Mechanic","Tier","Specialty","XP","Acc."].map(h=><span key={h} style={{fontSize:11,color:"#888",fontWeight:500}}>{h}</span>)}
        </div>
        {loading && <p style={{color:"#888",padding:"1rem 0"}}>Loading…</p>}
        {displayed.map(u=>{
          const isMe=u.id===profile?.id;
          return (
            <div key={u.id} style={{display:"grid",gridTemplateColumns:"36px 1fr 70px 100px 70px 60px",gap:8,borderBottom:"0.5px solid #2e2e2e",background:isMe?"#2a1a12":"transparent",margin:isMe?"0 -1.25rem":undefined,padding:isMe?"10px 1.25rem":"10px 0",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:500,color:u.rank<=3?"#E85D24":"#888"}}>#{u.rank}</span>
              <div style={{minWidth:0}}>
                <p style={{fontSize:13,fontWeight:500,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name}{isMe&&<span style={{fontSize:9,background:"#2a1a12",color:"#ff7a45",border:"0.5px solid #5a2e12",padding:"1px 5px",borderRadius:3,marginLeft:6}}>you</span>}</p>
                <p style={{fontSize:11,color:"#888",margin:0}}>{u.shop_name||"—"}</p>
              </div>
              <TierBadge tier={u.tier as Tier} size="sm" />
              <Badge label={u.specialty} variant="specialty" />
              <span style={{fontSize:13,fontWeight:500}}>{u.xp.toLocaleString()}</span>
              <span style={{fontSize:13,color:u.accuracy_pct>=80?"#6fcf6f":u.accuracy_pct>=60?"#e6b84a":"#888"}}>{u.accuracy_pct}%</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
};
