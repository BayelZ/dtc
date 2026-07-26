import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { SkillDomain } from "@/lib/supabase/types";

// Listing shape for diagnostic cases. NOTE the explicit column list: `tree` is never selected,
// because that document contains faultSeeds — the answer key. Same rule as correct_index on
// questions. (Migration 029 also revokes column access, so this is belt and braces.)
export interface TreeCaseSummary {
  id:string; slug:string; title:string; domain:SkillDomain|null;
}

export function useTreeCases() {
  const [cases,setCases]=useState<TreeCaseSummary[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const { data, error } = await getSupabase().from("challenge_trees")
          .select("id, slug, title, domain")
          .eq("is_published",true).order("created_at",{ascending:true});
        if (error) throw error;
        if (!cancelled) setCases((data??[]) as TreeCaseSummary[]);
      } catch(e) {
        // A missing table (migration not applied yet) must not break the challenges page.
        if (!cancelled) { setError(e instanceof Error?e.message:"Failed to load cases."); setCases([]); }
      }
      finally { if (!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled=true; };
  },[]);
  return { cases, loading, error };
}
