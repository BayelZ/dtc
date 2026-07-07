import type { IncomingMessage } from "http";
import type { Difficulty, Grade, Tier } from "./supabase/types";
import {
  DAILY_XP_MULTIPLIER, DIFFICULTIES, SPEED_BONUS_MAX_PCT,
  SPEED_BONUS_FULL_THRESHOLD_S, QUESTION_TIME_SECONDS, GRADE_THRESHOLDS,
  TIER_XP, QUESTIONS_PER_SESSION,
} from "./constants";

export function computeXP(xpReward:number, correct:number, total:number, isDaily=false):number {
  if (total===0||correct===0) return 0;
  const base = Math.round(xpReward*Math.min(correct/total,1));
  return isDaily ? base*DAILY_XP_MULTIPLIER : base;
}

export function computeSpeedBonus(timeTakenS:number, questionXP:number, wasCorrect:boolean):number {
  if (!wasCorrect || timeTakenS<=0) return 0;
  const maxBonus = Math.round((questionXP/QUESTIONS_PER_SESSION)*SPEED_BONUS_MAX_PCT);
  if (timeTakenS<=SPEED_BONUS_FULL_THRESHOLD_S) return maxBonus;
  if (timeTakenS>=QUESTION_TIME_SECONDS) return 0;
  const range=QUESTION_TIME_SECONDS-SPEED_BONUS_FULL_THRESHOLD_S;
  const elapsed=timeTakenS-SPEED_BONUS_FULL_THRESHOLD_S;
  return Math.round(maxBonus*(1-elapsed/range));
}

export function computeTotalSpeedBonus(answers:Array<{is_correct:boolean;time_taken_s?:number}>, challengeXP:number):number {
  return answers.reduce((sum,a)=>sum+computeSpeedBonus(a.time_taken_s??QUESTION_TIME_SECONDS, challengeXP, a.is_correct),0);
}

// Splits xpReward evenly across totalQuestions, handing any remainder to the
// earliest tier_orders so the shares always sum to exactly xpReward.
export function questionXpShare(xpReward:number, tierOrder:number, totalQuestions:number):number {
  if (totalQuestions<=0) return 0;
  const base=Math.floor(xpReward/totalQuestions);
  const remainder=xpReward%totalQuestions;
  return base+(tierOrder<remainder ? 1 : 0);
}

// Anti-farming: XP for a newly-correct question halves with each retry of
// the same challenge. attemptNumber is 1 for the first-ever attempt.
export function retryDecayRate(attemptNumber:number):number {
  return Math.pow(0.5, Math.max(0,attemptNumber-1));
}

export function scoreToGrade(score:number, total:number):Grade {
  if (total===0) return "F";
  const ratio=score/total;
  if (ratio>=GRADE_THRESHOLDS.A) return "A";
  if (ratio>=GRADE_THRESHOLDS.B) return "B";
  if (ratio>=GRADE_THRESHOLDS.C) return "C";
  return "F";
}
export function gradeLabel(g:Grade):string { return {A:"Excellent",B:"Good",C:"Passing",F:"Failed"}[g]; }
export function gradeColor(g:Grade):string { return {A:"#6fcf6f",B:"#5aade6",C:"#e6b84a",F:"#ff7070"}[g]; }

export function xpToTier(xp:number):Tier {
  if (xp>=TIER_XP.Master) return "Master";
  if (xp>=TIER_XP.Platinum) return "Platinum";
  if (xp>=TIER_XP.Gold) return "Gold";
  if (xp>=TIER_XP.Silver) return "Silver";
  return "Bronze";
}
export function xpToNextTier(currentXP:number):{next:Tier;needed:number;progress:number} {
  const tiers:Tier[]=["Bronze","Silver","Gold","Platinum","Master"];
  const current=xpToTier(currentXP);
  const idx=tiers.indexOf(current);
  if (current==="Master") return { next:"Master", needed:0, progress:100 };
  const next=tiers[idx+1] as Tier;
  const currentFloor=TIER_XP[current], nextFloor=TIER_XP[next];
  return { next, needed: nextFloor-currentXP, progress: Math.round(((currentXP-currentFloor)/(nextFloor-currentFloor))*100) };
}
export function tierIcon(t:Tier):string { return {Bronze:"🥉",Silver:"🥈",Gold:"🥇",Platinum:"💎",Master:"👑"}[t]; }
export function tierColors(t:Tier):{bg:string;color:string;border:string} {
  return {
    Bronze:{bg:"#2a1a08",color:"#CD7F32",border:"#7a4a18"}, Silver:{bg:"#1e1e1e",color:"#A8A9AD",border:"#555"},
    Gold:{bg:"#2a2008",color:"#EF9F27",border:"#7a5a18"}, Platinum:{bg:"#1a1a2e",color:"#8888cc",border:"#444488"},
    Master:{bg:"#2a1208",color:"#E85D24",border:"#883318"},
  }[t];
}

export function nextTierIndex(current:number, wasCorrect:boolean):number {
  if (wasCorrect && current<DIFFICULTIES.length-1) return current+1;
  if (!wasCorrect && current>0) return current-1;
  return current;
}
export function tierToDifficulty(tier:number):Difficulty {
  return DIFFICULTIES[Math.max(0,Math.min(tier,DIFFICULTIES.length-1))] as Difficulty;
}

export function getInitials(name:string):string {
  const r=(name??"").trim().split(/\s+/).map(w=>w[0]??"").join("").toUpperCase().slice(0,2);
  return r||"??";
}
export function formatXP(xp:number):string { return xp>=1000 ? `${(xp/1000).toFixed(1)}k` : String(xp); }
export function calcAccuracy(correct:number, total:number):number { return total===0?0:Math.round((correct/total)*100); }
export function computeSpeedScore(avgTimeTakenS:number):number {
  if (avgTimeTakenS<=0) return 0;
  return Math.max(0,Math.min(100,Math.round(100*(1-avgTimeTakenS/QUESTION_TIME_SECONDS))));
}
export function safeJsonParse<T=unknown>(value:unknown):T|null {
  if (typeof value!=="string") return (value as T)??null;
  try { return JSON.parse(value) as T; } catch { return null; }
}
export function sanitizeQuestionsForClient<T extends {correct_index:number}>(qs:T[]):Omit<T,"correct_index">[] {
  return qs.map(({correct_index:_d,...rest})=>rest);
}
export function getClientIP(req:IncomingMessage):string {
  const fwd=req.headers["x-forwarded-for"];
  if (fwd) { const first=Array.isArray(fwd)?fwd[0]:fwd; return first.split(",")[0]?.trim()??"unknown"; }
  return (req.socket as {remoteAddress?:string}).remoteAddress??"unknown";
}
