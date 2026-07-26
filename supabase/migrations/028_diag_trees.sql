-- 028_diag_trees.sql — the two beta diagnostic-tree cases.
-- Additive and idempotent: creates one new table and seeds two rows. Both ship
-- is_published = false, so applying this migration changes NOTHING a user can see until you
-- flip the flag (statement at the bottom of this file).
--
-- Creates the isolated challenge_trees table and seeds the TWO approved beta cases:
--   * cooling-second-opinion  — "Everyone Said Head Gasket"  (2013 Cruze 1.4T)
--   * p0420-second-opinion    — "The Cat That Wasn't Dead"   (2013 Camry 2.5L)
--
-- Does NOT touch challenges/questions/challenge_attempts, auth, or any existing RLS policy.
-- Tree documents are validated app-side by proposals/tree-format/diag-tree.schema.ts (Zod);
-- both documents below pass it, and are byte-identical to the files the runner loads.

CREATE TABLE IF NOT EXISTS public.challenge_trees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL,
  source_challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  tree                JSONB NOT NULL,
  is_published        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.challenge_trees IS
  'Branching diagnostic-tree challenges (DiagChallenge JSON). Separate from challenges/questions by design.';

-- RLS BOUNDARY NOTE: enables RLS + a SELECT policy on a NEW table only; alters no existing
-- policy. Published rows are readable by authenticated users; unpublished stay staff-only
-- (service role bypasses RLS), so a tree can be loaded and reviewed before it goes live.
ALTER TABLE public.challenge_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenge_trees_select ON public.challenge_trees;
CREATE POLICY challenge_trees_select ON public.challenge_trees
  FOR SELECT TO authenticated USING (is_published = true);

-- No INSERT/UPDATE/DELETE policy on purpose: content is authored via the service role,
-- mirroring how questions content is managed today.

-- ── Everyone Said Head Gasket — 2013 Chevrolet Cruze · 4 seeds · 3 knowledge checks ──
-- DOMAIN: unmapped (cooling / engine mechanical — see DOMAIN GAP note below)
INSERT INTO public.challenge_trees (slug, title, tree, is_published)
VALUES (
  'cooling-second-opinion',
  'Everyone Said Head Gasket',
  $tree${
  "id": "cooling-second-opinion",
  "title": "Everyone Said Head Gasket",
  "vehicle": {
    "year": 2013,
    "make": "Chevrolet",
    "model": "Cruze",
    "engine": "1.4L Turbo"
  },
  "complaintTemplate": "CUST STATES: runs hot on the highway and needs a splash of coolant every week or so. Temp gauge spikes then drops; heater blows cold sometimes. Another shop said head gasket and quoted $2,400 — customer wants a second opinion before spending it.",
  "faultSeeds": [
    {
      "id": "seed_headgasket",
      "internalNote": "The expensive answer is the RIGHT one this time — but only provable with a combustion/block test. Combustion gases are entering the coolant (positive block test), pressurizing the system and pushing coolant out; it holds pressure externally. Correct fix: head gasket. Condemning it WITHOUT the block test is a lucky guess, not a diagnosis. Confirming test: act_combustion_test.",
      "activeFaults": [
        {
          "id": "head_gasket",
          "label": "head gasket leaking combustion gases into the cooling system",
          "revealedBy": "act_combustion_test"
        }
      ],
      "resultOverrides": {
        "act_combustion_test": "The block-test fluid turns yellow within a minute of running — combustion gases are present in the coolant.",
        "act_pressure_test": "It holds 15 psi externally — no drips at the outlet housing or hoses — but the needle creeps up as combustion gas pressurizes the system.",
        "act_cap_test": "The surge-tank cap holds its 15-psi rating on the tester — the cap is fine.",
        "act_bleed_check": "It bleeds and burps, the thermostat opens — then the reservoir pressurizes and pushes over again on the test drive.",
        "act_top_off": "You top it off. Normal in the bay, then the reservoir pressurizes and pushes coolant out within a few heat cycles."
      }
    },
    {
      "id": "seed_outlet_housing",
      "internalNote": "The notorious Cruze 1.4T external leak: the plastic coolant/water-outlet housing at the back of the head cracks at the seam and weeps under pressure. No combustion gases; the system won't hold pressure and you find the source. Correct fix: coolant outlet housing. Condemning the head gasket here is a $2,400 mistake. Confirming test: act_pressure_test.",
      "activeFaults": [
        {
          "id": "outlet_housing",
          "label": "cracked plastic coolant/water-outlet housing weeping under pressure",
          "revealedBy": "act_pressure_test"
        }
      ],
      "resultOverrides": {
        "act_combustion_test": "The block-test fluid stays blue after several minutes running — no combustion gases in the coolant.",
        "act_pressure_test": "It won't hold — pressure bleeds down from 15 psi and coolant weeps from the seam of the plastic coolant/water-outlet housing at the back of the head.",
        "act_cap_test": "The cap holds its 15-psi rating on the tester — not the cap.",
        "act_bleed_check": "It bleeds fine and the thermostat opens, but coolant keeps disappearing between drives.",
        "act_top_off": "You top it off; a damp trail and dried coolant crust show up at the outlet housing by the next morning."
      }
    },
    {
      "id": "seed_cap",
      "internalNote": "The cheapest fix and the classic Cruze 1.4T trap: a $20 surge-tank pressure cap that won't hold its 15-psi rating, so the system boils up into the reservoir and pushes over. No combustion gases, holds pressure with a tester on, no external leak — the cap itself is the fault. Correct fix: surge-tank cap. Condemning the head gasket here is the worst-value mistake. Confirming test: act_cap_test.",
      "activeFaults": [
        {
          "id": "surge_cap",
          "label": "surge-tank pressure cap not holding its 15-psi rating",
          "revealedBy": "act_cap_test"
        }
      ],
      "resultOverrides": {
        "act_combustion_test": "The block-test fluid stays blue — no combustion gases in the coolant.",
        "act_pressure_test": "With the tester's adapter on, the system holds 15 psi steadily — no external leak, no bleed-down.",
        "act_cap_test": "The surge-tank cap won't hold its rating — it vents off well below 15 psi on the tester. It's been releasing early and letting the system boil up into the tank.",
        "act_bleed_check": "It bleeds and burps fine; the thermostat opens. But it still pushes coolant over on a hard heat cycle.",
        "act_top_off": "You top it off; it boils up into the reservoir and pushes over again the next time it gets hot."
      }
    },
    {
      "id": "seed_air_pocket",
      "internalNote": "No parts. A prior shop did a coolant service and never properly bled this hard-to-fill system — trapped air causes hot spots, gauge spikes, and the cold-heater complaint. No combustion gases, holds pressure, cap holds, no external leak. Correct fix: proper vacuum-fill / bleed, NO PARTS. Condemning the head gasket here is a $2,400 mistake over air. Confirming test: act_bleed_check.",
      "activeFaults": [
        {
          "id": "air_pocket",
          "label": "trapped air from an improper coolant fill (never correctly bled)",
          "revealedBy": "act_bleed_check"
        }
      ],
      "resultOverrides": {
        "act_combustion_test": "The block-test fluid stays blue — no combustion gases in the coolant.",
        "act_pressure_test": "It holds 15 psi steadily — no external leak, and the cap holds spec.",
        "act_cap_test": "The cap holds its 15-psi rating fine.",
        "act_bleed_check": "As you vacuum-fill it, a big slug of trapped air pulls out of the heater core and block; the upper hose finally heats evenly and the gauge steadies. The last coolant service was never properly bled.",
        "act_top_off": "You top it off; the gauge still spikes on the drive because the air is still trapped."
      }
    }
  ],
  "nodes": [
    {
      "id": "intake",
      "type": "intake",
      "prompt": "A $2,400 head-gasket quote from the last shop, coolant disappearing weekly, a gauge that spikes and drops. Before you sell — or rule out — that job, where do you start?",
      "options": [
        {
          "label": "Block/combustion-test the coolant to rule a head gasket in or out",
          "targetNodeId": "q_block_sample",
          "scoreWeight": 3
        },
        {
          "label": "Pressure-test the system and cap, and find where it's going",
          "targetNodeId": "q_pressure_how",
          "scoreWeight": 3
        },
        {
          "label": "Pull it in and run a full cooling-system workup",
          "targetNodeId": "bay",
          "scoreWeight": 1
        },
        {
          "label": "The other shop already said head gasket — just do the job",
          "targetNodeId": "repair_hg",
          "scoreWeight": -5
        }
      ]
    },
    {
      "id": "bay",
      "type": "action",
      "prompt": "On the lift, cold, cap off. What's your move?",
      "timeCost": 0,
      "options": [
        {
          "label": "Block/combustion-test the coolant (combustion gases present?)",
          "targetNodeId": "q_block_sample",
          "scoreWeight": 3
        },
        {
          "label": "Pressure-test the cooling system and look for an external leak",
          "targetNodeId": "q_pressure_how",
          "scoreWeight": 3
        },
        {
          "label": "Pressure-test the surge-tank cap on the cap tester",
          "targetNodeId": "act_cap_test",
          "scoreWeight": 2
        },
        {
          "label": "Vacuum-fill / bleed and check for trapped air",
          "targetNodeId": "act_bleed_check",
          "scoreWeight": 2
        },
        {
          "label": "Top off the coolant and tell them to watch it",
          "targetNodeId": "act_top_off",
          "scoreWeight": -2
        },
        {
          "label": "I'm ready to commit to a root cause",
          "targetNodeId": "decision",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "q_block_sample",
      "type": "quiz",
      "prompt": "Combustion gases collect at the highest point of the cooling system. On this car — which is filled at the surge tank, with no radiator cap — where do you draw the block-test sample?",
      "explanation": "The reagent samples vapor at the highest point of the system; this platform fills at the surge tank, so that's where you pull from — there's no radiator cap to sample.",
      "options": [
        {
          "label": "From the radiator's own cap opening",
          "targetNodeId": "q_blocktest_fluid",
          "scoreWeight": 0
        },
        {
          "label": "From the surge-tank neck, engine warm, cap off",
          "targetNodeId": "q_blocktest_fluid",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "From the lower radiator hose down at the pump",
          "targetNodeId": "q_blocktest_fluid",
          "scoreWeight": 0
        },
        {
          "label": "From the overflow tube where it vents",
          "targetNodeId": "q_blocktest_fluid",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "q_blocktest_fluid",
      "type": "quiz",
      "prompt": "The block test (combustion-leak test) works by —",
      "explanation": "The blue reagent is pH-sensitive; dissolved combustion CO2 turns it yellow-green. It reacts to combustion-gas chemistry, not to heat or pressure.",
      "options": [
        {
          "label": "reacting to coolant temperature crossing a set point",
          "targetNodeId": "act_combustion_test",
          "scoreWeight": 0
        },
        {
          "label": "trapping hydrocarbons from burning oil in the coolant",
          "targetNodeId": "act_combustion_test",
          "scoreWeight": 0
        },
        {
          "label": "changing color as dissolved combustion CO2 shifts its pH",
          "targetNodeId": "act_combustion_test",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "detecting pressure pulses that push vapor up the tube",
          "targetNodeId": "act_combustion_test",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "act_combustion_test",
      "type": "action",
      "prompt": "You run the block test — combustion-leak fluid over the surge-tank neck with the engine running — watching for the reagent to change color.",
      "timeCost": 15,
      "options": [
        {
          "label": "Log it and cross-check the external side with a pressure test",
          "targetNodeId": "q_pressure_how",
          "scoreWeight": 2
        },
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "q_pressure_how",
      "type": "quiz",
      "prompt": "How do you run the cooling-system pressure test here?",
      "explanation": "You pressurize to the cap's rating cold with a hand pump and watch for bleed-down. Revving the engine or feeding shop air can damage the system or mask where it's actually leaking.",
      "options": [
        {
          "label": "Pump to the cap's 15-psi rating cold and watch for bleed-down",
          "targetNodeId": "act_pressure_test",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "Rev the engine to build pressure and watch the gauge climb",
          "targetNodeId": "act_pressure_test",
          "scoreWeight": 0
        },
        {
          "label": "Feed shop air into the reservoir until it starts to leak",
          "targetNodeId": "act_pressure_test",
          "scoreWeight": 0
        },
        {
          "label": "Take it straight to 30 psi to force a hidden leak open",
          "targetNodeId": "act_pressure_test",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "act_pressure_test",
      "type": "action",
      "prompt": "You hand-pump the cooling system to 15 psi cold and watch for bleed-down and external seepage.",
      "timeCost": 15,
      "options": [
        {
          "label": "Log it and block-test for combustion gases too",
          "targetNodeId": "q_block_sample",
          "scoreWeight": 2
        },
        {
          "label": "Log it and pressure-test the cap on the tester",
          "targetNodeId": "act_cap_test",
          "scoreWeight": 2
        },
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "act_cap_test",
      "type": "action",
      "prompt": "You put the surge-tank cap on the cap tester and pump it to its rating, watching whether it holds.",
      "timeCost": 5,
      "options": [
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 2
        },
        {
          "label": "Cross-check the rest of the system first",
          "targetNodeId": "bay",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "act_bleed_check",
      "type": "action",
      "prompt": "You vacuum-fill and bleed the system, watching whether the upper hose heats evenly, the thermostat opens, and how much air comes out.",
      "timeCost": 10,
      "options": [
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 2
        },
        {
          "label": "Cross-check with a block and pressure test first",
          "targetNodeId": "bay",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "act_top_off",
      "type": "action",
      "prompt": "You top off the coolant.",
      "timeCost": 5,
      "nextNodeId": "bay",
      "continueLabel": "That's not a diagnosis — back to the workup."
    },
    {
      "id": "decision",
      "type": "decision",
      "prompt": "Commit to a specific root cause. Remember the customer is about to spend $2,400 on someone's word.",
      "options": [
        {
          "label": "It's the head gasket — pull it and do the gasket job",
          "targetNodeId": "repair_hg",
          "commitsTo": "head_gasket",
          "scoreWeight": 6
        },
        {
          "label": "It's the plastic coolant/water-outlet housing — replace it",
          "targetNodeId": "repair_outlet",
          "commitsTo": "outlet_housing",
          "scoreWeight": 6
        },
        {
          "label": "It's the surge-tank pressure cap — replace the cap",
          "targetNodeId": "repair_cap",
          "commitsTo": "surge_cap",
          "scoreWeight": 6
        },
        {
          "label": "No parts — it was never properly bled; vacuum-fill and burp it",
          "targetNodeId": "repair_bleed",
          "commitsTo": "air_pocket",
          "scoreWeight": 6
        },
        {
          "label": "The other shop's probably right — just do the head gasket",
          "targetNodeId": "repair_hg",
          "scoreWeight": -4
        },
        {
          "label": "Top it off and tell them to keep an eye on it",
          "targetNodeId": "repair_topoff",
          "scoreWeight": -3
        }
      ]
    },
    {
      "id": "repair_hg",
      "type": "repair",
      "prompt": "You do the head-gasket job — pull the head, replace the gasket, resurface as needed, refill and bleed. (Book job: ~8 hours, $2,400.)",
      "timeCost": 0,
      "repairs": [
        "head_gasket"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_outlet",
      "type": "repair",
      "prompt": "You replace the plastic coolant/water-outlet housing (and the recovery-tank hose while you're in there), then refill and bleed.",
      "timeCost": 0,
      "repairs": [
        "outlet_housing"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_cap",
      "type": "repair",
      "prompt": "You install a new surge-tank pressure cap — a $20 part, ten minutes.",
      "timeCost": 0,
      "repairs": [
        "surge_cap"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_bleed",
      "type": "repair",
      "prompt": "You properly vacuum-fill and bleed the system — no parts.",
      "timeCost": 0,
      "repairs": [
        "air_pocket"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_topoff",
      "type": "repair",
      "prompt": "You top it off and send it with a 'keep an eye on the level.'",
      "timeCost": 0,
      "repairs": [],
      "nextNodeId": "#resolve",
      "continueLabel": "Hand back the keys"
    },
    {
      "id": "verify",
      "type": "action",
      "prompt": "Before you hand back the keys — how do you confirm the fix held?",
      "timeCost": 0,
      "options": [
        {
          "label": "Road-test through a full heat cycle and re-run the confirming test",
          "targetNodeId": "act_roadtest",
          "scoreWeight": 2
        },
        {
          "label": "It settled down at idle in the bay — release it",
          "targetNodeId": "#resolve",
          "scoreWeight": -3
        }
      ]
    },
    {
      "id": "act_roadtest",
      "type": "action",
      "prompt": "You heat-cycle it on a road test and re-run the test that flagged the fault, watching the gauge and the reservoir the whole way.",
      "timeCost": 12,
      "nextNodeId": "#resolve",
      "continueLabel": "Release the vehicle"
    },
    {
      "id": "out_good",
      "type": "outcome",
      "condition": "all-faults-repaired",
      "prompt": "It holds temperature through a full heat-cycle and road test, no coolant loss, heater hot. Fixed — and if it was the head gasket, you sold it on a positive block test, not a hunch. If it wasn't, you saved the customer $2,400."
    },
    {
      "id": "out_comeback",
      "type": "outcome",
      "condition": "faults-remain",
      "prompt": "It's back, still running hot and dropping coolant. The real cause was never addressed."
    }
  ],
  "scoringRules": {
    "decisionNodeWeight": 5,
    "pathEfficiencyWeight": 2,
    "repairSelectionWeight": 3,
    "timeBudgetMinutes": 70
  }
}$tree$::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET tree = EXCLUDED.tree, title = EXCLUDED.title, updated_at = now();

-- ── The Cat That Wasn't Dead — 2013 Toyota Camry · 3 seeds · 3 knowledge checks ──
INSERT INTO public.challenge_trees (slug, title, tree, is_published)
VALUES (
  'p0420-second-opinion',
  'The Cat That Wasn''t Dead',
  $tree${
  "id": "p0420-second-opinion",
  "title": "The Cat That Wasn't Dead",
  "vehicle": {
    "year": 2013,
    "make": "Toyota",
    "model": "Camry",
    "engine": "2.5L"
  },
  "complaintTemplate": "CUST STATES: check-engine light came on, shop pulled P0420 and quoted $1,400 for a catalytic converter. Car runs fine, no noise, mileage seems normal. Customer wants a second opinion before buying a converter.",
  "faultSeeds": [
    {
      "id": "seed_exhaust_leak",
      "internalNote": "Cheap fix. A hairline crack in the flex pipe just ahead of the rear O2 bung lets exhaust pulses draw outside air in; the rear sensor sees that oxygen and reports a converter that isn't storing any. Converter is fine. Correct fix: repair the exhaust leak. Confirming test: act_exhaust_smoke.",
      "activeFaults": [
        {
          "id": "exhaust_leak",
          "label": "cracked flex pipe drawing air in ahead of the rear O2 sensor",
          "revealedBy": "act_exhaust_smoke"
        }
      ],
      "resultOverrides": {
        "act_scope_o2": "The upstream sensor switches normally. The downstream sensor wanders and drifts lean instead of holding steady — but it does move when you force the mixture rich.",
        "act_exhaust_smoke": "With the tailpipe blocked and the system filled with smoke, smoke seeps steadily from a hairline crack in the flex pipe just ahead of the rear O2 sensor bung.",
        "act_fuel_trims": "Short and long-term trims are within a few percent at idle and cruise. No misfire counts on any cylinder.",
        "act_backpressure": "Backpressure is within spec — nothing is restricted.",
        "act_clear_drive": "The code clears, then P0420 sets again after a couple of drive cycles."
      }
    },
    {
      "id": "seed_rear_o2",
      "internalNote": "The sensor lying about the converter. The downstream O2 sensor is lazy/skewed — it sits at a fixed bias and won't respond to a forced mixture change, so the monitor fails a converter that's actually fine. Correct fix: downstream O2 sensor. Confirming test: act_scope_o2 (specifically that it does NOT respond to a forced rich/lean).",
      "activeFaults": [
        {
          "id": "rear_o2",
          "label": "lazy downstream O2 sensor that won't respond to a forced mixture change",
          "revealedBy": "act_scope_o2"
        }
      ],
      "resultOverrides": {
        "act_scope_o2": "The upstream sensor switches normally. The downstream sensor sits nearly flat at a fixed bias and doesn't move at all when you force the mixture rich, then lean.",
        "act_exhaust_smoke": "The smoke test shows no leaks anywhere ahead of the rear sensor.",
        "act_fuel_trims": "Trims are within a few percent. No misfire counts stored or accumulating.",
        "act_backpressure": "Backpressure is within spec.",
        "act_clear_drive": "The code clears and returns after a couple of drive cycles."
      }
    },
    {
      "id": "seed_cat_and_misfire",
      "internalNote": "COMPOUND — the expensive answer is right, but only halfway. The converter genuinely is dead (rear sensor mirrors the front), AND a chronic cylinder-3 misfire is what cooked it. Replacing the converter alone is a comeback: the misfire kills the new one. Correct fix: repair the misfire AND replace the converter. Confirming tests: act_scope_o2 (dead converter) + act_fuel_trims (the misfire that caused it).",
      "activeFaults": [
        {
          "id": "dead_cat",
          "label": "catalytic converter no longer storing oxygen",
          "revealedBy": "act_scope_o2"
        },
        {
          "id": "misfire",
          "label": "chronic cylinder-3 misfire that cooked the converter",
          "revealedBy": "act_fuel_trims"
        }
      ],
      "resultOverrides": {
        "act_scope_o2": "The upstream sensor switches normally and the downstream sensor mirrors it almost move for move — it is tracking the front sensor instead of staying steady. It does respond to a forced mixture change.",
        "act_exhaust_smoke": "No leaks found anywhere ahead of the rear sensor.",
        "act_fuel_trims": "Cylinder 3 is accumulating misfire counts under load, with a stored history misfire code for that cylinder. The other five stay at zero.",
        "act_backpressure": "Backpressure is slightly elevated but still inside spec.",
        "act_clear_drive": "The code clears and comes back quickly."
      }
    }
  ],
  "nodes": [
    {
      "id": "intake",
      "type": "intake",
      "prompt": "P0420, a $1,400 converter quote, and a car that drives fine. Before you sell that converter — or talk them out of it — where do you start?",
      "options": [
        {
          "label": "Graph both O2 sensors and see what the rear one is actually reporting",
          "targetNodeId": "q_cat_theory",
          "scoreWeight": 3
        },
        {
          "label": "Smoke-test the exhaust for leaks ahead of the rear sensor",
          "targetNodeId": "q_leak_why",
          "scoreWeight": 3
        },
        {
          "label": "Pull freeze frame, fuel trims and misfire data first",
          "targetNodeId": "act_fuel_trims",
          "scoreWeight": 2
        },
        {
          "label": "Pull it in and run a full workup",
          "targetNodeId": "bay",
          "scoreWeight": 1
        },
        {
          "label": "P0420 means converter — sell the converter",
          "targetNodeId": "repair_cat",
          "scoreWeight": -5
        }
      ]
    },
    {
      "id": "bay",
      "type": "action",
      "prompt": "On the lift, scan tool connected. What's your move?",
      "timeCost": 0,
      "options": [
        {
          "label": "Graph both O2 sensors and force a mixture change",
          "targetNodeId": "q_cat_theory",
          "scoreWeight": 3
        },
        {
          "label": "Smoke-test the exhaust ahead of the rear sensor",
          "targetNodeId": "q_leak_why",
          "scoreWeight": 3
        },
        {
          "label": "Check fuel trims and misfire counters",
          "targetNodeId": "act_fuel_trims",
          "scoreWeight": 2
        },
        {
          "label": "Check exhaust backpressure for a restricted converter",
          "targetNodeId": "act_backpressure",
          "scoreWeight": 1
        },
        {
          "label": "Clear the code and tell them to drive it a while",
          "targetNodeId": "act_clear_drive",
          "scoreWeight": -2
        },
        {
          "label": "I'm ready to commit to a root cause",
          "targetNodeId": "decision",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "q_cat_theory",
      "type": "quiz",
      "prompt": "A healthy converter stores and releases oxygen. Compared with the upstream sensor, what should that make the downstream sensor do?",
      "explanation": "A working converter buffers the exhaust, so the rear sensor goes lazy and steady. A rear signal that mirrors the front means the converter isn't storing oxygen — or something is skewing that sensor.",
      "options": [
        {
          "label": "Mirror the upstream sensor switch for switch",
          "targetNodeId": "act_scope_o2",
          "scoreWeight": 0
        },
        {
          "label": "Switch noticeably faster than the upstream sensor does",
          "targetNodeId": "act_scope_o2",
          "scoreWeight": 0
        },
        {
          "label": "Stay relatively steady instead of switching with it",
          "targetNodeId": "act_scope_o2",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "Drop to a fixed zero volts once it is hot",
          "targetNodeId": "act_scope_o2",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "act_scope_o2",
      "type": "action",
      "prompt": "You graph both O2 sensors at operating temperature and force the mixture rich, then lean, watching how each one responds.",
      "timeCost": 12,
      "options": [
        {
          "label": "Log it and smoke-test the exhaust as well",
          "targetNodeId": "q_leak_why",
          "scoreWeight": 2
        },
        {
          "label": "Log it and check trims and misfire data",
          "targetNodeId": "act_fuel_trims",
          "scoreWeight": 2
        },
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "q_leak_why",
      "type": "quiz",
      "prompt": "Why can a pinhole exhaust leak ahead of the rear O2 sensor set a catalyst-efficiency code?",
      "explanation": "Negative pressure pulses draw outside air in through the leak. The rear sensor sees that oxygen and reports a converter that isn't storing any — a false P0420 on a good converter.",
      "options": [
        {
          "label": "It drops backpressure enough to stall the converter",
          "targetNodeId": "act_exhaust_smoke",
          "scoreWeight": 0
        },
        {
          "label": "Pulses draw outside air in, so the rear sensor sees oxygen",
          "targetNodeId": "act_exhaust_smoke",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "It cools the converter below its light-off temperature",
          "targetNodeId": "act_exhaust_smoke",
          "scoreWeight": 0
        },
        {
          "label": "It makes the upstream sensor over-report the fuel trim",
          "targetNodeId": "act_exhaust_smoke",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "act_exhaust_smoke",
      "type": "action",
      "prompt": "You block the tailpipe, fill the exhaust with smoke, and walk the system from the manifold back, looking for where it escapes.",
      "timeCost": 15,
      "options": [
        {
          "label": "Log it and graph the O2 sensors as well",
          "targetNodeId": "q_cat_theory",
          "scoreWeight": 2
        },
        {
          "label": "Log it and check trims and misfire data",
          "targetNodeId": "act_fuel_trims",
          "scoreWeight": 2
        },
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "act_fuel_trims",
      "type": "action",
      "prompt": "You pull freeze frame, watch short and long-term fuel trims at idle and cruise, and check misfire counters cylinder by cylinder under load.",
      "timeCost": 10,
      "options": [
        {
          "label": "Log it and graph the O2 sensors",
          "targetNodeId": "q_cat_theory",
          "scoreWeight": 2
        },
        {
          "label": "Log it and smoke-test the exhaust",
          "targetNodeId": "q_leak_why",
          "scoreWeight": 2
        },
        {
          "label": "Log it and commit",
          "targetNodeId": "decision",
          "scoreWeight": 1
        }
      ]
    },
    {
      "id": "act_backpressure",
      "type": "action",
      "prompt": "You thread a gauge into the upstream O2 bung and check exhaust backpressure at idle and at a raised RPM.",
      "timeCost": 15,
      "nextNodeId": "bay",
      "continueLabel": "Log it and get back to the workup"
    },
    {
      "id": "act_clear_drive",
      "type": "action",
      "prompt": "You clear the code and send it out to see whether it comes back.",
      "timeCost": 5,
      "nextNodeId": "bay",
      "continueLabel": "That isn't a diagnosis — back to the workup"
    },
    {
      "id": "decision",
      "type": "decision",
      "prompt": "Commit to a specific root cause. The customer is deciding whether to spend $1,400 on your word.",
      "options": [
        {
          "label": "It's an exhaust leak ahead of the rear sensor — repair the pipe",
          "targetNodeId": "repair_leak",
          "commitsTo": "exhaust_leak",
          "scoreWeight": 6
        },
        {
          "label": "It's the downstream O2 sensor lying about a good converter — replace it",
          "targetNodeId": "repair_o2",
          "commitsTo": "rear_o2",
          "scoreWeight": 6
        },
        {
          "label": "The converter is dead and a misfire killed it — fix both",
          "targetNodeId": "repair_cat_misfire",
          "commitsTo": "dead_cat",
          "scoreWeight": 6
        },
        {
          "label": "The converter is dead — replace the converter",
          "targetNodeId": "repair_cat",
          "commitsTo": "dead_cat",
          "scoreWeight": 4
        },
        {
          "label": "The other shop already said converter — just sell it",
          "targetNodeId": "repair_cat",
          "scoreWeight": -4
        },
        {
          "label": "Clear it and tell them to keep driving",
          "targetNodeId": "repair_clear",
          "scoreWeight": -3
        }
      ]
    },
    {
      "id": "repair_leak",
      "type": "repair",
      "prompt": "You replace the cracked flex pipe section and confirm the exhaust is sealed ahead of the rear sensor.",
      "timeCost": 0,
      "repairs": [
        "exhaust_leak"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_o2",
      "type": "repair",
      "prompt": "You replace the downstream O2 sensor with an OE-grade unit.",
      "timeCost": 0,
      "repairs": [
        "rear_o2"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_cat",
      "type": "repair",
      "prompt": "You install a new catalytic converter. (Book job: $1,400.)",
      "timeCost": 0,
      "repairs": [
        "dead_cat"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_cat_misfire",
      "type": "repair",
      "prompt": "You fix the cylinder-3 misfire — coil, plug and injector checked — and install a new converter behind it.",
      "timeCost": 0,
      "repairs": [
        "dead_cat",
        "misfire"
      ],
      "nextNodeId": "verify",
      "continueLabel": "Button it up"
    },
    {
      "id": "repair_clear",
      "type": "repair",
      "prompt": "You clear the code and hand back the keys with a 'let us know if it comes back.'",
      "timeCost": 0,
      "repairs": [],
      "nextNodeId": "#resolve",
      "continueLabel": "Hand back the keys"
    },
    {
      "id": "verify",
      "type": "action",
      "prompt": "Before this goes back to the customer — how do you prove the repair?",
      "timeCost": 0,
      "options": [
        {
          "label": "Run a drive cycle until the catalyst monitor completes",
          "targetNodeId": "q_verify_monitor",
          "scoreWeight": 2
        },
        {
          "label": "Light's out and it idles fine — release it",
          "targetNodeId": "#resolve",
          "scoreWeight": -3
        }
      ]
    },
    {
      "id": "q_verify_monitor",
      "type": "quiz",
      "prompt": "What actually proves a catalyst-code repair before the car leaves?",
      "explanation": "The catalyst monitor only runs under specific drive conditions. Until it completes and passes, nothing is proven — a light that is off may just mean the test hasn't run yet.",
      "options": [
        {
          "label": "Drive it until the catalyst monitor completes and passes",
          "targetNodeId": "act_drivecycle",
          "scoreWeight": 0,
          "correct": true
        },
        {
          "label": "Clear the code and confirm it stays off before they leave",
          "targetNodeId": "act_drivecycle",
          "scoreWeight": 0
        },
        {
          "label": "Confirm the rear sensor reads a steady 0.45 volts at idle",
          "targetNodeId": "act_drivecycle",
          "scoreWeight": 0
        },
        {
          "label": "Bring it to temperature and watch that the light stays off",
          "targetNodeId": "act_drivecycle",
          "scoreWeight": 0
        }
      ]
    },
    {
      "id": "act_drivecycle",
      "type": "action",
      "prompt": "You run the drive cycle, watching the catalyst monitor's readiness status and the rear sensor's behaviour the whole way.",
      "timeCost": 20,
      "nextNodeId": "#resolve",
      "continueLabel": "Release the vehicle"
    },
    {
      "id": "out_good",
      "type": "outcome",
      "condition": "all-faults-repaired",
      "prompt": "The catalyst monitor runs and passes, the rear sensor behaves the way a good converter makes it behave, and the light stays off. If it was the converter, you sold it on evidence. If it wasn't, you saved the customer $1,400."
    },
    {
      "id": "out_comeback",
      "type": "outcome",
      "condition": "faults-remain",
      "prompt": "P0420 is back, and so is the customer. Whatever set it the first time is still on the car."
    }
  ],
  "scoringRules": {
    "decisionNodeWeight": 5,
    "pathEfficiencyWeight": 2,
    "repairSelectionWeight": 3,
    "timeBudgetMinutes": 75
  }
}$tree$::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET tree = EXCLUDED.tree, title = EXCLUDED.title, updated_at = now();

-- Publish when you're ready to expose them:
--   UPDATE public.challenge_trees SET is_published = true
--    WHERE slug IN ('cooling-second-opinion','p0420-second-opinion');
