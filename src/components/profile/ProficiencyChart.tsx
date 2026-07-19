import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ProficiencyStat } from "@/hooks/useProficiency";

const PRIMARY = "var(--accent)";
const PRIMARY_DARK = "var(--accent-hi)";

type View = "radar"|"bars";

export const ProficiencyChart:React.FC<{stats:ProficiencyStat[]}> = ({stats}) => {
  const [view,setView]=useState<View>("radar");
  const [hoverIdx,setHoverIdx]=useState<number|null>(null);

  const n=stats.length;
  const center=180, maxR=92;

  const vertexFor=(i:number,scalePct:number)=>{
    const angle=(-90+i*(360/n))*(Math.PI/180);
    const r=maxR*(scalePct/100);
    return { x:center+r*Math.cos(angle), y:center+r*Math.sin(angle) };
  };

  const gridRings=[25,50,75,100].map((pct,ringIdx)=>{
    const pts:string[]=[];
    for (let i=0;i<n;i++) { const v=vertexFor(i,pct); pts.push(`${v.x},${v.y}`); }
    return { points:pts.join(" "), delay:`${ringIdx*0.08}s` };
  });

  const spokes=stats.map((_s,i)=>{
    const p=vertexFor(i,100);
    const isActive=hoverIdx===i;
    return { x2:p.x, y2:p.y, color:isActive?PRIMARY:"var(--border)", width:isActive?1.5:0.5, opacity:isActive?0.9:0.5 };
  });

  const dataPts=stats.map((s,i)=>vertexFor(i,s.value));
  const dataPolygonPoints=dataPts.map(p=>`${p.x},${p.y}`).join(" ");

  const statDots=dataPts.map((p,i)=>{
    const isActive=hoverIdx===i;
    return { cx:p.x, cy:p.y, r:isActive?7.5:4, opacity:isActive?1:0.9, delay:`${0.5+i*0.06}s`, active:isActive };
  });

  const statLabels=stats.map((s,i)=>{
    const labelR=maxR+34;
    const angle=(-90+i*(360/n))*(Math.PI/180);
    const lx=center+labelR*Math.cos(angle);
    const ly=center+labelR*Math.sin(angle);
    const cosV=Math.cos(angle);
    const anchor=cosV>0.3?"start":cosV<-0.3?"end":"middle";
    const isActive=hoverIdx===i;
    let transform:string, textAlign:React.CSSProperties["textAlign"];
    if (anchor==="start") { transform="translate(0%,-50%)"; textAlign="left"; }
    else if (anchor==="end") { transform="translate(-100%,-50%)"; textAlign="right"; }
    else { transform="translate(-50%,-50%)"; textAlign="center"; }
    return {
      lx, ly, transform, textAlign,
      pillBg:isActive?"color-mix(in srgb, var(--accent) 14%, transparent)":"transparent",
      label:s.label, value:s.value,
      labelColor:isActive?PRIMARY_DARK:"var(--text-muted)", labelWeight:isActive?700:500, labelSize:isActive?15:13,
      valueColor:isActive?PRIMARY:"var(--text-faint)", valueSize:isActive?15:12,
      delay:`${0.75+i*0.05}s`,
    };
  });

  const barRows=stats.map((s,i)=>{
    const isActive=hoverIdx===i;
    return {
      icon:s.icon, label:s.label, value:s.value,
      textColor:isActive?PRIMARY_DARK:"var(--text-dim)", weight:isActive?700:500,
      rowBg:isActive?"color-mix(in srgb, var(--accent) 10%, transparent)":"transparent",
      delay:`${i*0.06}s`,
    };
  });

  const avgScore=n>0?Math.round(stats.reduce((sum,s)=>sum+s.value,0)/n):0;
  const sortedStats=[...stats].sort((a,b)=>b.value-a.value);
  const topStats=sortedStats.slice(0,2);
  const bottomStats=sortedStats.slice(-2).reverse();

  return (
    <div style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"1.5rem",marginBottom:18}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div>
          <p style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>Technical Proficiency</p>
          <p style={{fontSize:13,color:"var(--text-faint)",margin:0}}>Diagnostic skill assessment across core competencies</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",gap:4,background:"var(--bg-raised)",borderRadius:6,padding:3}}>
            {(["radar","bars"] as View[]).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"5px 12px",fontSize:12,border:"none",borderRadius:5,background:view===v?"var(--bg-card)":"none",color:view===v?"var(--text)":"var(--text-muted)",cursor:"pointer",textTransform:"capitalize"}}>{v}</button>
            ))}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:32,fontWeight:700,color:PRIMARY,lineHeight:1}}>{avgScore}</div>
            <div style={{fontSize:10,letterSpacing:1,color:"var(--text-muted)",marginTop:3}}>OVERALL SCORE</div>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:28,alignItems:"center",flexWrap:"wrap"}}>
        {view==="radar" ? (
          <div style={{position:"relative",width:360,height:360,flexShrink:0,margin:"0 auto"}}>
            <svg width={360} height={360} viewBox="0 0 360 360" style={{position:"absolute",inset:0,overflow:"visible",width:330,height:332,left:55,top:33}}>
              <defs>
                <radialGradient id="octoBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                </radialGradient>
                <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={PRIMARY} floodOpacity={0.9} />
                </filter>
              </defs>

              <circle cx={180} cy={180} r={96} fill="url(#octoBg)" />

              {gridRings.map((ring,i)=>(
                <polygon key={i} points={ring.points} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.55} style={{animation:"ringFade 0.6s ease-out both",animationDelay:ring.delay}} />
              ))}
              {spokes.map((spoke,i)=>(
                <line key={i} x1={180} y1={180} x2={spoke.x2} y2={spoke.y2} stroke={spoke.color} strokeWidth={spoke.width} opacity={spoke.opacity} style={{transition:"all 0.15s ease"}} />
              ))}

              <g style={{transformOrigin:"180px 180px",animation:"octoGrow 0.8s cubic-bezier(.2,1,.3,1) both",animationDelay:"0.15s"}}>
                <polygon points={dataPolygonPoints} fill={PRIMARY} fillOpacity={0.16} stroke={PRIMARY} strokeWidth={2} />
                {statDots.map((dot,i)=>(
                  <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill={PRIMARY} stroke="var(--bg)" strokeWidth={1.5} opacity={dot.opacity} filter={dot.active?"url(#dotGlow)":undefined}
                    style={{cursor:"pointer",transformBox:"fill-box",transformOrigin:"center",animation:"dotPop 0.45s ease-out both",animationDelay:dot.delay,transition:"r 0.15s ease"}}
                    onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)} />
                ))}
              </g>
            </svg>

            {statLabels.map((lbl,i)=>(
              <div key={i} onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)}
                style={{position:"absolute",left:lbl.lx,top:lbl.ly,transform:lbl.transform,textAlign:lbl.textAlign,padding:"4px 8px",borderRadius:7,background:lbl.pillBg,cursor:"pointer",animation:"fadeInUp 0.5s ease-out both",animationDelay:lbl.delay,transition:"background 0.15s ease"}}>
                <div style={{fontSize:lbl.labelSize,fontWeight:lbl.labelWeight,color:lbl.labelColor,whiteSpace:"nowrap",transition:"all 0.15s ease"}}>{lbl.label}</div>
                <div style={{fontSize:lbl.valueSize,fontWeight:700,color:lbl.valueColor,transition:"all 0.15s ease"}}>{lbl.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{flex:1,minWidth:260,display:"flex",flexDirection:"column",gap:10}}>
            {barRows.map((bar,i)=>(
              <div key={i} onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)} style={{cursor:"pointer",padding:"6px 8px",borderRadius:6,background:bar.rowBg,transition:"background 0.15s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <Icon icon={bar.icon} size={14} color={bar.textColor} strokeWidth={2} />
                  <span style={{fontSize:13,fontWeight:bar.weight,color:bar.textColor,flex:1,transition:"all 0.15s ease"}}>{bar.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:bar.textColor}}>{bar.value}</span>
                </div>
                <div style={{height:6,background:"var(--bg-raised)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${bar.value}%`,background:PRIMARY,borderRadius:3,animation:"barGrow 0.8s ease-out both",animationDelay:bar.delay}} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{flex:1,minWidth:220,display:"flex",flexDirection:"column",gap:18}}>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"var(--good)",letterSpacing:0.5,textTransform:"uppercase",margin:"0 0 10px",display:"flex",alignItems:"center",gap:6}}>
              <Icon icon="trending" size={14} color="var(--good)" strokeWidth={2.2} /> Strengths
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {topStats.map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:10}}>
                  <Icon icon={s.icon} size={16} color="var(--good)" strokeWidth={2} />
                  <span style={{fontSize:13,color:"var(--text-dim)"}}>{s.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--good)"}}>{s.value}</span>
                  <div style={{flex:1,height:4,background:"var(--bg-raised)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${s.value}%`,background:"var(--good)",borderRadius:2}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"var(--accent-soft)",letterSpacing:0.5,textTransform:"uppercase",margin:"0 0 10px",display:"flex",alignItems:"center",gap:6}}>
              <Icon icon="target" size={14} color="var(--accent-soft)" strokeWidth={2.2} /> Needs Work
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {bottomStats.map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:10}}>
                  <Icon icon={s.icon} size={16} color="var(--accent-soft)" strokeWidth={2} />
                  <span style={{fontSize:13,color:"var(--text-dim)"}}>{s.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--accent-soft)"}}>{s.value}</span>
                  <div style={{flex:1,height:4,background:"var(--bg-raised)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${s.value}%`,background:"var(--accent-soft)",borderRadius:2}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
