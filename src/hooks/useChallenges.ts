import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Challenge, SafeQuestion, SkillScore } from "@/lib/supabase/types";

export function useChallenges() {
  const [challenges,setChallenges]=useState<Challenge[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const { data, error } = await getSupabase().from("challenges").select("*").eq("is_published",true).order("created_at",{ascending:true});
        if (error) throw error;
        if (!cancelled) setChallenges(data??[]);
      } catch(e) { if (!cancelled) setError(e instanceof Error?e.message:"Failed to load."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled=true; };
  },[]);
  const fetchQuestions=useCallback(async(challengeId:string):Promise<SafeQuestion[]>=>{
    const { data, error } = await getSupabase().from("questions")
      .select("id, challenge_id, difficulty, tier_order, question_text, options, explanation, created_at")
      .eq("challenge_id",challengeId).order("tier_order",{ascending:true});
    if (error) throw error;
    return (data??[]) as SafeQuestion[];
  },[]);
  const fetchSkillScores=useCallback(async(userId:string):Promise<SkillScore[]>=>{
    const { data, error } = await getSupabase().from("skill_scores").select("*").eq("user_id",userId);
    if (error) throw error;
    return data??[];
  },[]);
  return { challenges, loading, error, fetchQuestions, fetchSkillScores };
}
