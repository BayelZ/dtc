import React, { useState, useCallback, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { getInitials, tierColors } from "@/lib/utils";
import { BETA_REGION, ROUTES } from "@/lib/constants";
import { resizeImageToSquareWebp, blobToBase64 } from "@/lib/imageResize";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

const PRIMARY = "#E85D24";
const BIO_MAX = 160;
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const AVATAR_MAX_BYTES = 5*1024*1024;
const PLACEHOLDER_BG = "#2a1a12";
const PLACEHOLDER_COLOR = "#E85D24";

interface ProfileHeaderProps {
  profile:Profile;
  rank:number|null;
  isOwnProfile:boolean;
  onSaveBio:(bio:string)=>Promise<void>|void;
  onAvatarUploaded:(url:string)=>Promise<void>|void;
}

export const ProfileHeader:React.FC<ProfileHeaderProps> = ({profile,rank,isOwnProfile,onSaveBio,onAvatarUploaded}) => {
  const [editingBio,setEditingBio]=useState(false);
  const [draftBio,setDraftBio]=useState(profile.bio??"");
  const [saving,setSaving]=useState(false);
  const [uploadingAvatar,setUploadingAvatar]=useState(false);
  const [avatarError,setAvatarError]=useState<string|null>(null);
  const fileInputRef=useRef<HTMLInputElement>(null);

  const tc=tierColors(profile.tier);
  const initials=getInitials(profile.full_name);

  const startEdit=useCallback(()=>{ setDraftBio(profile.bio??""); setEditingBio(true); },[profile.bio]);
  const cancelEdit=useCallback(()=>setEditingBio(false),[]);
  const saveEdit=useCallback(async()=>{
    setSaving(true);
    try { await onSaveBio(draftBio); setEditingBio(false); }
    finally { setSaving(false); }
  },[draftBio,onSaveBio]);

  const openFilePicker=useCallback(()=>{ if (isOwnProfile&&!uploadingAvatar) fileInputRef.current?.click(); },[isOwnProfile,uploadingAvatar]);

  const handleFileSelect=useCallback(async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];
    e.target.value="";
    if (!file) return;
    setAvatarError(null);
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { setAvatarError("Use a JPEG, PNG, or WebP image."); return; }
    if (file.size>AVATAR_MAX_BYTES) { setAvatarError("Image must be under 5MB."); return; }

    setUploadingAvatar(true);
    try {
      const blob=await resizeImageToSquareWebp(file);
      const image=await blobToBase64(blob);
      const { data:{session} } = await getSupabase().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated.");
      const res=await fetch(ROUTES.api.profileAvatar,{
        method:"POST",
        headers:{ "Authorization":`Bearer ${session.access_token}`, "Content-Type":"application/json" },
        body:JSON.stringify({image}),
        credentials:"include",
      });
      const body=await res.json();
      if (!res.ok) throw new Error(body?.error??"Failed to upload image.");
      await onAvatarUploaded(body.avatar_url);
    } catch(err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingAvatar(false);
    }
  },[onAvatarUploaded]);

  const subline=`${profile.shop_name||"Independent"} · ${profile.specialty} specialist · ${BETA_REGION}${rank!=null?` · Rank #${rank}`:""}`;

  return (
    <div style={{position:"relative",background:"#1a1a1a",border:"0.5px solid #2e2e2e",borderRadius:12,padding:"1.75rem",marginBottom:18,overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,opacity:0.5,backgroundImage:"repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 28px)",maskImage:"radial-gradient(circle at 8% 15%, black, transparent 70%)",WebkitMaskImage:"radial-gradient(circle at 8% 15%, black, transparent 70%)"}} />
      <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg, ${PRIMARY}, #e6b84a, #2BB8A8, #9B7FE8)`}} />

      <div style={{position:"relative",display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{position:"relative",width:96,height:96,flexShrink:0}}>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",animation:"avatarPulse 1.8s ease-in-out infinite"}} />
          {isOwnProfile && <input ref={fileInputRef} type="file" accept={AVATAR_ACCEPT} onChange={handleFileSelect} style={{display:"none"}} />}
          <div onClick={openFilePicker} title={isOwnProfile?"Click to change photo":undefined}
            style={{width:96,height:96,borderRadius:"50%",background:profile.avatar_url?"#000":PLACEHOLDER_BG,border:`3px solid ${tc.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:33,fontWeight:600,color:PLACEHOLDER_COLOR,cursor:isOwnProfile?(uploadingAvatar?"wait":"pointer"):"default",overflow:"hidden",opacity:uploadingAvatar?0.5:1}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
              : initials}
          </div>
          <div style={{position:"absolute",bottom:-2,right:-2,width:32,height:32,borderRadius:"50%",background:tc.bg,border:"2px solid #0f0f0f",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Icon icon="shield" size={16} color={tc.color} strokeWidth={2.2} />
          </div>
          {isOwnProfile && (
            <div onClick={openFilePicker} title="Change photo" style={{position:"absolute",top:-4,right:-4,width:26,height:26,borderRadius:"50%",background:PRIMARY,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0f0f0f",cursor:uploadingAvatar?"wait":"pointer"}}>
              <Icon icon="camera" size={13} color="#fff" strokeWidth={2.2} />
            </div>
          )}
        </div>

        <div style={{flex:1,minWidth:260}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",rowGap:6,marginBottom:10}}>
            <h1 style={{fontSize:26,fontWeight:600,margin:0,lineHeight:1.3,whiteSpace:"nowrap",flexShrink:0}}>{profile.full_name}</h1>
            <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",background:`linear-gradient(135deg, ${tc.bg}, ${tc.color}26)`,border:`0.5px solid ${tc.border}`,borderRadius:20,fontSize:13,fontWeight:600,color:tc.color,flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
              <Icon icon="shield" size={14} color={tc.color} strokeWidth={2.2} /> {profile.tier}
            </span>
          </div>
          {isOwnProfile && (uploadingAvatar||avatarError) && (
            <p style={{fontSize:12,color:avatarError?"#ff7070":"#888",margin:"0 0 6px"}}>{avatarError??"Uploading photo…"}</p>
          )}
          <p style={{fontSize:14,color:"#999",margin:"6px 0 12px",lineHeight:1.5}}>{subline}</p>

          {!isOwnProfile ? (
            profile.bio && <p style={{fontSize:15,color:"#f0f0f0",lineHeight:1.7,margin:"0 0 12px"}}>{profile.bio}</p>
          ) : editingBio ? (
            <div style={{marginBottom:12}}>
              <textarea value={draftBio} onChange={e=>setDraftBio(e.target.value.slice(0,BIO_MAX))} maxLength={BIO_MAX} rows={2}
                style={{width:"100%",background:"#242424",border:"0.5px solid #3e3e3e",borderRadius:6,color:"#f0f0f0",fontSize:15,padding:"10px 12px",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />
              <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                <button onClick={saveEdit} disabled={saving} style={{padding:"6px 14px",fontSize:13,background:PRIMARY,color:"#fff",border:"none",borderRadius:5,cursor:saving?"not-allowed":"pointer",fontWeight:500,opacity:saving?0.6:1}}>{saving?"Saving…":"Save"}</button>
                <button onClick={cancelEdit} disabled={saving} style={{padding:"6px 14px",fontSize:13,background:"none",color:"#999",border:"0.5px solid #2e2e2e",borderRadius:5,cursor:"pointer"}}>Cancel</button>
                <span style={{fontSize:11,color:"#555",marginLeft:"auto"}}>{draftBio.length}/{BIO_MAX}</span>
              </div>
            </div>
          ) : (
            <p onClick={startEdit} style={{fontSize:15,color:profile.bio?"#f0f0f0":"#666",lineHeight:1.7,margin:"0 0 12px",cursor:"pointer"}}>
              {profile.bio||"Click to add a bio…"}
            </p>
          )}

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:500,background:"#2a2010",color:"#e6b84a",border:"0.5px solid #5a4010",padding:"3px 10px",borderRadius:5}}>{profile.specialty}</span>
            <span style={{fontSize:12,fontWeight:500,background:"#242424",color:"#999",padding:"3px 10px",borderRadius:5,textTransform:"capitalize"}}>{profile.role.replace("_"," ")}</span>
            <span style={{fontSize:12,fontWeight:500,background:"#2e1a1a",color:"#ff8a6b",padding:"3px 10px",borderRadius:5,display:"inline-flex",alignItems:"center",gap:5}}>
              <Icon icon="flame" size={13} color="#ff8a6b" strokeWidth={2.2} /> {profile.streak}-day streak
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
