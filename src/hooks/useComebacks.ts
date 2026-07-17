import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

// Lightweight pile stats for dashboard/profile — reads the user's own rows
// under RLS (no correct_index anywhere near this table).
export function usePileStats(userId?:string) {
  const [open,setOpen]=useState(0);
  const [cleared,setCleared]=useState(0);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    if (!userId) { setLoading(false); return; }
    const { data } = await getSupabase().from("comebacks").select("cleared_at,cleared_count").eq("user_id",userId);
    const rows=data??[];
    setOpen(rows.filter(r=>r.cleared_at===null).length);
    setCleared(rows.reduce((n,r)=>n+r.cleared_count,0));
    setLoading(false);
  },[userId]);
  useEffect(()=>{ void refresh(); },[refresh]);
  return { open, cleared, loading, refresh };
}
