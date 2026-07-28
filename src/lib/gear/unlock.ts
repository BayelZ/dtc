// Pure unlock evaluation. Kept framework-free and side-effect-free so it can move server-side
// verbatim (as the `grant_cosmetics()` body) without a rewrite — the same way scoreTree() did.
//
// NOTHING here may be trusted from the client in production: these stats must be read from the
// database. In the prototype they're assembled browser-side just to feel the mechanic.
import { TIER_XP } from "@/lib/constants";
import type { SkillDomain, Tier, Grade } from "@/lib/supabase/types";
import { CATALOG, type Sticker, type UnlockRule } from "./catalog";

export interface GearStats {
  xp: number;
  tier: Tier;
  cohort: string | null;
  domainXp: Partial<Record<SkillDomain, number>>;
  gradeCounts: Partial<Record<Grade, number>>;
  /** slugs of MCQ challenges completed, with the best grade achieved on each */
  completedChallenges: string[];
  challengeGrades: Record<string, Grade>;
  /** slugs of tree cases finished with a clean (fixed + proven) outcome */
  cleanTreeCases: string[];
  comebacksOpen: number;
  questionsAnswered: number;
}

export const emptyStats = (): GearStats => ({
  xp: 0, tier: "Bronze", cohort: null, domainXp: {}, gradeCounts: {},
  completedChallenges: [], challengeGrades: {}, cleanTreeCases: [], comebacksOpen: 0, questionsAnswered: 0,
});

// A > B > C > F — mirrors grade_rank() in migration 030.
const GRADE_RANK: Record<Grade, number> = { A: 3, B: 2, C: 1, F: 0 };

// Mirrors COMEBACK_STAMP_MIN_QUESTIONS / the leaderboard's no_comebacks column.
const CLEAN_SHEET_MIN_QUESTIONS = 50;

export function isUnlocked(rule: UnlockRule, s: GearStats): boolean {
  switch (rule.type) {
    case "cohort":              return s.cohort === rule.value;
    case "xp_at_least":         return s.xp >= rule.value;
    case "tier_at_least":       return s.xp >= (TIER_XP[rule.value] ?? Infinity);
    case "domain_xp_at_least":  return (s.domainXp[rule.domain] ?? 0) >= rule.value;
    case "grade_count":         return (s.gradeCounts[rule.grade] ?? 0) >= rule.value;
    case "challenge_completed": return s.completedChallenges.includes(rule.slug);
    case "challenge_grade": {
      const g = s.challengeGrades[rule.slug];
      return g !== undefined && GRADE_RANK[g] >= GRADE_RANK[rule.minGrade];
    }
    case "tree_outcome":        return s.cleanTreeCases.includes(rule.slug);
    case "comebacks_clean":     return s.comebacksOpen === 0 && s.questionsAnswered >= CLEAN_SHEET_MIN_QUESTIONS;
    default: {
      // Exhaustiveness: adding a rule type without handling it is a compile error, not a
      // silently-never-unlockable sticker.
      const never: never = rule;
      return Boolean(never);
    }
  }
}

/** Every sticker the stats currently qualify for. Idempotent — also serves as the backfill. */
export function unlockedStickers(s: GearStats): Sticker[] {
  return CATALOG.filter((c) => isUnlocked(c.unlockRule, s));
}

export function unlockedSlugs(s: GearStats): string[] {
  return unlockedStickers(s).map((c) => c.slug);
}

/** Progress toward a rule, 0..1 — drives the little bar on a locked card. */
export function ruleProgress(rule: UnlockRule, s: GearStats): number {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  switch (rule.type) {
    case "xp_at_least":        return clamp(s.xp / rule.value);
    case "tier_at_least":      return clamp(s.xp / (TIER_XP[rule.value] || 1));
    case "domain_xp_at_least": return clamp((s.domainXp[rule.domain] ?? 0) / rule.value);
    case "grade_count":        return clamp((s.gradeCounts[rule.grade] ?? 0) / rule.value);
    case "comebacks_clean":    return clamp(s.questionsAnswered / CLEAN_SHEET_MIN_QUESTIONS);
    default:                   return isUnlocked(rule, s) ? 1 : 0; // binary rules
  }
}
