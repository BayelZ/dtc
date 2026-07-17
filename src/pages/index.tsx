import React, { useState, useCallback, useEffect } from "react";
import type { NextPage } from "next";
import type { User } from "@supabase/supabase-js";
import { AuthForm } from "@/components/auth/AuthForm";
import { AppShell } from "@/components/layout/AppShell";
import type { NavPage } from "@/components/layout/Nav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { DashboardPage } from "@/views/dashboard";
import { ReworkBench } from "@/views/bench";
import { ChallengesPage } from "@/views/challenges";
import { LeaderboardPage } from "@/views/leaderboard";
import { ProfilePage } from "@/views/profile";
import { ShopPage } from "@/views/shop";
import type { Profile } from "@/lib/supabase/types";
import { OPEN_BETA_INVITE_TAG } from "@/lib/constants";

type Stage="auth"|"app";

const Home:NextPage = () => {
  const { user, loading:authLoading, signOut } = useAuth();
  const [stage,setStage]=useState<Stage>("auth");
  const [currentPage,setCurrentPage]=useState<NavPage>("Dashboard");
  // benchEpoch remounts the dashboard on exit so pile stats refresh
  const [benchOpen,setBenchOpen]=useState(false);
  const [benchEpoch,setBenchEpoch]=useState(0);
  const [viewingUserId,setViewingUserId]=useState<string|null>(null);
  const [localProfile,setLocalProfile]=useState<Partial<Profile>|null>(null);
  const { profile:dbProfile, mutate } = useProfile(user?.id);

  useEffect(()=>{ if (!authLoading && user) setStage("app"); },[user,authLoading]);
  const handleAuth=useCallback((_user:User,prof:Partial<Profile>)=>{ setLocalProfile(prof); setStage("app"); },[]);
  const handleLogout=useCallback(async()=>{ await signOut(); setStage("auth"); setLocalProfile(null); setCurrentPage("Dashboard"); },[signOut]);
  // Nav-tab clicks always mean "go to my own X" — clear any profile being viewed.
  const handleNavigate=useCallback((page:NavPage)=>{ setViewingUserId(null); setCurrentPage(page); },[]);
  const handleViewProfile=useCallback((id:string)=>{ setViewingUserId(id); setCurrentPage("Profile"); },[]);

  const profile = dbProfile ?? localProfile;
  const viewedUserId = viewingUserId ?? user?.id;
  const isOwnProfile = !viewingUserId || viewingUserId===user?.id;
  if (authLoading) return <div style={{minHeight:"100vh",background:"#0f0f0f",display:"flex",alignItems:"center",justifyContent:"center",color:"#888"}}>Loading…</div>;
  if (stage==="auth") return <AuthForm inviteCode={OPEN_BETA_INVITE_TAG} onAuth={handleAuth} />;

  return (
    <AppShell currentPage={currentPage} profile={profile} onNavigate={handleNavigate} onLogout={handleLogout}>
      {benchOpen && <ReworkBench onExit={()=>{ setBenchOpen(false); setBenchEpoch(e=>e+1); }} />}
      {currentPage==="Dashboard" && <DashboardPage key={benchEpoch} profile={profile} onNavigate={handleNavigate} onOpenBench={()=>setBenchOpen(true)} />}
      {currentPage==="Challenges" && <ChallengesPage profile={profile} onXP={xp=>mutate({xp:(profile?.xp??0)+xp})} />}
      {currentPage==="Leaderboard" && <LeaderboardPage profile={profile} onViewProfile={handleViewProfile} />}
      {currentPage==="Profile" && <ProfilePage userId={viewedUserId} isOwnProfile={isOwnProfile} onBack={!isOwnProfile ? ()=>handleNavigate("Leaderboard") : undefined} />}
      {currentPage==="Shop Portal" && <ShopPage />}
    </AppShell>
  );
};
export default Home;
