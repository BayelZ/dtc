import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Badge, Tier } from "@/lib/supabase/types";

export interface BadgeWithStatus extends Badge { earned:boolean; tier?:Tier; }

const TIER_NAMES:Tier[] = ["Bronze","Silver","Gold","Platinum","Master"];

export function useBadges(userId:string|null|undefined) {
  const [badges,setBadges]=useState<BadgeWithStatus[]>([]);
  const [loading,setLoading]=useState(true);

  const fetchBadges=useCallback(async()=>{
    if (!userId) { setBadges([]); setLoading(false); return; }
    setLoading(true);
    const sb=getSupabase();
    const [{data:allBadges},{data:earned}] = await Promise.all([
      sb.from("badges").select("*").order("created_at",{ascending:true}),
      sb.from("user_badges").select("badge_id").eq("user_id",userId),
    ]);
    const earnedIds=new Set((earned??[]).map(e=>e.badge_id));
    const rows:BadgeWithStatus[]=(allBadges??[]).map(b=>{
      const tierName=TIER_NAMES.find(t=>b.name===`Reached ${t}`);
      return { ...b, earned:earnedIds.has(b.id), tier:tierName };
    });
    setBadges(rows);
    setLoading(false);
  },[userId]);

  useEffect(()=>{ fetchBadges(); },[fetchBadges]);

  return { badges, loading, refresh:fetchBadges };
}
