import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export function useProfile(userId:string|null|undefined) {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const fetchProfile=useCallback(async()=>{
    if (!userId) { setProfile(null); return; }
    setLoading(true); setError(null);
    try {
      const { data, error } = await getSupabase().from("profiles").select("*").eq("id",userId).single();
      if (error) throw error;
      setProfile(data);
    } catch(e) { setError(e instanceof Error?e.message:"Failed to load profile."); }
    finally { setLoading(false); }
  },[userId]);
  useEffect(()=>{ fetchProfile(); },[fetchProfile]);
  const mutate=useCallback((p:Partial<Profile>)=>setProfile(prev=>prev?{...prev,...p}:prev),[]);
  return { profile, loading, error, refresh: fetchProfile, mutate };
}
