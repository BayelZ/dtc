// Gear catalog — earned profile decals. PROTOTYPE: the catalog lives in code so we can feel the
// mechanic before committing schema. The shape mirrors the planned `cosmetics` table exactly
// (slug / name / kind / assetKey / rarity / unlockRule), so moving it into Postgres later is a
// straight port and the rule vocabulary is already proven.
//
// Design rule: XP is NEVER spent. Decals UNLOCK against what you've already earned, so the
// credential stays monotonic — a tech can't drop a tier by decorating their profile.
import type { SkillDomain, Tier, Grade } from "@/lib/supabase/types";

export type StickerKind = "oval" | "patch" | "shield" | "stamp";
export type Rarity = "standard" | "earned" | "rare";

export type UnlockRule =
  | { type: "cohort"; value: string }
  | { type: "xp_at_least"; value: number }
  | { type: "tier_at_least"; value: Tier }
  | { type: "domain_xp_at_least"; domain: SkillDomain; value: number }
  | { type: "grade_count"; grade: Grade; value: number }
  | { type: "challenge_completed"; slug: string }
  | { type: "challenge_grade"; slug: string; minGrade: Grade }
  | { type: "tree_outcome"; slug: string; outcome: "clean" }
  | { type: "comebacks_clean" };

export interface Sticker {
  slug: string;
  name: string;
  /** Shown on the locked card — this is the quest. Write it as an instruction. */
  requirement: string;
  kind: StickerKind;
  rarity: Rarity;
  /** Short text drawn inside the decal art. Keep to ~6 chars. */
  legend: string;
  /** Accent for the decal art; falls back to the theme accent. */
  color: string;
  unlockRule: UnlockRule;
}

export const MAX_EQUIPPED = 4;

export const CATALOG: Sticker[] = [
  {
    slug: "founding-tech", name: "Founding Tech",
    requirement: "Sign up during the Houston beta",
    kind: "patch", rarity: "rare", legend: "HTX 26", color: "var(--accent)",
    unlockRule: { type: "cohort", value: "houston-beta" },
  },
  {
    slug: "first-thousand", name: "Four Digits",
    requirement: "Reach 1,000 XP",
    kind: "oval", rarity: "standard", legend: "1K", color: "var(--text-muted)",
    unlockRule: { type: "xp_at_least", value: 1000 },
  },
  {
    slug: "gold-tier", name: "Gold Tier",
    requirement: "Reach Gold tier — 2,500 XP",
    kind: "shield", rarity: "earned", legend: "GOLD", color: "#EF9F27",
    unlockRule: { type: "tier_at_least", value: "Gold" },
  },
  {
    slug: "master-tier", name: "Master Tier",
    requirement: "Reach Master tier — 10,000 XP",
    kind: "shield", rarity: "rare", legend: "MSTR", color: "var(--accent)",
    unlockRule: { type: "tier_at_least", value: "Master" },
  },
  {
    slug: "sixty-ohm", name: "Sixty Ohm",
    requirement: "Earn 500 XP in the Network domain",
    kind: "oval", rarity: "earned", legend: "60Ω", color: "#2BB8A8",
    unlockRule: { type: "domain_xp_at_least", domain: "Network", value: 500 },
  },
  {
    slug: "sparky", name: "Sparky",
    requirement: "Earn 500 XP in the Electrical domain",
    kind: "oval", rarity: "earned", legend: "VOLTS", color: "#EFD027",
    unlockRule: { type: "domain_xp_at_least", domain: "Electrical", value: 500 },
  },
  {
    slug: "cat-whisperer", name: "Cat Whisperer",
    requirement: "Clear the P0420 case without condemning the converter",
    kind: "patch", rarity: "rare", legend: "P0420", color: "#9B7FE8",
    unlockRule: { type: "tree_outcome", slug: "p0420-second-opinion", outcome: "clean" },
  },
  {
    slug: "block-test", name: "Proved It",
    requirement: "Clear the head-gasket case with a clean diagnosis",
    kind: "patch", rarity: "rare", legend: "PROVED", color: "#2BB8A8",
    unlockRule: { type: "tree_outcome", slug: "cooling-second-opinion", outcome: "clean" },
  },
  {
    slug: "no-comebacks", name: "No Comebacks",
    requirement: "Empty the Rework Bench with 50+ questions answered",
    kind: "stamp", rarity: "rare", legend: "NO CB", color: "#E9EEF2",
    unlockRule: { type: "comebacks_clean" },
  },
  {
    slug: "parasitic-draw", name: "Draw Hunter",
    requirement: "Clear the parasitic-draw challenge at a B or better",
    kind: "oval", rarity: "earned", legend: "mA", color: "#9B7FE8",
    unlockRule: { type: "challenge_grade", slug: "parasitic-draw-tahoe", minGrade: "B" },
  },
  {
    slug: "bus-master", name: "Bus Master",
    requirement: "Clear the U0101 no-comm challenge at an A",
    kind: "patch", rarity: "rare", legend: "CAN H", color: "#2BB8A8",
    unlockRule: { type: "challenge_grade", slug: "u0101-no-comm-tcm", minGrade: "A" },
  },
  {
    slug: "straight-a", name: "Straight A",
    requirement: "Finish ten challenges at grade A",
    kind: "shield", rarity: "earned", legend: "AAA", color: "var(--good)",
    unlockRule: { type: "grade_count", grade: "A", value: 10 },
  },
];

export const bySlug = (slug: string): Sticker | undefined => CATALOG.find((s) => s.slug === slug);
