import React, { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { ROUTES, FLAG_REASON_LABELS } from "@/lib/constants";
import type { FlaggedQuestion } from "@/lib/supabase/types";

// Admin-only: disputes grouped by question, most open flags first. The API
// enforces is_admin server-side; hiding the nav item is cosmetic, not the gate.
export const DisputesPage:React.FC = () => {
  const [questions,setQuestions]=useState<FlaggedQuestion[]|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const { data:{session} } = await getSupabase().auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated.");
        const res=await fetch(ROUTES.api.adminFlags,{ credentials:"include", headers:{ "Authorization":`Bearer ${session.access_token}` } });
        const body=await res.json();
        if (!res.ok) throw new Error(body?.error??"Failed to load disputes.");
        if (!cancelled) setQuestions(body.questions);
      } catch(e) { if (!cancelled) setError(e instanceof Error?e.message:"Failed to load disputes."); }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  if (error) return <p style={{textAlign:"center",color:"var(--bad)",padding:"3rem 0"}}>{error}</p>;
  if (!questions) return <p style={{textAlign:"center",color:"var(--text-muted)",padding:"3rem 0"}}>Loading disputes…</p>;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Disputes</h1>
      <p style={{fontSize:13,color:"var(--text-muted)",margin:"0 0 1.5rem"}}>
        {questions.length===0?"Nothing on file.":`${questions.length} question${questions.length===1?"":"s"} under dispute — most open flags first`}
      </p>
      {questions.map(q=>(
        <div key={q.question_id} style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"16px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8,flexWrap:"wrap"}}>
            {q.open_count>0 && <span style={{fontSize:11,fontWeight:700,background:"var(--bad-bg)",color:"var(--bad)",border:"0.5px solid var(--bad-border)",padding:"2px 8px",borderRadius:4}}>{q.open_count} open</span>}
            <span style={{fontSize:12,color:"var(--text-faint)"}}>{q.challenge_title}</span>
          </div>
          <p style={{fontSize:14,fontWeight:500,margin:"0 0 10px",lineHeight:1.6}}>{q.question_text}</p>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
            {q.options.map((opt,i)=>(
              <div key={i} style={{fontSize:12,lineHeight:1.5,color:i===q.correct_index?"var(--good)":"var(--text-muted)",fontWeight:i===q.correct_index?600:400}}>
                {String.fromCharCode(65+i)}. {opt}{i===q.correct_index?" ✓":""}
              </div>
            ))}
          </div>
          {q.explanation && <p style={{fontSize:12,color:"var(--text-faint)",margin:"0 0 12px",lineHeight:1.6}}>{q.explanation}</p>}
          <div style={{borderTop:"0.5px solid var(--border)",paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
            {q.flags.map(f=>(
              <div key={f.id} style={{fontSize:12,lineHeight:1.6}}>
                <span style={{fontWeight:600,color:f.status==="open"?"var(--gold)":"var(--text-faint)"}}>{FLAG_REASON_LABELS[f.reason]??f.reason}</span>
                <span style={{color:"var(--text-faint)"}}> — {f.flagger}, {new Date(f.created_at).toLocaleDateString()}{f.status!=="open"?` · ${f.status}`:""}</span>
                {f.comment && <div style={{color:"var(--text-muted)"}}>{f.comment}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
