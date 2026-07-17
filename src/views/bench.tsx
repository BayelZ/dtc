import React, { useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/lib/constants";
import type { ComebackAnswerResult, ComebackQueueItem } from "@/lib/supabase/types";

// The Rework Bench — the Comeback Pile's own world. Blueprint blue, soapstone
// ink, primer oxide reserved for "still on the pile". No timer, no XP: the one
// room in the app where thinking slowly is the point. Amber never enters.
const B = {
  ground:"#0C2740", card:"#0F2F4D", line:"#1E4568",
  ink:"#E9EEF2", ink2:"#8FB0C4", ink3:"#AFC5D2",
  oxide:"#B0523B", oxideInk:"#C9705A", oxideWash:"rgba(176,82,59,0.12)",
  inkWash:"rgba(233,238,242,0.07)",
};
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const BLACK = "'Arial Black','Archivo Black','Helvetica Neue',Arial,sans-serif";

interface QueueResponse { items:ComebackQueueItem[]; open_total:number; cleared_total:number; }

export const ReworkBench:React.FC<{onExit:()=>void}> = ({onExit}) => {
  const [queue,setQueue]=useState<QueueResponse|null>(null);
  const [loadError,setLoadError]=useState(false);
  const [idx,setIdx]=useState(0);
  const [selected,setSelected]=useState<number|null>(null);
  const [result,setResult]=useState<ComebackAnswerResult|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [sessionCleared,setSessionCleared]=useState(0);
  const [done,setDone]=useState(false);
  const [visible,setVisible]=useState(false);

  const loadQueue=useCallback(async()=>{
    setLoadError(false);
    try {
      const res=await fetch(ROUTES.api.comebackQueue);
      if (!res.ok) throw new Error(String(res.status));
      setQueue(await res.json() as QueueResponse);
      setIdx(0); setSelected(null); setResult(null); setDone(false);
    } catch { setLoadError(true); }
  },[]);
  useEffect(()=>{ void loadQueue(); },[loadQueue]);

  // entry crossfade — skipped when the user prefers reduced motion
  useEffect(()=>{
    const reduce=typeof window!=="undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setVisible(true); return; }
    const t=setTimeout(()=>setVisible(true),20);
    return ()=>clearTimeout(t);
  },[]);

  const item=queue?.items[idx]??null;
  const answered=result!==null;

  const submit=useCallback(async(i:number)=>{
    if (!item||answered||submitting) return;
    setSubmitting(true); setSelected(i);
    try {
      const res=await fetch(ROUTES.api.comebackAnswer,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question_id:item.question.id,selected:i})});
      if (!res.ok) throw new Error(String(res.status));
      const r=await res.json() as ComebackAnswerResult;
      setResult(r);
      if (r.is_correct) setSessionCleared(n=>n+1);
    } catch { setSelected(null); }
    finally { setSubmitting(false); }
  },[item,answered,submitting]);

  const next=useCallback(()=>{
    if (!queue) return;
    if (idx+1>=queue.items.length) setDone(true);
    else { setIdx(idx+1); setSelected(null); setResult(null); }
  },[queue,idx]);

  const openRemaining=result?.open_remaining ?? queue?.open_total ?? 0;

  const shellStyle:React.CSSProperties={
    position:"fixed",inset:0,zIndex:50,overflowY:"auto",background:B.ground,color:B.ink,
    backgroundImage:"radial-gradient(130% 100% at 50% 0%, rgba(233,238,242,.045), transparent 60%),"+
      "repeating-linear-gradient(0deg, rgba(233,238,242,.022) 0 1px, transparent 1px 26px),"+
      "repeating-linear-gradient(90deg, rgba(233,238,242,.022) 0 1px, transparent 1px 26px)",
    opacity:visible?1:0,transition:"opacity 250ms ease",fontFamily:MONO,
  };

  return (
    <div style={shellStyle}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"28px 18px 60px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8,marginBottom:22}}>
          <span style={{fontFamily:BLACK,fontWeight:900,fontSize:24,letterSpacing:".02em",textTransform:"uppercase"}}>Comeback Pile</span>
          <span style={{fontSize:11,letterSpacing:".2em",textTransform:"uppercase",color:B.ink2}}>
            No clock · No XP · {openRemaining} on the bench
          </span>
        </div>

        {loadError && (
          <div style={{border:`1px solid ${B.line}`,borderRadius:6,padding:"18px",background:B.card}}>
            <p style={{margin:"0 0 12px",color:B.ink3,fontFamily:"inherit"}}>Couldn&apos;t reach the bench. Try again.</p>
            <button onClick={()=>void loadQueue()} style={btnPrimary}>Retry</button>
            <button onClick={onExit} style={btnGhost}>Back to the shop</button>
          </div>
        )}

        {!loadError && queue && queue.items.length===0 && (
          <div style={{border:`1px dashed ${B.ink2}`,borderRadius:6,padding:"34px 22px",textAlign:"center",background:B.card}}>
            <p style={{fontFamily:BLACK,fontWeight:900,fontSize:20,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:".04em"}}>No comebacks.</p>
            <p style={{margin:"0 0 20px",color:B.ink2,fontSize:13}}>The way it should be.</p>
            <button onClick={onExit} style={btnPrimary}>Back to the shop</button>
          </div>
        )}

        {!loadError && !done && item && (
          <div style={{background:B.card,border:`1px solid ${B.line}`,borderRadius:6,padding:"18px 18px 16px",position:"relative",boxShadow:"0 10px 26px rgba(3,12,22,.45)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:11,letterSpacing:".14em",textTransform:"uppercase",color:B.ink2,marginBottom:12,paddingRight:answered?130:0}}>
              <span>Tag {idx+1} of {queue?.items.length} · {item.question.challenge_title}</span>
              <span style={{color:B.oxideInk}}>Came back ×{item.missed_count}</span>
            </div>

            <p style={{fontFamily:"-apple-system,'Segoe UI',Roboto,sans-serif",fontSize:16,fontWeight:600,lineHeight:1.5,margin:"0 0 14px",color:B.ink}}>
              {item.question.question_text}
            </p>

            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
              {(item.question.options??[]).map((opt,i)=>{
                const isSel=selected===i;
                const isRight=answered&&result!=null&&i===result.correct_index;
                const isWrong=answered&&isSel&&result!=null&&!result.is_correct;
                let border=B.line, color=B.ink3, bg="transparent";
                if (answered) {
                  if (isRight) { border=B.ink; color=B.ink; bg=B.inkWash; }
                  else if (isWrong) { border=B.oxide; color=B.oxideInk; bg=B.oxideWash; }
                  else color=B.ink2;
                } else if (isSel) { border=B.ink; color=B.ink; bg=B.inkWash; }
                return (
                  <div key={i} role="button" aria-pressed={isSel} aria-disabled={answered||submitting} tabIndex={answered?-1:0}
                    onClick={()=>void submit(i)} onKeyDown={e=>e.key==="Enter"&&void submit(i)}
                    style={{display:"flex",gap:10,alignItems:"baseline",border:`1px solid ${border}`,borderRadius:5,padding:"10px 12px",
                      background:bg,cursor:answered||submitting?"default":"pointer",outline:"none",
                      fontFamily:"-apple-system,'Segoe UI',Roboto,sans-serif",fontSize:14,lineHeight:1.5,color}}>
                    <span style={{fontFamily:MONO,fontSize:12,color:answered&&isRight?B.ink:B.ink2}}>{String.fromCharCode(65+i)}</span>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>

            {answered && result && (
              <div style={{borderLeft:`3px solid ${B.ink2}`,padding:"9px 12px",marginBottom:14,background:"rgba(143,176,196,.06)",
                fontFamily:"-apple-system,'Segoe UI',Roboto,sans-serif",fontSize:13.5,lineHeight:1.55,color:B.ink3}}>
                <span style={{fontWeight:600,color:B.ink}}>Why: </span>{result.explanation}
              </div>
            )}

            {answered && result && (
              <span aria-hidden style={{position:"absolute",top:10,right:14,transform:"rotate(-7deg)",
                border:`3px solid ${result.is_correct?B.ink:B.oxide}`,borderRadius:4,padding:".16em .5em",
                fontFamily:BLACK,fontWeight:900,fontSize:13,letterSpacing:".13em",textTransform:"uppercase",
                color:result.is_correct?B.ink:B.oxideInk,background:result.is_correct?B.inkWash:B.oxideWash}}>
                {result.is_correct?"Made right":"Still on the pile"}
              </span>
            )}

            {answered && (
              <button onClick={next} style={btnPrimary}>
                {idx+1>=(queue?.items.length??0)?"Wrap up":"Next tag"}
              </button>
            )}
          </div>
        )}

        {!loadError && done && (
          <div style={{background:B.card,border:`1px solid ${B.line}`,borderRadius:6,padding:"26px 22px",textAlign:"center"}}>
            <p style={{fontFamily:BLACK,fontWeight:900,fontSize:22,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:".03em"}}>
              {openRemaining===0?"Bench clear.":`${sessionCleared} made right.`}
            </p>
            <p style={{margin:"0 0 20px",color:B.ink2,fontSize:13}}>
              {openRemaining===0
                ? "No comebacks. The way it should be."
                : `${openRemaining} still on the pile — they'll keep.`}
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              {openRemaining>0 && <button onClick={()=>void loadQueue()} style={btnPrimary}>Keep working</button>}
              <button onClick={onExit} style={openRemaining>0?btnGhost:btnPrimary}>Back to the shop</button>
            </div>
          </div>
        )}

        <button onClick={onExit} aria-label="Leave the bench"
          style={{position:"absolute",top:26,right:18,background:"transparent",border:`1px solid ${B.line}`,borderRadius:5,
            color:B.ink2,fontFamily:MONO,fontSize:11,letterSpacing:".12em",textTransform:"uppercase",padding:"6px 10px",cursor:"pointer"}}>
          Exit
        </button>
      </div>
    </div>
  );
};

const btnPrimary:React.CSSProperties={
  background:B.ink,color:B.ground,border:"none",borderRadius:5,padding:"10px 18px",
  fontFamily:BLACK,fontWeight:900,fontSize:12.5,letterSpacing:".06em",textTransform:"uppercase",cursor:"pointer",
};
const btnGhost:React.CSSProperties={
  background:"transparent",color:B.ink2,border:`1px solid ${B.line}`,borderRadius:5,padding:"10px 18px",
  fontFamily:MONO,fontSize:12,letterSpacing:".08em",textTransform:"uppercase",cursor:"pointer",marginLeft:10,
};
