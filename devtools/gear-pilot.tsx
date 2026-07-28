import React, { useState } from "react";
import type { NextPage } from "next";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { GearPage } from "@/views/gear";
import { CATALOG, MAX_EQUIPPED } from "@/lib/gear/catalog";
import { unlockedSlugs, isUnlocked, ruleProgress, type GearStats } from "@/lib/gear/unlock";
import type { Profile } from "@/lib/supabase/types";

// DEV-ONLY preview for the gear prototype. Not linked in nav, no auth, no Supabase — it runs a
// fake profile so the decal strip and the Gear page can be judged without logging in.
// Visit /gear-pilot locally.

const TEST_PROFILE: Profile = {
  id: "test-profile", full_name: "Bayel Zhumabekov", role: "mechanic", specialty: "Automotive",
  shop_name: "Bay 4 Diagnostics", city: "Houston", bio: "Driveability and electrical. If it only acts up on the customer, that's the one I want.",
  avatar_url: null, xp: 3120, streak: 6, tier: "Gold", last_active: "2026-07-26",
  invite_code: "HOUSTON-BETA", created_at: "2026-07-01",
};

// Three presets so the locked/unlocked/rare states can all be seen without grinding.
const PRESETS: { key: string; label: string; stats: GearStats }[] = [
  {
    key: "rookie", label: "Rookie (almost nothing unlocked)",
    stats: { xp: 240, tier: "Bronze", cohort: "houston-beta", domainXp: { Emissions: 240 },
      gradeCounts: { A: 1 }, completedChallenges: [], challengeGrades: {}, cleanTreeCases: [], comebacksOpen: 3, questionsAnswered: 20 },
  },
  {
    key: "working", label: "Working tech (this is Bayel today)",
    stats: { xp: 3120, tier: "Gold", cohort: "houston-beta", domainXp: { Emissions: 640, Electrical: 520, Drivetrain: 180 },
      gradeCounts: { A: 11 }, completedChallenges: ["parasitic-draw-tahoe"], challengeGrades: { "parasitic-draw-tahoe": "B" }, cleanTreeCases: ["p0420-second-opinion"], comebacksOpen: 0, questionsAnswered: 120 },
  },
  {
    key: "master", label: "Master (everything unlocked)",
    stats: { xp: 12400, tier: "Master", cohort: "houston-beta",
      domainXp: { Emissions: 2400, Electrical: 2100, Network: 1600, Drivetrain: 900, Fuel: 800 },
      gradeCounts: { A: 40 }, completedChallenges: ["parasitic-draw-tahoe","u0101-no-comm-tcm"],
      challengeGrades: { "parasitic-draw-tahoe": "A", "u0101-no-comm-tcm": "A" },
      cleanTreeCases: ["p0420-second-opinion", "cooling-second-opinion"],
      comebacksOpen: 0, questionsAnswered: 400 },
  },
];

const GearPilot: NextPage = () => {
  const [presetKey, setPresetKey] = useState("working");
  const [equipped, setEquipped] = useState<string[]>(["founding-tech", "cat-whisperer"]);
  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[1];
  const unlocked = unlockedSlugs(preset.stats);

  const toggle = (slug: string) => {
    if (!unlocked.includes(slug)) return;
    setEquipped((e) => e.includes(slug) ? e.filter((s) => s !== slug)
      : e.length >= MAX_EQUIPPED ? e : [...e, slug]);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", padding: "18px 16px 64px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Test profile</span>
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => { setPresetKey(p.key); setEquipped([]); }}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer", font: "inherit",
              background: p.key === presetKey ? "var(--accent-tint)" : "var(--bg-card)",
              color: p.key === presetKey ? "var(--accent-hi)" : "var(--text-muted)",
              border: `0.5px solid ${p.key === presetKey ? "var(--accent)" : "var(--border)"}` }}>{p.label}</button>
        ))}
        <span style={{ fontSize: 12, color: "var(--text-faint)", marginLeft: "auto" }}>
          {unlocked.length}/{CATALOG.length} unlocked
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto 28px" }}>
        <ProfileHeader profile={{ ...TEST_PROFILE, xp: preset.stats.xp, tier: preset.stats.tier }}
          rank={3} isOwnProfile onSaveBio={() => {}} onAvatarUploaded={() => {}}
          equippedGear={equipped} gearArt={CATALOG} onOpenGear={() => { /* already below */ }} />
      </div>

      {/* The pilot evaluates rules locally (offline, no auth). Production evaluates them
          server-side in grant_cosmetics() — see supabase/migrations/030_gear_decals.sql. */}
      <GearPage
        items={CATALOG.map((c) => ({
          slug: c.slug, name: c.name, requirement: c.requirement, kind: c.kind,
          rarity: c.rarity, legend: c.legend, color: c.color,
          unlocked: isUnlocked(c.unlockRule, preset.stats),
          progress: ruleProgress(c.unlockRule, preset.stats),
        }))}
        equipped={equipped} maxEquipped={MAX_EQUIPPED} onToggle={toggle} />
    </div>
  );
};

export default GearPilot;

// DEV-ONLY ROUTE — a fake profile with local unlock evaluation. Harmless, but it isn't part of
// the product, so it 404s in production rather than shipping as a stray public page.
export async function getStaticProps() {
  if (process.env.NODE_ENV === "production") return { notFound: true as const };
  return { props: {} };
}
