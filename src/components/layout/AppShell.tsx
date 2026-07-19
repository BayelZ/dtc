import React from "react";
import { Nav } from "./Nav";
import type { NavPage } from "./Nav";
import type { Profile } from "@/lib/supabase/types";

export const AppShell:React.FC<{children:React.ReactNode;currentPage:NavPage;profile:Partial<Profile>|null;onNavigate:(p:NavPage)=>void;onLogout:()=>void}> = ({children,currentPage,profile,onNavigate,onLogout}) => (
  <div style={{fontFamily:"var(--font-sans)",color:"var(--text)",minHeight:"100vh",background:"var(--bg)"}}>
    <Nav currentPage={currentPage} profile={profile} onNavigate={onNavigate} onLogout={onLogout} />
    <main style={{maxWidth:960,margin:"0 auto",padding:"1.5rem 1rem"}}>{children}</main>
  </div>
);
