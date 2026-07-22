import React, { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { TierBadge } from "@/components/grading/TierBadge";
import { tierColors } from "@/lib/utils";
import type { LeaderboardRow, Profile, Tier } from "@/lib/supabase/types";

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
// Rank medals (1/2/3) drawn from our own palette via tierColors — theme-aware.
const MEDALS = [tierColors("Gold"), tierColors("Silver"), tierColors("Bronze")];
const PLACE = ["1st", "2nd", "3rd"];

const LB_CSS = `
.lb2-podium{display:flex;gap:12px;align-items:stretch;margin:16px 0}
.lb2-card{display:flex;flex-direction:column}
.lb2-stat{margin-top:auto}
.lb2-grid{display:grid;grid-template-columns:44px 1fr 92px 78px 88px;align-items:center;gap:10px}
.lb2-gv{stroke-dasharray:var(--d) 100;transform:rotate(135deg);transform-origin:50% 50%;
  animation:lb2sweep .8s ease-out .3s both}
@keyframes lb2sweep{from{stroke-dashoffset:var(--d)}to{stroke-dashoffset:0}}
@media (max-width:640px){
  .lb2-podium{flex-direction:column;align-items:stretch;gap:8px}
  .lb2-card{flex:0 0 auto}
  .lb2-grid{grid-template-columns:34px 1fr 70px}
  .lb2-hide{display:none}
}
@media (prefers-reduced-motion:reduce){.lb2-gv{animation:none;stroke-dashoffset:0}}
`;

const Stamp:React.FC = () => (
  <span title="Pile empty — no open comebacks" style={{fontSize:8,background:"#0C2740",color:"#E9EEF2",
    border:"1px solid #E9EEF2",padding:"1px 6px 2px",borderRadius:3,marginLeft:6,letterSpacing:".14em",
    fontWeight:800,verticalAlign:"1px",whiteSpace:"nowrap"}}>NO COMEBACKS</span>
);

const accColor = (a:number) => a>=80 ? "var(--good)" : a>=60 ? "var(--gold)" : "var(--text-muted)";

export const LeaderboardPage:React.FC<{profile:Partial<Profile>|null;onViewProfile:(id:string)=>void}> = ({profile,onViewProfile}) => {
  const [rows,setRows]=useState<LeaderboardRow[]>([]);
  const [loading,setLd]=useState(true);
  const [filter,setFilter]=useState<"All"|"Automotive"|"Diesel">("All");
  // leaderboard VIEW has no guaranteed order — order in the consuming query
  useEffect(()=>{ getSupabase().from("leaderboard").select("*").order("xp",{ascending:false}).limit(50).then(({data})=>{ setRows(data??[]); setLd(false); }); },[]);

  const displayed = filter==="All" ? rows : rows.filter(r=>r.specialty===filter);
  const podium = displayed.slice(0,3);
  const field = displayed.slice(3);
  const me = profile?.id ? rows.find(r=>r.id===profile.id) ?? null : null;
  const go = (id:string) => onViewProfile(id);
  const asOf = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

  const rowInner = (u:LeaderboardRow, isMe:boolean) => (
    <>
      <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:u.rank<=3?MEDALS[u.rank-1].color:"var(--text-muted)"}}>{u.rank}</span>
      <div style={{minWidth:0}}>
        <p style={{fontSize:13,fontWeight:600,margin:0,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {u.full_name}{u.no_comebacks&&<Stamp />}{isMe&&<span style={{fontSize:9,background:"var(--accent-tint)",color:"var(--accent-hi)",border:"0.5px solid color-mix(in srgb, var(--accent) 35%, var(--bg))",padding:"1px 5px",borderRadius:3,marginLeft:6}}>you</span>}
        </p>
        <p style={{fontSize:11,color:"var(--text-muted)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(u.shop_name||"Independent")} · {u.specialty}</p>
      </div>
      <span className="lb2-hide"><TierBadge tier={u.tier as Tier} size="sm" /></span>
      <span className="lb2-hide" style={{fontFamily:MONO,fontSize:13,textAlign:"right",color:accColor(u.accuracy_pct)}}>{u.accuracy_pct}%</span>
      <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,textAlign:"right",color:"var(--text)"}}>{u.xp.toLocaleString()}</span>
    </>
  );

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html:LB_CSS}} />

      {/* Banner */}
      <div style={{background:"linear-gradient(135deg, var(--accent-tint), var(--bg-card))",border:"0.5px solid var(--border)",
        borderRadius:12,padding:"18px 20px 16px",marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:".22em",textTransform:"uppercase",color:"var(--accent)",fontWeight:600,marginBottom:7}}>Houston Beta · All-Time</div>
        <h1 style={{fontSize:"clamp(26px,5vw,40px)",fontWeight:800,margin:0,lineHeight:1,color:"var(--text)",letterSpacing:"-.015em"}}>
          Houston <span style={{color:"var(--accent)"}}>Standings</span>
        </h1>
        <p style={{fontSize:12.5,color:"var(--text-muted)",margin:"9px 0 0"}}>As of {asOf} · <b style={{color:"var(--text)"}}>{rows.length}</b> tech{rows.length===1?"":"s"} ranked · Ranked by total XP</p>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {(["All","Automotive","Diesel"] as const).map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 14px",fontSize:12,fontWeight:500,cursor:"pointer",
            border:`0.5px solid ${filter===s?"var(--accent)":"var(--border)"}`,borderRadius:6,
            background:filter===s?"var(--accent-tint)":"var(--bg-card)",color:filter===s?"var(--accent-hi)":"var(--text-muted)"}}>{s}</button>
        ))}
      </div>

      {loading ? <p style={{color:"var(--text-muted)",padding:"2rem 0",textAlign:"center"}}>Loading standings…</p>
      : displayed.length===0 ? <p style={{color:"var(--text-muted)",padding:"2rem 0",textAlign:"center"}}>No techs in this bracket yet.</p>
      : (
        <>
          {/* Podium */}
          {podium.length>0 && (
            <div className="lb2-podium">
              {podium.map((u,i)=>{
                const m=MEDALS[i];
                return (
                  <div key={u.id} className={`lb2-card p${i+1}`} onClick={()=>go(u.id)} role="button" tabIndex={0}
                    onKeyDown={e=>e.key==="Enter"&&go(u.id)}
                    style={{flex:"1 1 0",minWidth:0,background:"var(--bg-card)",
                      border:"0.5px solid var(--border)",borderTop:`2px solid ${m.color}`,borderRadius:10,
                      padding:"11px 12px",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:7}}>
                      <span style={{fontSize:9.5,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase",
                        padding:"3px 8px",borderRadius:20,color:m.color,background:`color-mix(in srgb, ${m.color} 16%, var(--bg))`,
                        border:`1px solid color-mix(in srgb, ${m.color} 42%, var(--bg))`}}>{PLACE[i]}</span>
                      <TierBadge tier={u.tier as Tier} size="sm" />
                    </div>
                    <p style={{fontSize:"clamp(15px,1.9vw,18px)",fontWeight:800,margin:"0 0 2px",
                      color:"var(--text)",lineHeight:1.1,letterSpacing:"-.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name}{u.no_comebacks&&<span style={{fontSize:7,background:"#0C2740",color:"#E9EEF2",border:"1px solid #E9EEF2",padding:"1px 5px",borderRadius:2,marginLeft:5,letterSpacing:".1em",fontWeight:800,verticalAlign:"2px",whiteSpace:"nowrap"}}>NO COMEBACKS</span>}</p>
                    <p style={{fontSize:11,color:"var(--text-muted)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(u.shop_name||"Independent")} · {u.specialty}</p>
                    <div className="lb2-stat" style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8,paddingTop:8,borderTop:"0.5px solid var(--border)"}}>
                      <span style={{fontFamily:MONO,fontSize:18,fontWeight:800,color:"var(--text)"}}>{u.xp.toLocaleString()}<span style={{fontSize:11,color:"var(--text-muted)",fontWeight:400,marginLeft:3}}>XP</span></span>
                      <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:accColor(u.accuracy_pct)}}>{u.accuracy_pct}%<span style={{fontSize:10,color:"var(--text-muted)",fontWeight:400,marginLeft:4}}>accuracy</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* The field */}
          <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
            <div className="lb2-grid" style={{padding:"9px 16px",borderBottom:"0.5px solid var(--border)"}}>
              {["#","Tech","Tier","Acc.","XP"].map((h,i)=>(
                <span key={h} className={i===2||i===3?"lb2-hide":undefined}
                  style={{fontSize:10,letterSpacing:".12em",textTransform:"uppercase",color:"var(--text-faint)",fontWeight:600,textAlign:i>=3?"right":"left"}}>{h}</span>
              ))}
            </div>
            {field.map(u=>{
              const isMe=u.id===profile?.id;
              return (
                <div key={u.id} className="lb2-grid" onClick={()=>go(u.id)} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&go(u.id)}
                  style={{padding:"9px 16px",borderBottom:"0.5px solid var(--border)",cursor:"pointer",
                    background:isMe?"var(--accent-tint)":"transparent"}}>
                  {rowInner(u,isMe)}
                </div>
              );
            })}
            {field.length===0 && <p style={{fontSize:12,color:"var(--text-muted)",padding:"16px",textAlign:"center"}}>Just the podium so far.</p>}
          </div>

          {/* Your position */}
          {me && (me.rank>3) && (
            <div style={{marginTop:14,background:"var(--accent-tint)",border:"0.5px solid color-mix(in srgb, var(--accent) 40%, var(--border))",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"8px 16px",fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--accent-hi)",fontWeight:700,borderBottom:"0.5px solid color-mix(in srgb, var(--accent) 30%, var(--border))"}}>Your position · Rank {me.rank} of {rows.length}</div>
              <div className="lb2-grid" onClick={()=>go(me.id)} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&go(me.id)} style={{padding:"12px 16px",cursor:"pointer"}}>
                {rowInner(me,true)}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:18,flexWrap:"wrap",marginTop:18,fontSize:11,color:"var(--text-faint)"}}>
            <span><b style={{color:"var(--text-muted)"}}>Tiers:</b> Bronze · Silver 1k · Gold 2.5k · Platinum 5k · Master 10k</span>
            <span><b style={{color:"var(--text-muted)"}}>Ranked by</b> total XP</span>
          </div>
        </>
      )}
    </div>
  );
};
