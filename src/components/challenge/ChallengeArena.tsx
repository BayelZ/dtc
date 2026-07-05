import React, { useState, useCallback, useEffect } from "react";
import { QuestionView } from "./QuestionView";
import { ResultScreen } from "@/components/grading/ResultScreen";
import { useAttempt } from "@/hooks/useAttempt";
import { useChallenges } from "@/hooks/useChallenges";
import type { Challenge, SafeQuestion } from "@/lib/supabase/types";
import type { AnswerResult } from "@/hooks/useAttempt";

export const ChallengeArena:React.FC<{challenge:Challenge;onBack:()=>void;onComplete?:(xp:number)=>void}> = ({challenge,onBack,onComplete}) => {
  const { fetchQuestions } = useChallenges();
  const attempt = useAttempt();
  const [questions,setQs]=useState<SafeQuestion[]>([]);
  const [loadingQs,setLdg]=useState(true);
  const [fetchErr,setFErr]=useState<string|null>(null);
  const [result,setResult]=useState<AnswerResult|null>(null);

  useEffect(()=>{
    let cancelled=false;
    fetchQuestions(challenge.id).then(qs=>{ if(!cancelled){setQs(qs);setLdg(false);} }).catch(e=>{ if(!cancelled){setFErr(e.message??"Failed to load questions.");setLdg(false);} });
    return ()=>{ cancelled=true; };
  },[challenge.id,fetchQuestions]);

  useEffect(()=>{ if (!loadingQs && !fetchErr && attempt.status==="idle") attempt.startAttempt(challenge.id); },[loadingQs,fetchErr]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ if (attempt.status==="finishing") attempt.finish(); },[attempt.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ if (attempt.status==="done" && attempt.finishResult) onComplete?.(attempt.finishResult.xpEarned+attempt.finishResult.speedBonus); },[attempt.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQ = questions[Math.min(attempt.currentTier, questions.length-1)];
  const handleAnswer = useCallback(async(idx:number)=>{ if(!currentQ) return; try { setResult(await attempt.submitAnswer(currentQ,idx)); } catch { /* error in attempt.error */ } },[currentQ,attempt]);
  const handleTimeout = useCallback(async()=>{ if(!currentQ) return; try { setResult(await attempt.handleTimeout(currentQ)); } catch { /* error in attempt.error */ } },[currentQ,attempt]);
  const handleNext = useCallback(()=>{ const wasCorrect=result?.isCorrect??false; setResult(null); attempt.advance(wasCorrect); },[result,attempt]);
  const handleRetry = useCallback(()=>{ attempt.reset(); setResult(null); attempt.startAttempt(challenge.id); },[challenge.id,attempt]);

  const Header = (
    <div style={{marginBottom:16}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"#888",cursor:"pointer",padding:"0 0 12px"}}>← Back to challenges</button>
      <div style={{borderBottom:"0.5px solid #2e2e2e",paddingBottom:12}}>
        <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 4px",color:"#f0f0f0"}}>{challenge.title}</h2>
        <p style={{fontSize:13,color:"#888",margin:0,lineHeight:1.5}}>{challenge.description}</p>
      </div>
    </div>
  );

  if (loadingQs||attempt.status==="idle"||attempt.status==="starting") return <div style={{maxWidth:640,margin:"0 auto"}}>{Header}<p style={{textAlign:"center",color:"#888",padding:"2rem"}}>Loading challenge…</p></div>;
  if (fetchErr||attempt.error) return <div style={{maxWidth:640,margin:"0 auto"}}>{Header}<p style={{textAlign:"center",color:"#ff7070",padding:"2rem"}}>{fetchErr??attempt.error}</p><button onClick={onBack} style={{display:"block",margin:"0 auto",background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:13}}>← Go back</button></div>;

  if (attempt.status==="done" && attempt.finishResult) {
    const fr = attempt.finishResult;
    return (
      <div style={{maxWidth:640,margin:"0 auto"}}>
        {Header}
        <ResultScreen
          correctCount={attempt.correctCount} totalQuestions={3}
          xpEarned={fr.xpEarned} speedBonus={fr.speedBonus} grade={fr.grade}
          tier={fr.tier} tierUp={fr.tierUp} newTotalXP={fr.newTotalXP}
          answers={attempt.answers} onRetry={handleRetry} onBack={onBack}
        />
      </div>
    );
  }

  if (attempt.status==="finishing"||attempt.status==="done") return <div style={{maxWidth:640,margin:"0 auto"}}>{Header}<p style={{textAlign:"center",color:"#888",padding:"2rem"}}>Saving results…</p></div>;
  if (!currentQ) return null;

  return (
    <div style={{maxWidth:640,margin:"0 auto"}}>
      {Header}
      <QuestionView question={currentQ} tierIndex={attempt.currentTier} questionNum={attempt.questionIndex+1} selected={attempt.selected} answered={attempt.status==="answered"} timedOut={attempt.timedOut} result={result} onAnswer={handleAnswer} onTimeout={handleTimeout} onNext={handleNext} loading={attempt.loading} />
    </div>
  );
};
