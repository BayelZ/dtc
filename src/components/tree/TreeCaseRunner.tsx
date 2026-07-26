import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ClientTree } from "@/lib/tree/engine";
import type { DiagNode } from "@/lib/tree/types";
import { gradeLabel, gradeColor } from "@/lib/utils";
import type { Grade, TreeOutcome } from "@/lib/supabase/types";

// Production diagnostic-tree runner. Unlike the /tree-pilot prototype, this holds NO answer key
// and computes NO score: the server draws the fault, releases each reading only as the tech
// performs that step, and scores the finished run. This component just renders and reports.

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

interface LogEntry { kind:"did"|"found"|"quiz-ok"|"quiz-bad"; text:string; time?:number }
interface FinishResult {
  outcome:TreeOutcome; fixed:boolean; process_score:number; grade:Grade; xp_earned:number;
  xp_before_decay:number; repeat_number:number; knowledge_correct:number; knowledge_total:number;
  time_minutes:number; node_id:string; new_total_xp:number; tier:string; tier_up:boolean;
}

const OUTCOME_COPY:Record<TreeOutcome,{tag:string;headline:string;good:boolean}> = {
  clean:{tag:"Fixed right",headline:"Clean diagnosis",good:true},
  lucky:{tag:"Fixed — got lucky",headline:"Fixed, but never proven",good:true},
  comeback:{tag:"Comeback",headline:"Back to the Rework Bench",good:false},
  masked:{tag:"Masked — comes back worse",headline:"You blindfolded it, didn't fix it",good:false},
};

export const TreeCaseRunner:React.FC<{slug:string;onBack:()=>void;onXP:(xp:number)=>void}> = ({slug,onBack,onXP}) => {
  const [tree,setTree]=useState<ClientTree|null>(null);
  const [attemptId,setAttemptId]=useState<string|null>(null);
  const [nodeId,setNodeId]=useState<string|null>(null);
  const [reading,setReading]=useState<string|null>(null);
  const [log,setLog]=useState<LogEntry[]>([]);
  const [timeSpent,setTimeSpent]=useState(0);
  const [result,setResult]=useState<FinishResult|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const started=useRef(false);

  const start=useCallback(async()=>{
    setBusy(true); setError(null);
    try {
      const r=await fetch("/api/tree/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug})});
      const d=await r.json();
      if (!r.ok) throw new Error(d.error??"Could not start this case.");
      setTree(d.tree); setAttemptId(d.attempt_id); setNodeId(d.node_id);
      setReading(null); setLog([]); setTimeSpent(0); setResult(null);
    } catch(e){ setError(e instanceof Error?e.message:"Could not start this case."); }
    finally { setBusy(false); }
  },[slug]);

  // Strict-mode safe: only ever start one attempt per mount.
  useEffect(()=>{ if(started.current) return; started.current=true; void start(); },[start]);

  const node:DiagNode|undefined = tree&&nodeId ? tree.nodes.find(n=>n.id===nodeId) : undefined;

  const finish=useCallback(async(id:string)=>{
    const r=await fetch("/api/tree/finish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({attempt_id:id})});
    const d=await r.json();
    if (!r.ok) { setError(d.error??"Could not score this run."); return; }
    setResult(d); if (d.xp_earned>0) onXP(d.xp_earned);
  },[onXP]);

  const choose=useCallback(async(option:number,label:string)=>{
    if (!attemptId||!nodeId||busy) return;
    setBusy(true); setError(null);
    const wasQuiz=node?.type==="quiz";
    try {
      const r=await fetch("/api/tree/step",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({attempt_id:attemptId,from_node_id:nodeId,option})});
      const d=await r.json();
      if (!r.ok) throw new Error(d.error??"That move isn't available.");
      const next:LogEntry[]=[];
      if (wasQuiz&&d.quiz) {
        next.push({kind:d.quiz.correct?"quiz-ok":"quiz-bad",
          text:d.quiz.correct?label:`${label}${d.quiz.explanation?` — ${d.quiz.explanation}`:""}`});
      } else next.push({kind:"did",text:label});
      const spent=d.time_spent-timeSpent;
      if (spent>0) next.push({kind:"did",text:"— logged",time:spent});
      if (d.reading) next.push({kind:"found",text:d.reading});
      setLog(l=>[...l,...next]);
      setTimeSpent(d.time_spent); setNodeId(d.node_id); setReading(d.reading??null);
      if (d.done) await finish(attemptId);
    } catch(e){ setError(e instanceof Error?e.message:"Something went wrong."); }
    finally { setBusy(false); }
  },[attemptId,nodeId,node,busy,timeSpent,finish]);

  if (error&&!tree) return (
    <div style={{padding:"2rem",textAlign:"center"}}>
      <p style={{color:"var(--bad)",marginBottom:12}}>{error}</p>
      <button onClick={onBack} style={btn}>Back to challenges</button>
    </div>
  );
  if (!tree||!node) return <p style={{color:"var(--text-muted)",padding:"2rem"}}>Loading case…</p>;

  const budget=tree.scoringRules.timeBudgetMinutes;
  const isQuiz=node.type==="quiz";
  const oc=result?OUTCOME_COPY[result.outcome]:null;

  return (
    <div>
      <button onClick={onBack} style={{...btn,marginBottom:14}}>← Back</button>
      <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:20,alignItems:"start"}}>
        <div>
          <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"16px 18px",marginBottom:16}}>
            <div style={{fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:"var(--accent)",fontWeight:600}}>Repair Order · Diagnostic Case</div>
            <h1 style={{fontSize:20,fontWeight:700,margin:"6px 0 2px",color:"var(--text)"}}>{tree.title}</h1>
            <div style={{fontSize:12,color:"var(--text-muted)",fontFamily:MONO}}>
              {tree.vehicle.year} {tree.vehicle.make} {tree.vehicle.model}{tree.vehicle.engine?` · ${tree.vehicle.engine}`:""}
            </div>
            <p style={{fontSize:13,color:"var(--text-dim)",margin:"10px 0 0",lineHeight:1.55}}>{tree.complaintTemplate}</p>
          </div>

          {!result ? (
            <div style={{background:"var(--bg-card)",border:`0.5px solid ${isQuiz?"var(--info)":"var(--border)"}`,borderLeft:isQuiz?"3px solid var(--info)":undefined,borderRadius:10,padding:"16px 18px"}}>
              {reading && (
                <div style={{background:"var(--bg-raised)",border:"0.5px solid var(--border)",borderLeft:"2px solid var(--accent)",borderRadius:6,padding:"10px 12px",marginBottom:14,fontFamily:MONO,fontSize:12.5,color:"var(--text)",lineHeight:1.5}}>
                  <span style={{color:"var(--text-muted)"}}>READOUT · </span>{reading}
                </div>
              )}
              {isQuiz && (
                <div style={{fontSize:10.5,letterSpacing:".16em",textTransform:"uppercase",color:"var(--info)",fontWeight:700,marginBottom:9}}>
                  ◎ Knowledge check<span style={{color:"var(--text-faint)",letterSpacing:0,textTransform:"none",fontWeight:500}}> · scored on know-how, not the fix</span>
                </div>
              )}
              <p style={{fontSize:15,fontWeight:500,color:"var(--text)",margin:"0 0 14px",lineHeight:1.5}}>{node.prompt}</p>
              {error && <p style={{fontSize:12.5,color:"var(--bad)",margin:"0 0 10px"}}>{error}</p>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(node.options??[]).map((o,i)=>{
                  const t=tree.nodes.find(n=>n.id===o.targetNodeId)?.timeCost??0;
                  return (
                    <button key={i} disabled={busy} onClick={()=>choose(i,o.label)}
                      style={{textAlign:"left",padding:"11px 13px",borderRadius:7,cursor:busy?"wait":"pointer",opacity:busy?0.6:1,
                        background:"var(--bg-raised)",color:"var(--text)",border:"0.5px solid var(--border)",font:"inherit",
                        fontSize:13.5,lineHeight:1.45,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                      {isQuiz
                        ? <span style={{display:"flex",gap:9}}><span style={{fontFamily:MONO,color:"var(--info)",fontWeight:700}}>{String.fromCharCode(65+i)}</span><span>{o.label}</span></span>
                        : <span>{o.label}</span>}
                      {!isQuiz&&t>0&&<span style={{fontFamily:MONO,fontSize:11,color:"var(--text-faint)",whiteSpace:"nowrap"}}>~{t}m</span>}
                    </button>
                  );
                })}
                {node.nextNodeId && (
                  <button disabled={busy} onClick={()=>choose(-1,node.continueLabel??"Continue")}
                    style={{textAlign:"left",padding:"11px 13px",borderRadius:7,cursor:busy?"wait":"pointer",opacity:busy?0.6:1,
                      background:"transparent",color:"var(--text-muted)",border:"0.5px dashed var(--border)",font:"inherit",fontSize:13.5,lineHeight:1.45}}>
                    {node.continueLabel??"Continue →"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{background:"var(--bg-card)",border:`0.5px solid ${oc!.good?"var(--good-border)":"var(--bad-border)"}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"14px 18px",background:oc!.good?"var(--good-bg)":"var(--bad-bg)",borderBottom:`0.5px solid ${oc!.good?"var(--good-border)":"var(--bad-border)"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div>
                    <div style={{fontSize:11,letterSpacing:".16em",textTransform:"uppercase",color:oc!.good?"var(--good)":"var(--bad)",fontWeight:700}}>{oc!.tag}</div>
                    <div style={{fontSize:17,fontWeight:800,color:"var(--text)",marginTop:3}}>{oc!.headline}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:MONO,fontSize:26,fontWeight:800,lineHeight:1,color:result.fixed?"var(--good)":"var(--bad)"}}>
                      {result.fixed?`+${result.xp_earned}`:"0"}<span style={{fontSize:13,fontWeight:700}}> XP</span>
                    </div>
                    <div style={{fontSize:10.5,letterSpacing:".08em",textTransform:"uppercase",color:"var(--text-faint)",fontWeight:600,marginTop:2}}>
                      {result.fixed?"Clean RO · streak intact":"Rework Bench +1 · 0 XP by design"}
                    </div>
                  </div>
                </div>
                <p style={{fontSize:14,color:"var(--text)",margin:"10px 0 0",lineHeight:1.5}}>
                  {tree.nodes.find(n=>n.id===result.node_id)?.prompt}
                </p>
              </div>
              <div style={{padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--text-faint)",fontWeight:600}}>Process report</span>
                  <span style={{display:"inline-flex",alignItems:"baseline",gap:8}}>
                    <span style={{fontFamily:MONO,fontSize:12,color:"var(--text-faint)"}}>{result.process_score}/100</span>
                    <span style={{fontSize:20,fontWeight:800,color:gradeColor(result.grade)}}>{result.grade}</span>
                    <span style={{fontSize:12,color:"var(--text-muted)"}}>{gradeLabel(result.grade)}</span>
                  </span>
                </div>
                {result.knowledge_total>0 && (
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderBottom:"0.5px solid var(--border)"}}>
                    <span style={{color:"var(--text-muted)"}}>Procedure knowledge</span>
                    <span style={{fontFamily:MONO,fontWeight:700}}>{result.knowledge_correct}/{result.knowledge_total}</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderBottom:"0.5px solid var(--border)"}}>
                  <span style={{color:"var(--text-muted)"}}>Time on the job</span>
                  <span style={{fontFamily:MONO,fontWeight:700}}>{result.time_minutes}m / {budget}m</span>
                </div>
                {result.repeat_number>1 && (
                  <p style={{fontSize:11.5,color:"var(--text-faint)",margin:"10px 0 0",lineHeight:1.5}}>
                    You&apos;ve solved this exact fault before — repeat XP is reduced ({result.xp_before_decay} → {result.xp_earned}).
                  </p>
                )}
                <p style={{fontSize:11.5,color:"var(--text-faint)",margin:"10px 0 0",lineHeight:1.5}}>
                  {result.fixed
                    ? "The grade sets how much a fixed RO pays. A flawless, evidence-proven fix pays full XP."
                    : "Your work is still graded — but a comeback pays no XP. The vehicle left broken."}
                </p>
                <div style={{display:"flex",gap:8,marginTop:16}}>
                  <button onClick={()=>{started.current=false;void start();}} style={{flex:1,padding:"10px",borderRadius:7,cursor:"pointer",background:"var(--accent)",color:"var(--accent-contrast)",border:"none",font:"inherit",fontSize:13,fontWeight:600}}>New case</button>
                  <button onClick={onBack} style={{flex:1,padding:"10px",borderRadius:7,cursor:"pointer",background:"var(--bg-raised)",color:"var(--text)",border:"0.5px solid var(--border)",font:"inherit",fontSize:13,fontWeight:500}}>Back to challenges</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{position:"sticky",top:12}}>
          <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
              <span style={{fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--text-faint)",fontWeight:600}}>Time on the job</span>
              <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:timeSpent>budget?"var(--bad)":"var(--text)"}}>{timeSpent}m / {budget}m</span>
            </div>
            <div style={{height:5,background:"var(--bg-raised)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:5,width:`${Math.min(100,(timeSpent/budget)*100)}%`,background:timeSpent>budget?"var(--bad)":"var(--accent)"}} />
            </div>
          </div>
          <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--text-faint)",fontWeight:600,marginBottom:8}}>Bench log</div>
            {log.length===0 && <p style={{fontSize:12,color:"var(--text-faint)",margin:0}}>Nothing done yet.</p>}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {log.map((e,i)=>{
                const isQ=e.kind==="quiz-ok"||e.kind==="quiz-bad";
                const accent=e.kind==="quiz-ok"?"var(--good)":e.kind==="quiz-bad"?"var(--bad)":"var(--accent)";
                return (
                  <div key={i} style={{fontSize:12,lineHeight:1.45,
                    color:e.kind==="found"||e.kind==="quiz-bad"?"var(--text)":"var(--text-muted)",
                    fontFamily:e.kind==="found"?MONO:undefined,
                    paddingLeft:e.kind==="found"||isQ?8:0,
                    borderLeft:e.kind==="found"||isQ?`2px solid ${accent}`:"none"}}>
                    {isQ&&<span style={{color:accent,fontWeight:700}}>{e.kind==="quiz-ok"?"✓ ":"✗ "}</span>}
                    {e.kind==="found"?e.text:<>{e.text}{e.time?<span style={{color:"var(--text-faint)"}}> ({e.time}m)</span>:null}</>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const btn:React.CSSProperties = {padding:"7px 13px",borderRadius:6,cursor:"pointer",background:"var(--bg-card)",color:"var(--text-muted)",border:"0.5px solid var(--border)",font:"inherit",fontSize:12.5};
