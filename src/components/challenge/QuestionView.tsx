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
    <div style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:10,padding:"1.25rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{display:"flex",gap:4}}>
          {Array.from({length:QUESTIONS_PER_SESSION}).map((_,i)=>(
            <div key={i} style={{width:28,height:4,borderRadius:2,background:i<questionNum-1?"#E85D24":i===questionNum-1?"#5a2e12":"#2e2e2e",border:i===questionNum-1?"0.5px solid #E85D24":"none"}} />
          ))}
        </div>
        <div style={{flex:1}}>
          {!answered
            ? <Timer key={question.id} seconds={QUESTION_TIME_SECONDS} onExpire={handleExpire} />
            : <span style={{fontSize:11,color:"#555"}}>Q{questionNum} of {QUESTIONS_PER_SESSION}</span>
          }
        </div>
        <Badge label={difficulty} variant="difficulty" />
      </div>

      <p style={{fontSize:15,fontWeight:500,margin:"0 0 14px",lineHeight:1.6,color:"#f0f0f0"}}>{question.question_text}</p>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(question.options??[]).map((opt,i)=>{
          const isSelected=selected===i, isCorrect=answered&&result!=null&&i===result.correctIndex, isWrong=answered&&isSelected&&result!=null&&!result.isCorrect;
          let bg="#242424",border="#2e2e2e",color="#f0f0f0";
          if (answered) { if(isCorrect){bg="#1a2e1a";border="#2d5a2d";color="#6fcf6f";} else if(isWrong){bg="#2e1a1a";border="#5a2d2d";color="#ff7070";} else color="#555"; }
          else if (isSelected) { bg="#2a1a12";border="#E85D24";color="#ff7a45"; }
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

      {timedOut && <div style={{background:"#2e1a1a",border:"0.5px solid #5a2d2d",borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#ff7070"}}>Time expired on this question.</div>}

      {answered && result && (
        <div style={{background:"#242424",border:`0.5px solid ${result.isCorrect?"#2d5a2d":"#5a2d2d"}`,borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#888",lineHeight:1.6}}>
          <span style={{fontWeight:500,color:result.isCorrect?"#6fcf6f":"#ff7070"}}>{result.isCorrect?"Correct — ":"Incorrect — "}</span>
          {result.explanation}
          {!result.isCorrect && <p style={{margin:"8px 0 0",fontSize:12,color:"#6fcf6f"}}>Correct answer: {String.fromCharCode(65+result.correctIndex)}. {question.options[result.correctIndex]}</p>}
        </div>
      )}

      {answered && (
        <button onClick={onNext} style={{width:"100%",padding:"10px",background:"#E85D24",color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:500,cursor:"pointer"}}>
          {isLastQ?"See results":"Next question"}
        </button>
      )}
    </div>
  );
};
