import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TierBadge } from "@/components/grading/TierBadge";
import { getSupabase } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import type { LeaderboardRow, Tier } from "@/lib/supabase/types";

export const ShopPage:React.FC = () => {
  const [rows,setRows]=useState<LeaderboardRow[]>([]);
  const [loading,setLd]=useState(true);
  useEffect(()=>{ getSupabase().from("leaderboard").select("*").order("xp",{ascending:false}).limit(12).then(({data})=>{ setRows(data??[]); setLd(false); }); },[]);
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Shop portal</h1>
      <p style={{fontSize:13,color:"#888",margin:"0 0 1.5rem"}}>Review candidate skill ratings, grades, and tier for hiring decisions</p>
      {loading ? <p style={{color:"#888"}}>Loading…</p> : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {rows.map(u=>(
            <Card key={u.id}>
              <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:"#2a1a12",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:"#E85D24",flexShrink:0}}>{getInitials(u.full_name)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:14,fontWeight:500,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name}</p>
                  <p style={{fontSize:11,color:"#888",margin:0}}>{u.shop_name||"Independent"}</p>
                </div>
                <TierBadge tier={u.tier as Tier} size="sm" />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
                {[{label:"XP",val:u.xp.toLocaleString()},{label:"Rank",val:`#${u.rank}`},{label:"Acc.",val:`${u.accuracy_pct}%`},{label:"A-grades",val:String(u.grade_a_count)}].map(s=>(
                  <div key={s.label} style={{background:"#242424",borderRadius:5,padding:"6px 8px"}}>
                    <p style={{fontSize:10,color:"#888",margin:0}}>{s.label}</p>
                    <p style={{fontSize:13,fontWeight:500,margin:0}}>{s.val}</p>
                  </div>
                ))}
              </div>
              <button style={{width:"100%",padding:7,border:"0.5px solid #2e2e2e",borderRadius:5,background:"#242424",color:"#f0f0f0",fontSize:12,cursor:"pointer"}}>View full profile</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
