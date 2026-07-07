import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { calcAccuracy, computeSpeedScore } from "@/lib/utils";
import { QUESTIONS_PER_SESSION } from "@/lib/constants";
import type { IconName } from "@/components/ui/Icon";

export interface ProficiencyStat { label:string; value:number; icon:IconName; }

export function useProficiency(userId:string|null|undefined) {
  const [stats,setStats]=useState<ProficiencyStat[]>([]);
  const [loading,setLoading]=useState(true);

  const fetchStats=useCallback(async()=>{
    if (!userId) { setStats([]); setLoading(false); return; }
    setLoading(true);
    const sb=getSupabase();
    const [{data:skillScores},{data:attempts}] = await Promise.all([
      sb.from("skill_scores").select("*").eq("user_id",userId),
      sb.from("attempt_summaries").select("score,total_questions,time_seconds,grade").eq("user_id",userId).eq("completed",true),
    ]);

    const domainScore=(domain:string):number=>{
      const s=(skillScores??[]).find(x=>x.domain===domain);
      if (!s||s.attempts===0) return 0;
      return calcAccuracy(s.correct, s.attempts*QUESTIONS_PER_SESSION);
    };

    const rows=attempts??[];
    const totalQ=rows.reduce((sum,a)=>sum+a.total_questions,0);
    const totalCorrect=rows.reduce((sum,a)=>sum+a.score,0);
    const accuracy=calcAccuracy(totalCorrect,totalQ);
    const avgTimePerQ=totalQ>0 ? rows.reduce((sum,a)=>sum+a.time_seconds,0)/totalQ : 0;
    const speed=computeSpeedScore(avgTimePerQ);
    const strongCount=rows.filter(a=>a.grade==="A"||a.grade==="B").length;
    const consistency=calcAccuracy(strongCount, rows.length);

    setStats([
      { label:"Electrical", value:domainScore("Electrical"), icon:"zap" },
      { label:"Fuel", value:domainScore("Fuel"), icon:"fuel" },
      { label:"Speed", value:speed, icon:"gauge" },
      { label:"Emissions", value:domainScore("Emissions"), icon:"wind" },
      { label:"Accuracy", value:accuracy, icon:"target" },
      { label:"Drivetrain", value:domainScore("Drivetrain"), icon:"cog" },
      { label:"Consistency", value:consistency, icon:"trending" },
      { label:"Network", value:domainScore("Network"), icon:"share" },
    ]);
    setLoading(false);
  },[userId]);

  useEffect(()=>{ fetchStats(); },[fetchStats]);

  return { stats, loading, refresh:fetchStats };
}
