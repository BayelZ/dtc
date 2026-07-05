import React, { useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SignUpSchema, LoginSchema } from "@/lib/validations";
import type { Profile } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

type AuthMode="login"|"signup";

export const AuthForm:React.FC<{inviteCode:string;onAuth:(user:User,profile:Partial<Profile>)=>void}> = ({inviteCode,onAuth}) => {
  const [mode,setMode]=useState<AuthMode>("login");
  const [loading,setLoading]=useState(false);
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [fullName,setFullName]=useState("");
  const [role,setRole]=useState<"mechanic"|"student"|"shop_owner">("mechanic");
  const [specialty,setSpecialty]=useState<"Automotive"|"Diesel"|"Both">("Automotive");
  const [shopName,setShopName]=useState("");
  const clearErrors=()=>setErrors({});

  const handleSubmit=useCallback(async()=>{
    clearErrors(); setLoading(true);
    try {
      if (mode==="signup") {
        const parsed=SignUpSchema.safeParse({email,password,full_name:fullName,role,specialty,shop_name:shopName,invite_code:inviteCode});
        if (!parsed.success) { const fe:Record<string,string>={}; parsed.error.errors.forEach(e=>{fe[String(e.path[0])]=e.message;}); setErrors(fe); return; }
        const { data, error } = await getSupabase().auth.signUp({
          email:parsed.data.email, password:parsed.data.password,
          options:{ data:{ full_name:parsed.data.full_name, role:parsed.data.role, specialty:parsed.data.specialty, shop_name:parsed.data.shop_name, invite_code:parsed.data.invite_code } },
        });
        if (error) { setErrors({_form:error.message}); return; }
        if (data.user) onAuth(data.user, { full_name:parsed.data.full_name, role:parsed.data.role, specialty:parsed.data.specialty, shop_name:parsed.data.shop_name, xp:0, streak:0, tier:"Bronze" });
      } else {
        const parsed=LoginSchema.safeParse({email,password});
        if (!parsed.success) { const fe:Record<string,string>={}; parsed.error.errors.forEach(e=>{fe[String(e.path[0])]=e.message;}); setErrors(fe); return; }
        const { data, error } = await getSupabase().auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password});
        if (error) { setErrors({_form:error.message}); return; }
        if (data.user) { const { data:profile } = await getSupabase().from("profiles").select("*").eq("id",data.user.id).single(); onAuth(data.user, profile??{}); }
      }
    } catch { setErrors({_form:"An unexpected error occurred."}); }
    finally { setLoading(false); }
  },[mode,email,password,fullName,role,specialty,shopName,inviteCode,onAuth]);

  const Toggle=({val,label,cur,set}:{val:string;label:string;cur:string;set:(v:any)=>void}) => (
    <button onClick={()=>set(val)} style={{flex:1,padding:"7px 4px",fontSize:11,border:`0.5px solid ${cur===val?"#E85D24":"#2e2e2e"}`,borderRadius:5,background:cur===val?"#2a1a12":"#242424",color:cur===val?"#ff7a45":"#888",cursor:"pointer"}}>{label}</button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0f0f0f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{marginBottom:28}}><Logo size="lg" /></div>
        <div style={{display:"flex",background:"#242424",borderRadius:6,padding:3,marginBottom:20}}>
          {(["login","signup"] as AuthMode[]).map(m=>(
            <button key={m} onClick={()=>{setMode(m);clearErrors();}} style={{flex:1,padding:"8px",border:"none",borderRadius:5,background:mode===m?"#1a1a1a":"none",color:mode===m?"#f0f0f0":"#888",fontSize:13,fontWeight:mode===m?500:400,cursor:"pointer"}}>{m==="login"?"Log in":"Create account"}</button>
          ))}
        </div>
        <div style={{background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:10,padding:"1.5rem"}}>
          <div style={{display: mode==="signup" ? "block" : "none"}}>
            <Input label="Full name" placeholder="Marcus Torres" value={fullName} onChange={e=>setFullName(e.target.value)} error={errors.full_name} autoComplete="name" />
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:6}}>Role</label>
              <div style={{display:"flex",gap:8}}><Toggle val="mechanic" label="Working tech" cur={role} set={setRole} /><Toggle val="student" label="Student" cur={role} set={setRole} /><Toggle val="shop_owner" label="Shop owner" cur={role} set={setRole} /></div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:6}}>Specialty</label>
              <div style={{display:"flex",gap:8}}><Toggle val="Automotive" label="Automotive" cur={specialty} set={setSpecialty} /><Toggle val="Diesel" label="Diesel" cur={specialty} set={setSpecialty} /><Toggle val="Both" label="Both" cur={specialty} set={setSpecialty} /></div>
            </div>
            <Input label="Shop / School" hint="optional" placeholder="Big Rig Diesel HTX" value={shopName} onChange={e=>setShopName(e.target.value)} error={errors.shop_name} autoComplete="organization" />
          </div>
          <Input label="Email" type="email" placeholder="you@shop.com" value={email} onChange={e=>setEmail(e.target.value)} error={errors.email} autoComplete={mode==="login"?"username":"email"} />
          <Input label="Password" type="password" placeholder={mode==="signup"?"Create a password":"Your password"} value={password} onChange={e=>setPassword(e.target.value)} error={errors.password} autoComplete={mode==="login"?"current-password":"new-password"} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          {errors._form && <p style={{fontSize:12,color:"#ff7070",margin:"-8px 0 14px",lineHeight:1.5}}>{errors._form}</p>}
          <Button fullWidth loading={loading} onClick={handleSubmit}>{mode==="login"?"Log in":"Create account"}</Button>
          {mode==="login" && <button onClick={()=>{setMode("signup");clearErrors();}} style={{width:"100%",marginTop:10,padding:"10px",background:"none",color:"#888",border:"0.5px solid #2e2e2e",borderRadius:6,fontSize:13,cursor:"pointer"}}>New to DTC? Create an account →</button>}
        </div>
        <p style={{textAlign:"center",fontSize:12,color:"#555",marginTop:20}}>Houston beta · Secured by Supabase Auth</p>
      </div>
    </div>
  );
};
