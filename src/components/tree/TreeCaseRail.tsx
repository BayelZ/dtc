import React from "react";
import { SKILL_DOMAIN_ICONS } from "@/lib/supabase/types";
import type { TreeCaseSummary } from "@/hooks/useTreeCases";

// Featured rail for diagnostic cases, pinned ABOVE the multiple-choice grid.
//
// Why its own section rather than mixed into the grid: a case is a different commitment
// (a bay session, not a quiz) and scores differently (fix it or it's a comeback). Dropping
// one into the same grid would surprise a tech expecting a 10-question session. Separating
// it also keeps the type filters below honest — they filter the MCQ bank, not this.
export const TreeCaseRail:React.FC<{cases:TreeCaseSummary[];onOpen:(slug:string)=>void}> = ({cases,onOpen}) => {
  if (cases.length===0) return null;
  return (
    <section style={{marginBottom:"1.75rem"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <h2 style={{fontSize:15,fontWeight:600,margin:0,color:"var(--text)"}}>Diagnostic cases</h2>
        <span style={{fontSize:9.5,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,
          color:"var(--accent-hi)",background:"var(--accent-tint)",border:"0.5px solid var(--accent)",
          borderRadius:4,padding:"2px 6px"}}>New</span>
        <span style={{fontSize:12.5,color:"var(--text-muted)"}}>
          Work a real repair order — your own tests, your own call. No multiple choice.
        </span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
        {cases.map(c=>(
          <button key={c.id} onClick={()=>onOpen(c.slug)}
            style={{textAlign:"left",cursor:"pointer",font:"inherit",padding:"15px 16px",borderRadius:10,
              background:"var(--bg-card)",border:"0.5px solid var(--accent)",
              borderLeft:"3px solid var(--accent)",color:"var(--text)",display:"block"}}>
            <div style={{fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--accent)",fontWeight:700}}>
              Repair order
            </div>
            <div style={{fontSize:15.5,fontWeight:700,margin:"5px 0 6px",lineHeight:1.3}}>{c.title}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",fontSize:11.5,color:"var(--text-muted)"}}>
              {c.domain && <span>{SKILL_DOMAIN_ICONS[c.domain]} {c.domain}</span>}
              <span>· ~15 min</span>
              <span>· fix it or it&apos;s a comeback</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
