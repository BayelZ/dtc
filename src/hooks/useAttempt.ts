import { useState, useCallback, useRef } from "react";
import type { AnswerRecord, SafeQuestion, Grade, Tier } from "@/lib/supabase/types";
import { QUESTIONS_PER_SESSION, ROUTES, QUESTION_TIME_SECONDS } from "@/lib/constants";
import { nextTierIndex } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";

export type AttemptStatus = "idle"|"starting"|"active"|"submitting"|"answered"|"finishing"|"done";
export interface AnswerResult { isCorrect:boolean; explanation:string; correctIndex:number; }
export interface FinishResult { score:number; total:number; grade:Grade; xpEarned:number; speedBonus:number; newTotalXP:number; tier:Tier; tierUp:boolean; }

export function useAttempt() {
  const [status,setStatus]=useState<AttemptStatus>("idle");
  const [attemptId,setAttemptId]=useState<string|null>(null);
  const [currentTier,setTier]=useState(0);
  const [questionIndex,setQIdx]=useState(0);
  const [selected,setSelected]=useState<number|null>(null);
  const [timedOut,setTimedOut]=useState(false);
  const [answers,setAnswers]=useState<AnswerRecord[]>([]);
  const [correctCount,setCorrect]=useState(0);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [finishResult,setFinishResult]=useState<FinishResult|null>(null);
  const attemptIdRef=useRef<string|null>(null);
  const questionStart=useRef<number>(Date.now());

  const getAuthHeaders=useCallback(async():Promise<Record<string,string>>=>{
    const { data:{session} } = await getSupabase().auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated.");
    return { "Authorization":`Bearer ${session.access_token}`, "Content-Type":"application/json" };
  },[]);

  const startAttempt=useCallback(async(challengeId:string)=>{
    setStatus("starting"); setLoading(true); setError(null);
    try {
      const headers=await getAuthHeaders();
      const res=await fetch(ROUTES.api.attemptCreate,{ method:"POST", headers, body:JSON.stringify({challenge_id:challengeId}), credentials:"include" });
      const body=await res.json();
      if (!res.ok) throw new Error(body?.error??"Failed to start attempt.");
      attemptIdRef.current=body.attempt_id; setAttemptId(body.attempt_id);
      setStatus("active"); setTier(0); setQIdx(0); setSelected(null); setTimedOut(false);
      setAnswers([]); setCorrect(0); setFinishResult(null);
      questionStart.current=Date.now();
    } catch(e) { setError(e instanceof Error?e.message:"Unknown error."); setStatus("idle"); }
    finally { setLoading(false); }
  },[getAuthHeaders]);

  const submitAnswer=useCallback(async(question:SafeQuestion, sel:number):Promise<AnswerResult>=>{
    const elapsed=Math.round((Date.now()-questionStart.current)/1000);
    const timeTaken=Math.max(1,Math.min(elapsed,QUESTION_TIME_SECONDS));
    setSelected(sel); setStatus("submitting"); setLoading(true);
    try {
      const headers=await getAuthHeaders();
      const res=await fetch(ROUTES.api.attemptAnswer,{
        method:"POST", headers,
        body:JSON.stringify({ attempt_id:attemptIdRef.current, question_id:question.id, tier_order:question.tier_order, selected:sel, time_taken_s:timeTaken }),
        credentials:"include",
      });
      const body=await res.json();
      if (!res.ok) throw new Error(body?.error??"Failed to submit answer.");
      if (body.is_correct) setCorrect(c=>c+1);
      setAnswers(prev=>[...prev,{ question_id:question.id, tier_order:question.tier_order, selected:sel, correct:body.correct_index, is_correct:body.is_correct, time_taken_s:timeTaken }]);
      setStatus("answered");
      return { isCorrect:body.is_correct, explanation:body.explanation, correctIndex:body.correct_index };
    } catch(e) { setError(e instanceof Error?e.message:"Unknown error."); setStatus("active"); throw e; }
    finally { setLoading(false); }
  },[getAuthHeaders]);

  const handleTimeout=useCallback(async(question:SafeQuestion):Promise<AnswerResult>=>{ setTimedOut(true); return submitAnswer(question,-1); },[submitAnswer]);

  const advance=useCallback((wasCorrect:boolean)=>{
    const nextIdx=questionIndex+1;
    if (nextIdx>=QUESTIONS_PER_SESSION) { setStatus("finishing"); }
    else {
      setTier(prev=>nextTierIndex(prev,wasCorrect)); setQIdx(nextIdx); setSelected(null); setTimedOut(false);
      setStatus("active"); questionStart.current=Date.now();
    }
  },[questionIndex]);

  const finish=useCallback(async()=>{
    if (!attemptIdRef.current) return;
    setLoading(true); setError(null);
    try {
      const headers=await getAuthHeaders();
      const res=await fetch(ROUTES.api.attemptFinish,{ method:"POST", headers, body:JSON.stringify({attempt_id:attemptIdRef.current}), credentials:"include" });
      const body=await res.json();
      if (!res.ok) throw new Error(body?.error??"Failed to finish attempt.");
      setFinishResult({ score:body.score, total:body.total, grade:body.grade, xpEarned:body.xp_earned, speedBonus:body.speed_bonus, newTotalXP:body.new_total_xp, tier:body.tier, tierUp:body.tier_up });
      setStatus("done");
    } catch(e) { setError(e instanceof Error?e.message:"Unknown error."); setStatus("finishing"); }
    finally { setLoading(false); }
  },[getAuthHeaders]);

  const reset=useCallback(()=>{
    attemptIdRef.current=null; setStatus("idle"); setAttemptId(null); setTier(0); setQIdx(0);
    setSelected(null); setTimedOut(false); setAnswers([]); setCorrect(0); setError(null); setLoading(false); setFinishResult(null);
  },[]);

  return { status, attemptId, currentTier, questionIndex, selected, timedOut, answers, correctCount, loading, error, finishResult,
    startAttempt, submitAnswer, handleTimeout, advance, finish, reset };
}
