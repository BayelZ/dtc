# Seed-aware outcomes — schema sketch

Design sketch only (not built). Turns the ending from a hardcoded edge into something
*computed against the real fault*. Additive and backward-compatible: a tree without the
new fields behaves exactly like the current static prototype.

## The idea in one line
`outcome = compare( what the tech repaired , what this seed actually had )`
— and you can only repair a fault you actually **revealed** by running the test that shows it.

## Schema changes (3 additive fields + a sentinel)

```ts
// 1) The seed declares its real faults, each tied to the test that reveals it.
interface SeedFault {
  id: string;           // "pos_feed" | "ground_strap" | "battery" | "pos_terminal"
  label: string;        // "corroded B+ cable end" — used in outcome text
  revealedBy: string;   // nodeId of the test that shows it out of spec, e.g. "act_vdrop_pos"
}

interface FaultSeed {
  id: string;
  internalNote: string;
  activeFaults: SeedFault[];              // NEW — what's actually wrong this run
  resultOverrides: Record<string, string>;
}

// 2) A repair node says how much it fixes.
interface DiagNode {
  id: string;
  type: NodeType;
  prompt: string;
  timeCost?: number;
  options?: DiagOption[];
  repairScope?: "all-revealed" | "first-revealed"; // NEW — repair nodes only
  condition?: "all-faults-repaired" | "faults-remain" | "wrong-system"; // NEW — outcome nodes only
}
```

```ts
// 3) Repair options route to a resolver instead of a fixed outcome node.
//    Sentinel target — the runner computes which outcome to show.
{ label: "Fix the first out-of-spec reading and release", targetNodeId: "#resolve", scoreWeight: 1 }
```

Outcome nodes are now selected by `condition` (out_good = "all-faults-repaired",
out_comeback = "faults-remain", out_starter_wrong = "wrong-system"), and their text
comes from `resultOverrides` per seed — which can name the leftover fault.

## Resolver (runner logic — ~15 lines)

```ts
function resolveOutcome(seed, revealedFaultIds, repairScope, verified) {
  const present  = seed.activeFaults.map(f => f.id);
  // you can only fix what you actually found under load:
  const revealed = seed.activeFaults.filter(f => revealedFaultIds.has(f.revealedBy)).map(f => f.id);
  const repaired = repairScope === "all-revealed" ? revealed : revealed.slice(0, 1);
  const remaining = present.filter(id => !repaired.includes(id));

  if (remaining.length === 0 && verified) return byCondition("all-faults-repaired"); // fixed right
  if (remaining.length === 0)            return byCondition("all-faults-repaired-unverified"); // optional softer win
  return { outcome: byCondition("faults-remain"), remaining };  // comeback — name `remaining`
}
```

`revealedFaultIds` = the set of test nodes the tech ran (already trackable from the path).
`verified` = whether they took the "re-drop both paths + cold-crank" repair.

The one subtlety that makes it feel right: **a fault you never tested for can't be
repaired.** If you never voltage-drop the ground path, `ground_strap` is never in
`revealed`, so even "repair everything I found" leaves it → comeback. That's the case's
real lesson, enforced by the data instead of hand-written per branch.

## Worked example — the exact bug from playtest

Choice: **"Fix the first out-of-spec reading and release"** (`repairScope: "first-revealed"`, `verified: false`)

| Seed (activeFaults) | Tests the tech ran | repaired | remaining | Outcome |
|---|---|---|---|---|
| dual: `pos_feed`, `ground_strap` | dropped both paths | `pos_feed` | `ground_strap` | **comeback** — "ground strap untouched" |
| **ground-only: `ground_strap`** | dropped both paths | `ground_strap` | — | **fixed right** ✅ (currently mis-narrates a comeback) |
| ground-only: `ground_strap` | dropped **positive only** | — (never revealed) | `ground_strap` | **comeback** — "you never tested the ground path" |
| battery: `battery`, `pos_terminal` | load-test + dropped positive | `battery` (first) | `pos_terminal` | **comeback** — "loose positive terminal left" |

Same option, four honest endings — because the ending checks the real fault, not a fixed edge.

## Migration impact
None to storage: `activeFaults` / `repairScope` / `condition` live inside the same `tree`
JSONB document (proposed `challenge_trees.tree`). Only the Zod schema and the (not-yet-built)
runner change. The current flat prototype keeps working — trees without these fields fall
back to static `targetNodeId` edges.
