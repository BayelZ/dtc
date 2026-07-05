import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

export function useAuth() {
  const [user,setUser]=useState<User|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const sb=getSupabase();
    sb.auth.getSession().then(({data:{session}})=>{ setSession(session); setUser(session?.user??null); setLoading(false); });
    const { data:{subscription} } = sb.auth.onAuthStateChange((_e,session)=>{ setSession(session); setUser(session?.user??null); setLoading(false); });
    return ()=>subscription.unsubscribe();
  },[]);
  const signOut=useCallback(async()=>{ await getSupabase().auth.signOut(); },[]);
  return { user, session, loading, signOut };
}
