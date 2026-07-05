import React, { useState, useCallback, useEffect } from "react";
import type { NextPage } from "next";
import type { User } from "@supabase/supabase-js";
import { InviteGate } from "@/components/auth/InviteGate";
import { AuthForm } from "@/components/auth/AuthForm";
import { AppShell } from "@/components/layout/AppShell";
import type { NavPage } from "@/components/layout/Nav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { DashboardPage } from "./dashboard";
import { ChallengesPage } from "./challenges";
import { LeaderboardPage } from "./leaderboard";
import { ProfilePage } from "./profile";
import { ShopPage } from "./shop";
import type { Profile } from "@/lib/supabase/types";

type Stage="invite"|"auth"|"app";

const Home:NextPage = () => {
  const { user, loading:authLoading, signOut } = useAuth();
  const [stage,setStage]=useState<Stage>("invite");
  const [inviteCode,setInviteCode]=useState("");
  const [currentPage,setPage]=useState<NavPage>("Dashboard");
  const [localProfile,setLocalProfile]=useState<Partial<Profile>|null>(null);
  const { profile:dbProfile, mutate } = useProfile(user?.id);

  useEffect(()=>{ if (!authLoading && user) setStage("app"); },[user,authLoading]);
  const handleInviteValid=useCallback((code:string)=>{ setInviteCode(code); setStage("auth"); },[]);
  const handleAuth=useCallback((_user:User,prof:Partial<Profile>)=>{ setLocalProfile(prof); setStage("app"); },[]);
  const handleLogout=useCallback(async()=>{ await signOut(); setStage("invite"); setLocalProfile(null); setPage("Dashboard"); },[signOut]);

  const profile = dbProfile ?? localProfile;
  if (authLoading) return <div style={{minHeight:"100vh",background:"#0f0f0f",display:"flex",alignItems:"center",justifyContent:"center",color:"#888"}}>Loading…</div>;
  if (stage==="invite") return <InviteGate onValid={handleInviteValid} />;
  if (stage==="auth") return <AuthForm inviteCode={inviteCode} onAuth={handleAuth} />;

  return (
    <AppShell currentPage={currentPage} profile={profile} onNavigate={setPage} onLogout={handleLogout}>
      {currentPage==="Dashboard" && <DashboardPage profile={profile} onNavigate={setPage} />}
      {currentPage==="Challenges" && <ChallengesPage profile={profile} onXP={xp=>mutate({xp:(profile?.xp??0)+xp})} />}
      {currentPage==="Leaderboard" && <LeaderboardPage profile={profile} />}
      {currentPage==="Profile" && <ProfilePage profile={profile} />}
      {currentPage==="Shop Portal" && <ShopPage />}
    </AppShell>
  );
};
export default Home;
