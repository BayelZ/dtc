# DTC Houston Beta — Facebook/Instagram Ad Copy Set

Funnel: ad click → live app URL (open signup). Replace `{APP_URL}` with the production URL.
Offer: free beta + Houston-only leaderboard + founder status for early testers.
CTA button: **Play Game** (A/B against **Sign Up** — Play Game usually wins for challenge apps).
Note on primary text: Meta truncates around ~125 characters with a "…See more" — every variant
below front-loads the hook so the visible portion works alone.

Suggested structure: 4 ad sets (Working Techs / Students / Diesel / Broad-Lore), 2-3 ads each,
same creative style per set so copy is the test variable.

---

## Ad Set A — Working techs

**A1 — "The parts cannon" (misdiagnosis pride angle)**
- Primary text: Two alternators later, the truck still read 12.9V. The real fault was a battery
  registration nobody ran. Think you'd have caught it? 27 real diagnostic cases. A Houston-only
  leaderboard. Free while in beta — early techs get founder status.
- Headline: Houston techs: prove your diag game
- Description: Free beta. Real cases.

**A2 — Shop identity angle**
- Primary text: Every shop has one tech the others bring the weird ones to. Houston's about to
  find out who it actually is. Real cases — misfires, ghosts, comebacks — scored, timed, and
  ranked on a public leaderboard. Beta is free.
- Headline: Are you the shop's diag tech or not?
- Description: Houston beta — free

**A3 — Lore/entertainment angle**
- Primary text: A minivan turns its own lights on at 3 a.m. The owner says ghost. The wake log
  says otherwise. If you live for cases like this one, the Houston beta is open — free, 27
  challenges, founder badge if you're in early.
- Headline: Solve the cases shops argue about
- Description: Free while in beta

---

## Ad Set B — Trade students (UTI / Lincoln Tech / San Jac / HCC)

**B1 — Hiring edge angle**
- Primary text: Scan tools read codes. Shops hire the ones who can read the data. Practice on
  270 diagnostic questions built like real cases — fuel trims, voltage drops, waveforms — not
  flashcard trivia. Free Houston beta, same leaderboard as the working techs.
- Headline: Graduate reading data, not just codes
- Description: Free Houston beta

**B2 — Interview-thinking angle**
- Primary text: P0171 on a Camry. The last guy just threw a MAF at it. What do YOU pull up
  first? Train the diagnostic thinking interviews actually test — free during the Houston beta,
  founder badge included.
- Headline: Think like the tech they want to hire
- Description: Real cases, real data

**B3 — Compete-with-pros angle**
- Primary text: You against techs with 20 years of scars — same cases, same clock, one Houston
  leaderboard. Nobody sees your experience level. Only your score shows. Free while in beta.
- Headline: Same leaderboard as the pros
- Description: Houston beta — free entry

---

## Ad Set C — Diesel / fleet techs

**C1 — Platform-specific content angle**
- Primary text: Balance rates on a 6.7. A DEF drum reading 19% on the refractometer. A P242F on
  a short-trip route. If your workday smells like diesel, this beta was built for you. Free,
  Houston-only leaderboard, founder status for early techs.
- Headline: Diesel diag challenges, done right
- Description: Cummins · Powerstroke · Duramax

**C2 — Heavy-duty pride angle**
- Primary text: Anyone can force a regen. Figuring out WHY the filter keeps loading soot is the
  actual job. Real heavy-duty cases — EGR flow, SCR efficiency, injector balance — scored,
  timed, ranked. Free Houston beta.
- Headline: Heavy-duty diag. Public scoreboard.
- Description: Free while in beta

---

## Ad Set D — Broad / lore hook (widest audience, most thumb-stopping)

**D1 — The ice cream case**
- Primary text: The customer swears her car only breaks down after she stops for ice cream.
  She's right — and there's a real fault behind it. Can you find it? 27 diagnostic cases from
  real shop life. Free Houston beta, public leaderboard.
- Headline: The ice cream no-start is real
- Description: Free diag challenge beta

**D2 — Second-opinion angle**
- Primary text: One shop quoted a $3,800 transmission overhaul. The actual fix was a corroded
  ground strap. Every case on DTC works like that — the data's in front of you; the call is
  yours. Free Houston beta, founder badge for early techs.
- Headline: Would you have caught it?
- Description: Real cases. Free beta.

---

## Practical notes

- **Founder status**: the badges table already exists in the schema — a "Founding Tech" badge
  awarded to accounts created during the beta window is a small migration; write it before the
  ads run so the promise is real on day one.
- **Creative**: all copy above assumes a simple visual — phone-in-hand with a challenge card
  or leaderboard screenshot, shop background. The lore ads (A3, D1, D2) also work as plain
  bold-text-on-dark cards quoting the case's first line.
- **Geo**: Houston + ~25mi radius. The B set can be narrowed by interest/education targeting;
  A/C sets do fine broad within the geo — the copy self-selects.
- Keep the invite codes (BAYEL, ZHU) out of ad copy — signup is open.
