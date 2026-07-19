import React, { useCallback } from "react";
import { Timer } from "@/components/ui/Timer";
import { Badge } from "@/components/ui/Badge";
import { QUESTION_TIME_SECONDS, QUESTIONS_PER_SESSION } from "@/lib/constants";
import type { SafeQuestion } from "@/lib/supabase/types";
import type { AnswerResult } from "@/hooks/useAttempt";

interface QVProps { question:SafeQuestion; questionNum:number; selected:number|null; answered:boolean; timedOut:boolean; result:AnswerResult|null; onAnswer:(i:number)=>void; onTimeout:()=>void; onNext:()=>void; loading:boolean; }

export const QuestionView:React.FC<QVProps> = ({question,questionNum,selected,answered,timedOut,result,onAnswer,onTimeout,onNext,loading}) => {
  const difficulty=question.difficulty;
  const isLastQ=questionNum>=QUESTIONS_PER_SESSION;
  const handleExpire=useCallback(()=>{ if (!answered) onTimeout(); },[answered,onTimeout]);

  return (
    <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"1.25rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{display:"flex",gap:4}}>
          {Array.from({length:QUESTIONS_PER_SESSION}).map((_,i)=>(
            <div key={i} style={{width:28,height:4,borderRadius:2,background:i<questionNum-1?"var(--accent)":i===questionNum-1?"color-mix(in srgb, var(--accent) 35%, var(--bg))":"var(--border)",border:i===questionNum-1?"0.5px solid var(--accent)":"none"}} />
          ))}
        </div>
        <div style={{flex:1}}>
          {!answered
            ? <Timer key={question.id} seconds={QUESTION_TIME_SECONDS} onExpire={handleExpire} />
            : <span style={{fontSize:11,color:"var(--text-faint)"}}>Q{questionNum} of {QUESTIONS_PER_SESSION}</span>
          }
        </div>
        <Badge label={difficulty} variant="difficulty" />
      </div>

      <p style={{fontSize:15,fontWeight:500,margin:"0 0 14px",lineHeight:1.6,color:"var(--text)"}}>{question.question_text}</p>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(question.options??[]).map((opt,i)=>{
          const isSelected=selected===i, isCorrect=answered&&result!=null&&i===result.correctIndex, isWrong=answered&&isSelected&&result!=null&&!result.isCorrect;
          let bg="var(--bg-raised)",border="var(--border)",color="var(--text)";
          if (answered) { if(isCorrect){bg="var(--good-bg)";border="var(--good-border)";color="var(--good)";} else if(isWrong){bg="var(--bad-bg)";border="var(--bad-border)";color="var(--bad)";} else color="var(--text-faint)"; }
          else if (isSelected) { bg="var(--accent-tint)";border="var(--accent)";color="var(--accent-hi)"; }
          return (
            <div key={i} role="button" aria-pressed={isSelected} aria-disabled={answered||loading} tabIndex={answered?-1:0}
              onClick={()=>!answered&&!loading&&onAnswer(i)} onKeyDown={e=>e.key==="Enter"&&!answered&&!loading&&onAnswer(i)}
              style={{padding:"10px 14px",borderRadius:6,border:`0.5px solid ${border}`,background:bg,cursor:answered||loading?"default":"pointer",fontSize:13,color,lineHeight:1.5,outline:"none"}}>
              <span style={{fontWeight:500,marginRight:8,opacity:0.6}}>{String.fromCharCode(65+i)}.</span>{opt}
              {answered&&isCorrect&&<span style={{float:"right"}}>✓</span>}
              {answered&&isWrong&&<span style={{float:"right"}}>✗</span>}
            </div>
          );
        })}
      </div>

      {timedOut && <div style={{background:"var(--bad-bg)",border:"0.5px solid var(--bad-border)",borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:12,color:"var(--bad)"}}>Time expired on this question.</div>}

      {answered && result && (
        <div style={{background:"var(--bg-raised)",border:`0.5px solid ${result.isCorrect?"var(--good-border)":"var(--bad-border)"}`,borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--text-muted)",lineHeight:1.6}}>
          <span style={{fontWeight:500,color:result.isCorrect?"var(--good)":"var(--bad)"}}>{result.isCorrect?"Correct — ":"Incorrect — "}</span>
          {result.explanation}
          {!result.isCorrect && <p style={{margin:"8px 0 0",fontSize:12,color:"var(--good)"}}>Correct answer: {String.fromCharCode(65+result.correctIndex)}. {question.options[result.correctIndex]}</p>}
        </div>
      )}

      {answered && (
        <button onClick={onNext} style={{width:"100%",padding:"10px",background:"var(--accent)",color:"var(--accent-contrast)",border:"none",borderRadius:6,fontSize:13,fontWeight:500,cursor:"pointer"}}>
          {isLastQ?"See results":"Next question"}
        </button>
      )}
    </div>
  );
};
