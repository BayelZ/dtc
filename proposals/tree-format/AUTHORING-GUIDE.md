# Authoring a good diagnostic tree

What we learned building six cases. The DECISION-MEMO says *why* the format exists and §4 lists the
hard gates; this is the craft guide — how to actually make one good. Read both before authoring.

---

## 1. Start with the discriminator, not the fault

Every good tree we built turned out to be organized around **one question that splits the hypothesis
space**, and every weak one lacked it. Find that question first; the case is built around it.

| Case | The discriminator |
|---|---|
| Head gasket | Combustion gases in the coolant — yes or no? |
| Catalyst | Is the rear O2 sensor telling the truth? |
| Shudder | Does it track engine RPM or road speed? |
| CAN bus | Does the bus measure 60 ohms — and if not, which way is it wrong? |

If you can't name the discriminator in one sentence, you don't have a tree yet — you have a topic.
A single obvious cause or a pure procedure stays an MCQ.

**The discriminator must be a test, not a hunch**, and running it must be a *choice* the tech makes,
not something the intake hands them.

## 2. Build the fault set as competing hypotheses in one system

3-4 seeds sharing one node graph. Each seed is a genuinely plausible answer to the same complaint.
The set should span:

- **A cheap fix** (a $20 cap, an exhaust leak, a fluid service) — proves the expensive quote wrong.
- **A "no parts" fix** where the answer is a procedure, not a component, if the system allows one.
- **An expensive fix that is genuinely right** — but only provable by the discriminating test.
  This is the seed that makes the case honest: sometimes the big job *is* the job.
- **A compound fault** (see §4).

The correct *reasoning* is seed-invariant; the *culprit* is not. That's the whole anti-AI property —
there is nothing to paste until the tech has already run tests and seen seed-specific numbers.

## 3. Length comes from decision depth, never padding

The first prototypes felt short because they were an MCQ in a trench coat: intake → one test →
commit → done. More "Continue" clicks don't fix that. These do:

**a) Interleaved knowledge checks (`quiz` nodes).** Between diagnostic steps, ask *how* the test
works — where to sample, what the reagent reacts to, how to hook it up, what a healthy reading is.
It lengthens the case with decisions that carry weight, teaches the procedure inline, and scores on
a separate knowledge axis. **2-3 per case**, placed as a gate before the test they explain. More
than 3 and it stops feeling like a repair order.

**b) A real verification phase.** Not baked into the repair — its own decision: road-test and re-run
the confirming test, or hand back the keys. Skipping it must cost. This is the single most
realistic beat in the whole format and it's cheap to author.

**c) An Act 2.** The case shouldn't end at the first commitment (see §4).

## 4. Compound faults are what make it a story

One fault is a puzzle; two is a story. The strongest pattern we have:

> The tech fixes the obvious thing → it *seems* right → verification surfaces a second problem.

The canonical version is **"the expensive part really is dead, but something killed it."** Replace
the catalytic converter without fixing the misfire that cooked it and you get a comeback — correctly,
computed from data, not hand-written. Compound seeds are also where the outcome/process split earns
its keep: great process, wrong scope, zero XP.

Give a compound seed a repair option that addresses **both** faults, and one that addresses only the
obvious one. Never label which is which.

## 5. Write it like a tech, not like a textbook

The lesson that cost us a rewrite: on a 2013 Cruze 1.4T, "coolant at the water-pump weep hole" is
the *textbook* external leak. The one that actually fails is the **plastic coolant outlet housing**
and the **surge-tank cap**. Both are mechanically correct; only one sounds like someone who has done
ten of them.

- **Name the platform-specific part**, not the generic component. Verify against forums/TSBs.
- Use bench vocabulary: back-probe, weep, heat-soak, prime, book time, comeback, RO.
- The complaint is in **service-writer voice** (`CUST STATES:`), not engineering prose.
- Readouts state **evidence, never the verdict**. "The fluid turns yellow within a minute" —
  never "the head gasket is leaking."
- Decision options are **commitments** ("It's the outlet housing — replace it"), never claims about
  a test result that might be false on this seed ("Pressure test found a leak").

## 6. Distractors and dead ends

- Distractors are **plausible same-system competing hypotheses**. Never "do nothing," never a
  cross-system absurdity, never a stem that contains its own answer.
- At least one **recoverable dead end**: costs real book time, returns to the bench. The parts
  cannon ("just replace it, they always go bad") belongs at the intake as a negative-weight option —
  it is the single most authentic wrong move in the trade.
- Showing only the true cause among the options gives the answer away. **You must be able to rule
  things out.**

## 7. Quiz-content gates (same rigor as the MCQ bank)

`CLAUDE.md`'s content rules apply in full to `quiz` nodes — this is exactly where they'd rot first:

- **Distribute the correct answer across A/B/C/D.** Check the whole batch, not one case.
- **No length tell** — keep the correct option within ~6 characters of the longest distractor.
- **No phrase tell** — no wording that appears only in wrong answers.
- One `correct: true` per quiz, and an `explanation` that teaches the principle, not the answer.

## 8. Economy and time

- **Time budget = diagnostic time only.** Repairs cost 0 budget-minutes, or an 8-hour head-gasket job
  swamps path efficiency. The cost of a wrong big repair lives in the **outcome narrative**
  ("you sold them a $2,400 job they didn't need"), not the clock.
- Budget ≈ the ideal path plus one wrong turn. Tight enough that flailing hurts, loose enough that
  thorough work isn't punished.
- All `timeCost` values are **placeholders until an SME confirms book time** — flag them.

## 9. The bar for shipping

A case earns the format if it has most of: competing hypotheses · a discriminating test where order
matters · a misleading lead · cost asymmetry · a "no parts" seed and an "expensive fix is right"
seed · **unsolvable from the intake alone** · a real verification step · a compound fault ·
one transferable principle a tech carries to a different car.

That last one matters most. "Test both paths under load," "prove the converter with the sensor you
trust," "does it follow RPM or road speed," "60 ohms or it isn't a healthy bus" — the case is a
vehicle for the principle.

## 10. Mechanics checklist (schema)

- Non-branching links use `nextNodeId` (+ `continueLabel`), never a single-option array.
- `quiz` nodes route via their answer options; exactly one `correct: true`; no `nextNodeId`.
- `commitsTo` must name a real fault **and** agree with the repair it routes to.
- Repairs either `repairs: [faultId...]` (explicit swap) or `repairScope` (fix what testing revealed).
- Seed `resultOverrides` keys and `revealedBy` must reference real node ids.
- Outcome nodes are terminal and carry `condition`; the resolver needs both
  `all-faults-repaired` and `faults-remain`.
- Tree JSONs are duplicated in `proposals/` (canonical) and `src/lib/tree/` (what runs) — `cp` after
  every edit. Fix this before the real build.
