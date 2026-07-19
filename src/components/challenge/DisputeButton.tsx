import React, { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { ROUTES, FLAG_REASONS, FLAG_REASON_LABELS, FLAG_COMMENT_MAX_LENGTH } from "@/lib/constants";
import type { FlagReason } from "@/lib/supabase/types";

// Shown after a question is answered. Deadpan by design: a dispute is a claim
// against the answer key, not a support ticket.
export const DisputeButton:React.FC<{questionId:string}> = ({questionId}) => {
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState<FlagReason>("wrong_answer");
  const [comment,setComment]=useState("");
  const [state,setState]=useState<"idle"|"sending"|"sent"|"error">("idle");

  const file=async()=>{
    setState("sending");
    try {
      const { data:{session} } = await getSupabase().auth.getSession();
      if (!session?.access_token) throw new Error();
      const res=await fetch(ROUTES.api.questionFlag,{ method:"POST", credentials:"include",
        headers:{ "Authorization":`Bearer ${session.access_token}`, "Content-Type":"application/json" },
        body:JSON.stringify({question_id:questionId,reason,comment}) });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch { setState("error"); }
  };

  if (state==="sent") return <p style={{fontSize:11,color:"var(--text-faint)",margin:"0 0 12px"}}>Dispute filed. It goes to review with the question attached.</p>;

  if (!open) return (
    <button onClick={()=>setOpen(true)} style={{background:"none",border:"none",padding:0,margin:"0 0 12px",fontSize:11,color:"var(--text-faint)",cursor:"pointer",textDecoration:"underline",textUnderlineOffset:2}}>
      Dispute this question
    </button>
  );

  return (
    <div style={{border:"0.5px solid var(--border)",borderRadius:6,padding:"10px 12px",marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>
      <select value={reason} onChange={e=>setReason(e.target.value as FlagReason)}
        style={{background:"var(--bg-raised)",color:"var(--text)",border:"0.5px solid var(--border)",borderRadius:5,padding:"6px 8px",fontSize:12}}>
        {FLAG_REASONS.map(r=><option key={r} value={r}>{FLAG_REASON_LABELS[r]}</option>)}
      </select>
      <textarea value={comment} onChange={e=>setComment(e.target.value.slice(0,FLAG_COMMENT_MAX_LENGTH))} rows={2}
        placeholder="Evidence, if you have it (optional)"
        style={{background:"var(--bg-raised)",color:"var(--text)",border:"0.5px solid var(--border)",borderRadius:5,padding:"6px 8px",fontSize:12,resize:"vertical",fontFamily:"inherit"}} />
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={file} disabled={state==="sending"}
          style={{padding:"6px 14px",fontSize:12,fontWeight:500,background:"var(--bg-raised)",color:"var(--text)",border:"0.5px solid var(--border)",borderRadius:5,cursor:state==="sending"?"wait":"pointer"}}>
          {state==="sending"?"Filing…":"File dispute"}
        </button>
        <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",fontSize:12,color:"var(--text-faint)",cursor:"pointer"}}>Cancel</button>
        {state==="error" && <span style={{fontSize:11,color:"var(--bad)"}}>Didn&apos;t go through — try again.</span>}
      </div>
    </div>
  );
};
