import { scoreToGrade, xpToTier, xpToNextTier, computeSpeedBonus, computeXP, questionXpShare, retryDecayRate } from "@/lib/utils";

describe("scoreToGrade", () => {
  it("A for perfect score", () => expect(scoreToGrade(3,3)).toBe("A"));
  it("B for 2/3", () => expect(scoreToGrade(2,3)).toBe("B"));
  it("C for 1/3", () => expect(scoreToGrade(1,3)).toBe("C"));
  it("F for 0/3", () => expect(scoreToGrade(0,3)).toBe("F"));
  it("F when total is 0", () => expect(scoreToGrade(0,0)).toBe("F"));
});

describe("xpToTier", () => {
  it("Bronze under 1000", () => expect(xpToTier(500)).toBe("Bronze"));
  it("Silver at 1000", () => expect(xpToTier(1000)).toBe("Silver"));
  it("Gold at 2500", () => expect(xpToTier(2500)).toBe("Gold"));
  it("Platinum at 5000", () => expect(xpToTier(5000)).toBe("Platinum"));
  it("Master at 10000", () => expect(xpToTier(10000)).toBe("Master"));
});

describe("xpToNextTier", () => {
  it("shows progress toward Silver", () => {
    const r = xpToNextTier(500);
    expect(r.next).toBe("Silver"); expect(r.needed).toBe(500);
  });
  it("Master has 0 needed", () => {
    const r = xpToNextTier(15000);
    expect(r.next).toBe("Master"); expect(r.needed).toBe(0);
  });
});

describe("computeSpeedBonus", () => {
  it("no bonus for wrong answer", () => expect(computeSpeedBonus(5,100,false)).toBe(0));
  it("full bonus at <=10s", () => expect(computeSpeedBonus(8,150,true)).toBeGreaterThan(0));
  it("no bonus at time limit", () => expect(computeSpeedBonus(45,150,true)).toBe(0));
  it("partial bonus decays linearly", () => {
    const fast = computeSpeedBonus(10,150,true);
    const slow = computeSpeedBonus(30,150,true);
    expect(slow).toBeLessThan(fast);
  });
});

describe("computeXP unaffected by grading changes", () => {
  it("still returns 0 when correct is 0", () => expect(computeXP(100,0,3)).toBe(0));
  it("full reward on perfect score", () => expect(computeXP(100,3,3)).toBe(100));
});

describe("questionXpShare", () => {
  it("splits evenly when divisible", () => {
    expect(questionXpShare(90,0,3)).toBe(30);
    expect(questionXpShare(90,1,3)).toBe(30);
    expect(questionXpShare(90,2,3)).toBe(30);
  });
  it("gives remainder to earliest tier_orders", () => {
    expect(questionXpShare(100,0,3)).toBe(34);
    expect(questionXpShare(100,1,3)).toBe(33);
    expect(questionXpShare(100,2,3)).toBe(33);
  });
  it("shares always sum to the full reward", () => {
    for (const reward of [100,90,151,1]) {
      let sum=0;
      for (let t=0;t<3;t++) sum+=questionXpShare(reward,t,3);
      expect(sum).toBe(reward);
    }
  });
});

describe("retryDecayRate", () => {
  it("full rate on the first attempt", () => expect(retryDecayRate(1)).toBe(1));
  it("halves on the first retry", () => expect(retryDecayRate(2)).toBe(0.5));
  it("halves again on the second retry", () => expect(retryDecayRate(3)).toBe(0.25));
  it("keeps halving on further retries", () => expect(retryDecayRate(4)).toBe(0.125));
});
