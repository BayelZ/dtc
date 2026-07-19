import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProficiencyChart } from "@/components/profile/ProficiencyChart";
import { AchievementsList } from "@/components/profile/AchievementsList";
import { ThemePicker } from "@/components/profile/ThemePicker";
import { useProfile } from "@/hooks/useProfile";
import { useProficiency } from "@/hooks/useProficiency";
import { useBadges } from "@/hooks/useBadges";
import { getSupabase } from "@/lib/supabase/client";
import { xpToNextTier, tierColors } from "@/lib/utils";

interface ProfilePageProps { userId:string|null|undefined; isOwnProfile:boolean; onBack?:()=>void; }

export const ProfilePage:React.FC<ProfilePageProps> = ({userId,isOwnProfile,onBack}) => {
  const { profile, mutate } = useProfile(userId);
  const { stats, loading:statsLoading } = useProficiency(profile?.id);
  const { badges, loading:badgesLoading } = useBadges(profile?.id);
  const [rank,setRank]=useState<number|null>(null);
  const [comebacks,setComebacks]=useState<{cleared:number;stamp:boolean}|null>(null);

  useEffect(()=>{
    if (!profile?.id) return;
    let cancelled=false;
    getSupabase().from("leaderboard").select("specialty_rank,comebacks_cleared,no_comebacks").eq("id",profile.id).single().then(({data})=>{
      if (cancelled) return;
      setRank(data?.specialty_rank ?? null);
      setComebacks(data ? {cleared:data.comebacks_cleared, stamp:data.no_comebacks} : null);
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

  if (!profile?.id) return <p style={{textAlign:"center",color:"var(--text-muted)",padding:"3rem 0"}}>Loading profile…</p>;

  const { next, needed, progress } = xpToNextTier(profile.xp);
  const hasNextTier = needed>0 || profile.tier!=="Master";
  const nextTierColor = tierColors(next).color;
  const earnedCount = badges.filter(b=>b.earned).length;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {onBack && (
        <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"var(--text-muted)",cursor:"pointer",padding:"0 0 12px"}}>← Back to leaderboard</button>
      )}
      <ProfileHeader profile={profile} rank={rank} isOwnProfile={isOwnProfile} onSaveBio={handleSaveBio} onAvatarUploaded={handleAvatarUploaded} />
      <ProfileStats profile={profile} rank={rank} earnedCount={earnedCount} totalBadges={badges.length} />

      {comebacks && (
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:"#0C2740",border:"1px solid #1E4568",borderRadius:8,padding:"12px 16px",marginBottom:18}}>
          <span style={{fontSize:11,letterSpacing:".16em",textTransform:"uppercase",color:"#8FB0C4",fontFamily:"ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"}}>Rework bench</span>
          <span style={{fontSize:13,color:"#E9EEF2"}}>{comebacks.cleared} comeback{comebacks.cleared===1?"":"s"} cleared</span>
          {comebacks.stamp && (
            <span style={{transform:"rotate(-4deg)",border:"2.5px double #E9EEF2",borderRadius:4,padding:"2px 9px 3px",fontSize:11,fontWeight:800,letterSpacing:".16em",textTransform:"uppercase",color:"#E9EEF2",marginLeft:"auto"}}>No comebacks</span>
          )}
        </div>
      )}

      <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"16px 18px",marginBottom:18}}>
        {hasNextTier ? (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <span style={{fontSize:13,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:6}}>
                <Icon icon="shield" size={14} color={nextTierColor} /> Next tier: {next}
              </span>
              <span style={{fontSize:13,color:"var(--text-muted)"}}>{needed.toLocaleString()} XP remaining</span>
            </div>
            <div style={{height:7,background:"var(--bg-raised)",borderRadius:4}}>
              <div style={{height:7,width:`${progress}%`,background:nextTierColor,borderRadius:4}} />
            </div>
          </div>
        ) : (
          <div style={{fontSize:13,color:"var(--text-muted)"}}>Maximum tier reached — Master</div>
        )}
      </div>

      {statsLoading ? <p style={{textAlign:"center",color:"var(--text-muted)",padding:"1rem 0"}}>Loading proficiency…</p> : <ProficiencyChart stats={stats} />}
      {badgesLoading ? <p style={{textAlign:"center",color:"var(--text-muted)",padding:"1rem 0"}}>Loading achievements…</p> : <AchievementsList badges={badges} />}
      {isOwnProfile && <ThemePicker />}
    </div>
  );
};
