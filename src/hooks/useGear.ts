import { useCallback, useEffect, useState } from "react";
import type { GearItem } from "@/views/gear";

// Server-backed gear state. All unlock evaluation happens in /api/gear (grant_cosmetics);
// this hook never decides what's earned — it only renders what the server says and asks the
// server to change the loadout.
export function useGear(userId:string|null|undefined) {
  const [items,setItems]=useState<GearItem[]>([]);
  const [equipped,setEquipped]=useState<string[]>([]);
  const [maxEquipped,setMax]=useState(4);
  const [newlyUnlocked,setNewly]=useState<{slug:string;name:string}[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if (!userId) { setItems([]); setEquipped([]); setLoading(false); return; }
    setLoading(true);
    try {
      const r=await fetch("/api/gear");
      const d=await r.json();
      if (!r.ok) throw new Error(d.error??"Failed to load gear.");
      setItems(d.catalog??[]); setEquipped(d.equipped??[]);
      setMax(d.max_equipped??4); setNewly(d.newly_unlocked??[]);
      setError(null);
    } catch(e){
      // A missing table (migration not applied yet) must not break the app — show nothing.
      setItems([]); setEquipped([]);
      setError(e instanceof Error?e.message:"Failed to load gear.");
    } finally { setLoading(false); }
  },[userId]);

  useEffect(()=>{ void load(); },[load]);

  const toggle=useCallback(async(slug:string)=>{
    const item=items.find(i=>i.slug===slug);
    if (!item?.unlocked||saving) return;
    const next=equipped.includes(slug)
      ? equipped.filter(s=>s!==slug)
      : equipped.length>=maxEquipped ? equipped : [...equipped,slug];
    if (next===equipped) return;

    const prev=equipped;
    setEquipped(next);           // optimistic
    setSaving(true); setError(null);
    try {
      const r=await fetch("/api/gear/loadout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slugs:next})});
      const d=await r.json();
      if (!r.ok) throw new Error(d.error??"Could not save your box.");
      setEquipped(d.equipped??next);   // trust the server's ordering
    } catch(e){
      setEquipped(prev);               // roll back
      setError(e instanceof Error?e.message:"Could not save your box.");
    } finally { setSaving(false); }
  },[items,equipped,maxEquipped,saving]);

  return { items, equipped, maxEquipped, newlyUnlocked, loading, saving, error, toggle, reload:load };
}
