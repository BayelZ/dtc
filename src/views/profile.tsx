import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProficiencyChart } from "@/components/profile/ProficiencyChart";
import { AchievementsList } from "@/components/profile/AchievementsList";
import { useProfile } from "@/hooks/useProfile";
import { useProficiency } from "@/hooks/useProficiency";
import { useBadges } from "@/hooks/useBadges";
import { getSupabase } from "@/lib/supabase/client";
import { xpToNextTier, tierColors } from "@/lib/utils";

export const ProfilePage:React.FC<{userId:string|null|undefined}> = ({userId}) => {
  const { profile, mutate } = useProfile(userId);
  const { stats, loading:statsLoading } = useProficiency(profile?.id);
  const { badges, loading:badgesLoading } = useBadges(profile?.id);
  const [rank,setRank]=useState<number|null>(null);

  useEffect(()=>{
    if (!profile?.id) return;
    let cancelled=false;
    getSupabase().from("leaderboard").select("specialty_rank").eq("id",profile.id).single().then(({data})=>{
      if (!cancelled) setRank(data?.specialty_rank ?? null);
    });
    return ()=>{ cancelled=true; };
  },[profile?.id]);

  const handleSaveBio=useCallback(async(bio:string)=>{
    if (!profile?.id) return;
    const { error } = await getSupabase().from("profiles").update({bio}).eq("id",profile.id);
    if (!error) mutate({bio});
  },[profile?.id,mutate]);

  // The API route already persists avatar_url server-side (via admin client) — just sync local state.
  const handleAvatarUploaded=useCallback((avatar_url:string)=>{ mutate({avatar_url}); },[mutate]);

  if (!profile?.id) return <p style={{textAlign:"center",color:"#888",padding:"3rem 0"}}>Loading profile…</p>;

  const { next, needed, progress } = xpToNextTier(profile.xp);
  const hasNextTier = needed>0 || profile.tier!=="Master";
  const nextTierColor = tierColors(next).color;
  const earnedCount = badges.filter(b=>b.earned).length;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <ProfileHeader profile={profile} rank={rank} onSaveBio={handleSaveBio} onAvatarUploaded={handleAvatarUploaded} />
      <ProfileStats profile={profile} rank={rank} earnedCount={earnedCount} totalBadges={badges.length} />

      <div style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:10,padding:"16px 18px",marginBottom:18}}>
        {hasNextTier ? (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <span style={{fontSize:13,color:"#999",display:"flex",alignItems:"center",gap:6}}>
                <Icon icon="shield" size={14} color={nextTierColor} /> Next tier: {next}
              </span>
              <span style={{fontSize:13,color:"#999"}}>{needed.toLocaleString()} XP remaining</span>
            </div>
            <div style={{height:7,background:"#242424",borderRadius:4}}>
              <div style={{height:7,width:`${progress}%`,background:nextTierColor,borderRadius:4}} />
            </div>
          </div>
        ) : (
          <div style={{fontSize:13,color:"#999"}}>Maximum tier reached — Master</div>
        )}
      </div>

      {statsLoading ? <p style={{textAlign:"center",color:"#888",padding:"1rem 0"}}>Loading proficiency…</p> : <ProficiencyChart stats={stats} />}
      {badgesLoading ? <p style={{textAlign:"center",color:"#888",padding:"1rem 0"}}>Loading achievements…</p> : <AchievementsList badges={badges} />}
    </div>
  );
};
