import React, { useState, useCallback } from "react";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InviteCodeSchema } from "@/lib/validations";
import { ROUTES } from "@/lib/constants";

export const InviteGate:React.FC<{onValid:(code:string)=>void}> = ({onValid}) => {
  const [code,setCode]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false); const [shake,setShake]=useState(false);
  const triggerShake=()=>{ setShake(true); setTimeout(()=>setShake(false),500); };
  const handleSubmit=useCallback(async()=>{
    setError("");
    const parsed=InviteCodeSchema.safeParse({code:code.trim()});
    if (!parsed.success) { setError(parsed.error.errors[0]?.message??"Invalid code."); triggerShake(); return; }
    setLoading(true);
    try {
      const res=await fetch(ROUTES.api.inviteValidate,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({code:parsed.data.code}) });
      const body=await res.json();
      if (!res.ok||!body.valid) { setError("Invalid invite code. DTC beta is Houston-area invite only."); triggerShake(); return; }
      onValid(parsed.data.code);
    } catch { setError("Network error — please try again."); triggerShake(); }
    finally { setLoading(false); }
  },[code,onValid]);
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{marginBottom:32}}><Logo size="lg" /></div>
        <div style={{background:"var(--bg-card)",border:`0.5px solid ${error?"var(--bad-border)":"var(--border)"}`,borderRadius:10,padding:"1.5rem",animation:shake?"shake 0.4s ease":"none"}}>
          <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 6px",color:"var(--text)"}}>Beta access</h2>
          <p style={{fontSize:13,color:"var(--text-muted)",margin:"0 0 24px",lineHeight:1.6}}>DTC is currently invite-only for Houston-area shops and techs.</p>
          <Input label="Invite code" placeholder="ENTER CODE" value={code} onChange={e=>{setCode(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} error={error} maxLength={20} autoComplete="off" spellCheck={false} style={{letterSpacing:3,textTransform:"uppercase",fontWeight:500}} />
          <Button fullWidth loading={loading} onClick={handleSubmit}>Continue with invite code</Button>
        </div>
        <p style={{textAlign:"center",fontSize:12,color:"var(--text-faint)",marginTop:20}}>Houston beta · Limited spots available</p>
      </div>
    </div>
  );
};
