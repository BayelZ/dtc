import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TierBadge } from "@/components/grading/TierBadge";
import { TierProgress } from "@/components/grading/TierProgress";
import { SkillRadar } from "@/components/grading/SkillRadar";
import { getInitials, formatXP } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile, SkillScore } from "@/lib/supabase/types";

export const ProfilePage:React.FC<{profile:Partial<Profile>|null}> = ({profile}) => {
  const [skills,setSkills]=useState<SkillScore[]>([]);
  useEffect(()=>{
    if (!profile?.id) return;
    getSupabase().from("skill_scores").select("*").eq("user_id",profile.id).then(({data})=>setSkills(data??[]));
  },[profile?.id]);

  const name=profile?.full_name??"Tech", xp=profile?.xp??0, spec=profile?.specialty??"Automotive", role=profile?.role??"mechanic", shop=profile?.shop_name??"Independent", streak=profile?.streak??0, tier=profile?.tier??"Bronze";

  return (
    <div style={{maxWidth:620,margin:"0 auto"}}>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{width:54,height:54,borderRadius:"50%",background:"#2a1a12",border:"0.5px solid #E85D24",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:500,color:"#E85D24",flexShrink:0}}>{getInitials(name)}</div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <p style={{fontSize:16,fontWeight:500,margin:0}}>{name}</p>
              <TierBadge tier={tier} size="sm" showLabel />
            </div>
            <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{shop} · {spec} · Houston, TX</p>
            <p style={{fontSize:11,color:"#555",margin:"2px 0 0",textTransform:"capitalize"}}>{role.replace("_"," ")}</p>
          </div>
        </div>
        <div style={{marginBottom:14}}><TierProgress xp={xp} /></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[{label:"Total XP",val:formatXP(xp)},{label:"Streak",val:`${streak} days`},{label:"Specialty",val:spec}].map(s=>(
            <div key={s.label} style={{background:"#242424",border:"0.5px solid #2e2e2e",borderRadius:6,padding:"10px 12px"}}>
              <p style={{fontSize:11,color:"#888",margin:"0 0 2px"}}>{s.label}</p>
              <p style={{fontSize:17,fontWeight:500,margin:0}}>{s.val}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card><SkillRadar scores={skills} /></Card>
    </div>
  );
};
