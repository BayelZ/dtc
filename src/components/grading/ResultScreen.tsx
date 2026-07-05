import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { XPBurst } from "@/components/ui/XPBurst";
import { GradeBadge } from "./GradeBadge";
import { TierBadge } from "./TierBadge";
import { TierProgress } from "./TierProgress";
import type { AnswerRecord, Grade, Tier } from "@/lib/supabase/types";
import { gradeLabel, gradeColor } from "@/lib/utils";

interface ResultScreenProps {
  correctCount:number; totalQuestions:number; xpEarned:number; speedBonus:number;
  grade:Grade; tier:Tier; tierUp:boolean; newTotalXP:number;
  answers:AnswerRecord[]; onRetry:()=>void; onBack:()=>void;
}

export const ResultScreen:React.FC<ResultScreenProps> = ({correctCount,totalQuestions,xpEarned,speedBonus,grade,tier,tierUp,newTotalXP,answers,onRetry,onBack}) => {
  const [showBurst,setShowBurst]=useState(xpEarned+speedBonus>0);
  const totalXP=xpEarned+speedBonus;
  const emoji=grade==="A"?"🏆":grade==="B"?"👍":grade==="C"?"📚":"🔧";
  const gColor=gradeColor(grade);

  return (
    <div style={{maxWidth:520,margin:"0 auto"}}>
      {showBurst && <XPBurst amount={totalXP} onDone={()=>setShowBurst(false)} />}

      {tierUp && (
        <div style={{background:"#2a1208",border:"0.5px solid #E85D24",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🎉</span>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:"#E85D24",margin:0}}>Tier up!</p>
            <p style={{fontSize:13,color:"#888",margin:0}}>You reached <strong style={{color:"#f0f0f0"}}>{tier}</strong> tier</p>
          </div>
          <div style={{marginLeft:"auto"}}><TierBadge tier={tier} size="lg" showLabel animated /></div>
        </div>
      )}

      <Card style={{textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:16}}>
          <GradeBadge grade={grade} size="lg" />
          <div style={{textAlign:"left"}}>
            <p style={{fontSize:22,margin:0}}>{emoji}</p>
            <p style={{fontSize:18,fontWeight:500,margin:0,color:gColor}}>{gradeLabel(grade)}</p>
            <p style={{fontSize:13,color:"#888",margin:0}}>{correctCount} / {totalQuestions} correct</p>
          </div>
        </div>

        {totalXP>0 && (
          <div style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:speedBonus>0?6:0}}>
              <span style={{fontSize:13,color:"#888"}}>Base XP</span><span style={{fontSize:13,fontWeight:500}}>+{xpEarned}</span>
            </div>
            {speedBonus>0 && (
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13,color:"#e6b84a"}}>⚡ Speed bonus</span><span style={{fontSize:13,fontWeight:500,color:"#e6b84a"}}>+{speedBonus}</span>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",borderTop:"0.5px solid #2e2e2e",paddingTop:8,marginTop:4}}>
              <span style={{fontSize:14,fontWeight:600,color:"#f0f0f0"}}>Total</span><span style={{fontSize:18,fontWeight:700,color:"#E85D24"}}>+{totalXP} XP</span>
            </div>
          </div>
        )}

        <div style={{marginBottom:16,textAlign:"left"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <TierBadge tier={tier} size="sm" showLabel /><span style={{fontSize:12,color:"#888"}}>{newTotalXP.toLocaleString()} total XP</span>
          </div>
          <TierProgress xp={newTotalXP} />
        </div>

        <div style={{marginBottom:18,textAlign:"left"}}>
          {answers.map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"0.5px solid #2e2e2e"}}>
              <span style={{fontSize:12,color:a.is_correct?"#6fcf6f":"#ff7070",minWidth:14}}>{a.is_correct?"✓":"✗"}</span>
              <span style={{fontSize:12,color:"#888"}}>Q{i+1} — {["Easy","Medium","Hard"][a.tier_order]??"—"}</span>
              {a.time_taken_s!=null && a.is_correct && a.time_taken_s<=10 && <span style={{fontSize:10,color:"#e6b84a",marginLeft:4}}>⚡ fast</span>}
              {a.selected===-1 && <span style={{fontSize:11,color:"#ff7070",marginLeft:"auto"}}>Time expired</span>}
              {a.time_taken_s!=null && a.selected!==-1 && <span style={{fontSize:11,color:"#555",marginLeft:"auto"}}>{a.time_taken_s}s</span>}
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:10}}>
          <Button variant="ghost" style={{flex:1}} onClick={onBack}>More challenges</Button>
          <Button style={{flex:1}} onClick={onRetry}>Retry</Button>
        </div>
      </Card>
    </div>
  );
};
