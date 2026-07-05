export const APP_NAME = "DTC — Diag Tech Challenge";
export const BETA_REGION = "Houston, TX";
export const QUESTION_TIME_SECONDS = 45;
export const QUESTIONS_PER_SESSION = 3;
export const DAILY_XP_MULTIPLIER = 2;
export const INVITE_CODE_MAX_LENGTH = 20;

// Speed bonus: full bonus at ≤10s, decays linearly to 0 at QUESTION_TIME_SECONDS
export const SPEED_BONUS_MAX_PCT = 0.5;
export const SPEED_BONUS_FULL_THRESHOLD_S = 10;

// Tier XP thresholds — MUST mirror xp_to_tier() in SQL
export const TIER_XP: Record<string, number> = {
  Bronze: 0, Silver: 1000, Gold: 2500, Platinum: 5000, Master: 10000,
};

// Grade thresholds — MUST mirror score_to_grade() in SQL
export const GRADE_THRESHOLDS = { A: 1.0, B: 0.66, C: 0.33 } as const;

export const INVITE_RATE_LIMIT_MAX = 10;
export const INVITE_RATE_LIMIT_WINDOW_S = 60;
export const ATTEMPT_CREATE_RATE_MAX = 20;
export const ATTEMPT_ANSWER_RATE_MAX = 60;
export const ATTEMPT_RATE_WINDOW_S = 60;

export const SPECIALTIES = ["Automotive","Diesel","Both"] as const;
export const ROLES = ["mechanic","student","shop_owner"] as const;
export const DIFFICULTIES = ["Easy","Medium","Hard"] as const;
export const CHALLENGE_TYPES = ["dtc","wiring","component","ro"] as const;
export const SKILL_DOMAINS = ["Electrical","Fuel","Emissions","Drivetrain","Network"] as const;

export const CHALLENGE_TYPE_LABELS: Record<string,string> = {
  dtc:"DTC / Fault Code", wiring:"Wiring / Electrical", component:"Component Testing", ro:"Repair Order",
};
export const CHALLENGE_TYPE_ICONS: Record<string,string> = { dtc:"⚡", wiring:"〰", component:"◎", ro:"📋" };

export const ROUTES = {
  home:"/", challenges:"/challenges", leaderboard:"/leaderboard", profile:"/profile", shop:"/shop",
  api: {
    inviteValidate:"/api/invite/validate",
    attemptCreate:"/api/attempt/create",
    attemptAnswer:"/api/attempt/answer",
    attemptFinish:"/api/attempt/finish",
  },
} as const;
