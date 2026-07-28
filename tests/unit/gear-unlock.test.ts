// Unlock rules are credentials, so they get the same treatment as the scoring code: pure,
// exhaustive, and tested. This file also pins the invariant that XP is never spent.
import { CATALOG, MAX_EQUIPPED } from "@/lib/gear/catalog";
import { isUnlocked, unlockedSlugs, ruleProgress, emptyStats, type GearStats } from "@/lib/gear/unlock";

const stats = (o: Partial<GearStats> = {}): GearStats => ({ ...emptyStats(), ...o });

describe("gear unlock rules", () => {
  it("a brand-new tech has nothing unlocked", () => {
    expect(unlockedSlugs(stats())).toEqual([]);
  });

  it("cohort rule grants the beta decal", () => {
    expect(unlockedSlugs(stats({ cohort: "houston-beta" }))).toContain("founding-tech");
    expect(unlockedSlugs(stats({ cohort: "other" }))).not.toContain("founding-tech");
  });

  it("tier rules key off the real TIER_XP thresholds", () => {
    expect(unlockedSlugs(stats({ xp: 2499 }))).not.toContain("gold-tier");
    expect(unlockedSlugs(stats({ xp: 2500 }))).toContain("gold-tier");
    expect(unlockedSlugs(stats({ xp: 9999 }))).not.toContain("master-tier");
    expect(unlockedSlugs(stats({ xp: 10000 }))).toContain("master-tier");
  });

  it("domain rules are domain-specific", () => {
    const netOnly = stats({ domainXp: { Network: 600 } });
    expect(unlockedSlugs(netOnly)).toContain("sixty-ohm");
    expect(unlockedSlugs(netOnly)).not.toContain("sparky");
  });

  it("a tree decal needs a CLEAN outcome on that specific case", () => {
    expect(unlockedSlugs(stats({ cleanTreeCases: ["p0420-second-opinion"] }))).toContain("cat-whisperer");
    // finishing the other case doesn't grant it
    expect(unlockedSlugs(stats({ cleanTreeCases: ["cooling-second-opinion"] }))).not.toContain("cat-whisperer");
  });

  it("the clean-sheet decal needs BOTH an empty pile and enough volume", () => {
    expect(unlockedSlugs(stats({ comebacksOpen: 0, questionsAnswered: 49 }))).not.toContain("no-comebacks");
    expect(unlockedSlugs(stats({ comebacksOpen: 1, questionsAnswered: 500 }))).not.toContain("no-comebacks");
    expect(unlockedSlugs(stats({ comebacksOpen: 0, questionsAnswered: 50 }))).toContain("no-comebacks");
  });

  it("a grade-qualified rule needs BOTH the challenge and a good enough grade", () => {
    // Draw Hunter wants a B or better on the parasitic-draw challenge.
    expect(unlockedSlugs(stats({ challengeGrades: { "parasitic-draw-tahoe": "C" } }))).not.toContain("parasitic-draw");
    expect(unlockedSlugs(stats({ challengeGrades: { "parasitic-draw-tahoe": "B" } }))).toContain("parasitic-draw");
    expect(unlockedSlugs(stats({ challengeGrades: { "parasitic-draw-tahoe": "A" } }))).toContain("parasitic-draw");
    // a good grade on a DIFFERENT challenge doesn't count
    expect(unlockedSlugs(stats({ challengeGrades: { "some-other-slug": "A" } }))).not.toContain("parasitic-draw");
    // Bus Master demands an A specifically — a B is not enough
    expect(unlockedSlugs(stats({ challengeGrades: { "u0101-no-comm-tcm": "B" } }))).not.toContain("bus-master");
    expect(unlockedSlugs(stats({ challengeGrades: { "u0101-no-comm-tcm": "A" } }))).toContain("bus-master");
  });

  it("unlocking is monotonic — earning more never takes a decal away", () => {
    const before = unlockedSlugs(stats({ xp: 2500, cohort: "houston-beta" }));
    const after = unlockedSlugs(stats({ xp: 12000, cohort: "houston-beta" }));
    for (const s of before) expect(after).toContain(s);
  });

  it("THE INVARIANT: no rule can be satisfied by spending — rules only read earned state", () => {
    // Every rule type is a threshold/membership test. If a 'cost' or 'balance' rule ever appears,
    // this test should fail and force a rethink: spending XP would let a tech drop a tier.
    const kinds = new Set(CATALOG.map((c) => c.unlockRule.type));
    for (const k of kinds) {
      expect(["cohort","xp_at_least","tier_at_least","domain_xp_at_least","grade_count",
        "challenge_completed","challenge_grade","tree_outcome","comebacks_clean"]).toContain(k);
    }
  });

  it("progress is 0..1 and hits 1 exactly when unlocked", () => {
    for (const c of CATALOG) {
      const s = stats({ xp: 12000, cohort: "houston-beta",
        domainXp: { Network: 9999, Electrical: 9999 }, gradeCounts: { A: 99 },
        challengeGrades: { "parasitic-draw-tahoe": "A", "u0101-no-comm-tcm": "A" },
        cleanTreeCases: ["p0420-second-opinion","cooling-second-opinion"],
        comebacksOpen: 0, questionsAnswered: 999 });
      const p = ruleProgress(c.unlockRule, s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(isUnlocked(c.unlockRule, s)).toBe(true);
      expect(p).toBe(1);
    }
  });

  it("catalog is well-formed: unique slugs, sane box size", () => {
    expect(new Set(CATALOG.map((c) => c.slug)).size).toBe(CATALOG.length);
    expect(CATALOG.every((c) => c.requirement.length > 0 && c.legend.length <= 6)).toBe(true);
    expect(MAX_EQUIPPED).toBeGreaterThan(0);
    expect(MAX_EQUIPPED).toBeLessThan(CATALOG.length);
  });
});
