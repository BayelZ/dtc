// Flattens an interface into a plain object type. Needed because postgrest-js's
// GenericTable requires Row/Insert/Update to structurally satisfy Record<string, unknown>,
// and a bare `interface` (unlike a mapped type) does not satisfy that in a conditional-type check.
type Flatten<T> = { [K in keyof T]: T[K] };

export type UserRole = "mechanic"|"student"|"shop_owner";
export type Specialty = "Automotive"|"Diesel"|"Both";
export type ChallengeType = "dtc"|"wiring"|"component"|"ro";
export type Difficulty = "Easy"|"Medium"|"Hard";
export type Grade = "A"|"B"|"C"|"F";
export type Tier = "Bronze"|"Silver"|"Gold"|"Platinum"|"Master";
export type SkillDomain = "Electrical"|"Fuel"|"Emissions"|"Drivetrain"|"Network";

export interface InviteCode { id:string; code:string; used_count:number; max_uses:number; is_active:boolean; created_at:string; }
export interface Profile { id:string; full_name:string; role:UserRole; specialty:Specialty; shop_name:string; city:string; bio:string; avatar_url:string|null; xp:number; streak:number; tier:Tier; last_active:string|null; invite_code:string; created_at:string; is_admin?:boolean; }

export type FlagReason = "wrong_answer"|"ambiguous"|"typo"|"other";
export type FlagStatus = "open"|"resolved"|"dismissed";
export interface QuestionFlag { id:string; question_id:string; user_id:string; reason:FlagReason; comment:string; status:FlagStatus; created_at:string; }
export interface QuestionFlagEntry { id:string; reason:FlagReason; comment:string; status:FlagStatus; created_at:string; flagger:string; }
// Admin-only shape: includes correct_index, which never reaches regular clients.
export interface FlaggedQuestion {
  question_id:string; question_text:string; options:string[]; correct_index:number;
  explanation:string; challenge_title:string; open_count:number; flags:QuestionFlagEntry[];
}
export interface Challenge { id:string; slug:string; title:string; type:ChallengeType; specialty:Specialty; xp_reward:number; description:string; tags:string[]; is_published:boolean; created_at:string; }
export interface Question { id:string; challenge_id:string; difficulty:Difficulty; tier_order:number; question_text:string; options:string[]; correct_index:number; explanation:string; created_at:string; }
export interface Attempt { id:string; user_id:string; challenge_id:string; score:number; total_questions:number; xp_earned:number; speed_bonus_xp:number; time_seconds:number; grade:Grade|null; answers:AnswerRecord[]; completed:boolean; created_at:string; }
export interface Badge { id:string; name:string; description:string; icon:string; criteria:Record<string,unknown>; created_at:string; }
export interface UserBadge { user_id:string; badge_id:string; earned_at:string; }
export interface SkillScore { id:string; user_id:string; domain:SkillDomain; xp:number; attempts:number; correct:number; updated_at:string; }
export interface ChallengeDomain { challenge_id:string; domain:SkillDomain; }

export interface AnswerRecord { question_id:string; tier_order:number; selected:number; correct:number; is_correct:boolean; time_taken_s?:number; difficulty?:Difficulty; }
export type SafeQuestion = Omit<Question,"correct_index">;
// Mirrors attempts minus `answers` (which embeds correct_index) — safe to read cross-user.
export type AttemptSummary = Omit<Attempt,"answers">;

export interface Comeback {
  user_id:string; question_id:string; missed_count:number; cleared_count:number;
  first_missed_at:string; last_missed_at:string; cleared_at:string|null;
}
// Mirrors comebacks minus question_id — which questions a user misses stays private.
export interface ComebackSummary { user_id:string; cleared_count:number; open:boolean; }
// Explanation is withheld until the answer lands, same as the arena flow.
export interface ComebackQueueItem {
  question: Omit<SafeQuestion,"explanation"> & { challenge_title:string };
  missed_count:number; last_missed_at:string;
}
export interface ComebackAnswerResult {
  is_correct:boolean; correct_index:number; explanation:string;
  open_remaining:number; cleared_total:number;
}

export interface LeaderboardRow {
  id:string; full_name:string; shop_name:string; specialty:string; xp:number; streak:number; tier:string;
  badge_count:number; grade_a_count:number; grade_b_count:number; grade_c_count:number; grade_f_count:number;
  challenges_completed:number; accuracy_pct:number;
  comebacks_open:number; comebacks_cleared:number; no_comebacks:boolean;
  rank:number; specialty_rank:number;
}

export interface CompleteAttemptResult { grade:Grade; tier:Tier; tier_up:boolean; xp_earned:number; new_xp:number; }

// Diagnostic-tree storage. `tree` holds the full DiagChallenge document INCLUDING faultSeeds —
// the answer key — so it is server-only, exactly like Question.correct_index. Anything sent to a
// browser must go through sanitizeTreeForClient().
export type TreeOutcome = "clean"|"lucky"|"comeback"|"masked";
export interface ChallengeTree { id:string; slug:string; source_challenge_id:string|null; title:string; tree:unknown; domain:SkillDomain|null; is_published:boolean; created_at:string; updated_at:string; }
export interface TreeAttempt {
  id:string; user_id:string; tree_id:string; seed_id:string; steps:{from:string;option:number}[];
  outcome:TreeOutcome|null; process_score:number|null; grade:Grade|null; xp_earned:number;
  time_minutes:number; knowledge_correct:number; knowledge_total:number;
  completed:boolean; created_at:string; completed_at:string|null;
}
export interface CompleteTreeAttemptResult { new_xp:number; tier:Tier; tier_up:boolean; outcome:TreeOutcome; grade:Grade; xp_earned:number; }

// Gear — earned profile decals. unlock_rule is evaluated SERVER-SIDE only (grant_cosmetics);
// a client-computed credential is worth nothing. XP is never spent: rules only read earned state.
export type StickerKind = "oval"|"patch"|"shield"|"stamp";
export type StickerRarity = "standard"|"earned"|"rare";
export interface Cosmetic {
  id:string; slug:string; name:string; requirement:string;
  kind:StickerKind; rarity:StickerRarity; legend:string; color:string;
  unlock_rule:unknown; sort_order:number; is_active:boolean; created_at:string;
}
export interface UserCosmetic { user_id:string; cosmetic_id:string; unlocked_at:string; }
export interface ProfileLoadout { user_id:string; slot:number; cosmetic_id:string; }
/** What the browser gets: catalog + which are unlocked + what's on the box. No rules leak. */
export interface GearView {
  catalog:(Omit<Cosmetic,"unlock_rule"|"is_active"|"created_at"> & {unlocked:boolean})[];
  equipped:string[];
  max_equipped:number;
  newly_unlocked:{slug:string;name:string}[];
}
export interface FinishAttemptResponse {
  score:number; total:number; grade:Grade; xp_earned:number; speed_bonus:number;
  new_total_xp:number; tier:Tier; tier_up:boolean; already_completed?:boolean;
}

export const TIER_ICONS: Record<Tier,string> = { Bronze:"🥉", Silver:"🥈", Gold:"🥇", Platinum:"💎", Master:"👑" };
// Metal colors fixed; bg/border tinted against the theme bg (see tierColors in utils.ts).
const tierChipStyle = (metal:string) => ({
  bg:`color-mix(in srgb, ${metal} 14%, var(--bg))`,
  color:metal,
  border:`color-mix(in srgb, ${metal} 45%, var(--bg))`,
});
export const TIER_COLORS: Record<Tier,{bg:string;color:string;border:string}> = {
  Bronze:tierChipStyle("#CD7F32"),
  Silver:tierChipStyle("#A8A9AD"),
  Gold:tierChipStyle("#EF9F27"),
  Platinum:tierChipStyle("#8888cc"),
  Master:tierChipStyle("var(--accent)"),
};
export const GRADE_COLORS: Record<Grade,{color:string;label:string}> = {
  A:{color:"var(--good)",label:"Excellent"}, B:{color:"var(--info)",label:"Good"},
  C:{color:"var(--gold)",label:"Passing"}, F:{color:"var(--bad)",label:"Failed"},
};
export const SKILL_DOMAIN_ICONS: Record<SkillDomain,string> = {
  Electrical:"⚡", Fuel:"🛢", Emissions:"💨", Drivetrain:"⚙️", Network:"🔗",
};

export interface Database {
  public: {
    Tables: {
      invite_codes: { Row:Flatten<InviteCode>; Insert:Omit<InviteCode,"id"|"created_at">; Update:Partial<InviteCode>; Relationships:[] };
      profiles: { Row:Flatten<Profile>; Insert:Omit<Profile,"created_at"|"bio"|"avatar_url"> & {bio?:string;avatar_url?:string|null}; Update:Partial<Profile>; Relationships:[] };
      challenges: { Row:Flatten<Challenge>; Insert:Omit<Challenge,"id"|"created_at">; Update:Partial<Challenge>; Relationships:[] };
      questions: { Row:Flatten<Question>; Insert:Omit<Question,"id"|"created_at">; Update:Partial<Question>; Relationships:[] };
      attempts: { Row:Flatten<Attempt>; Insert:Omit<Attempt,"id"|"created_at"|"grade"> & {grade?:Grade|null}; Update:Partial<Attempt>; Relationships:[] };
      badges: { Row:Flatten<Badge>; Insert:Omit<Badge,"id"|"created_at">; Update:Partial<Badge>; Relationships:[] };
      user_badges: { Row:Flatten<UserBadge>; Insert:Flatten<UserBadge>; Update:Partial<UserBadge>; Relationships:[] };
      skill_scores: { Row:Flatten<SkillScore>; Insert:Omit<SkillScore,"id"|"updated_at">; Update:Partial<SkillScore>; Relationships:[] };
      challenge_domains: { Row:Flatten<ChallengeDomain>; Insert:Flatten<ChallengeDomain>; Update:Partial<ChallengeDomain>; Relationships:[] };
      comebacks: { Row:Flatten<Comeback>; Insert:Omit<Comeback,"first_missed_at"|"last_missed_at"|"cleared_at"|"cleared_count"> & Partial<Pick<Comeback,"first_missed_at"|"last_missed_at"|"cleared_at"|"cleared_count">>; Update:Partial<Comeback>; Relationships:[] };
      question_flags: { Row:Flatten<QuestionFlag>; Insert:Omit<QuestionFlag,"id"|"created_at"|"status"> & {status?:FlagStatus}; Update:Partial<QuestionFlag>; Relationships:[] };
      challenge_trees: { Row:Flatten<ChallengeTree>; Insert:Omit<ChallengeTree,"id"|"created_at"|"updated_at">; Update:Partial<ChallengeTree>; Relationships:[] };
      tree_attempts: { Row:Flatten<TreeAttempt>; Insert:Pick<TreeAttempt,"user_id"|"tree_id"|"seed_id"> & Partial<Omit<TreeAttempt,"id"|"created_at"|"user_id"|"tree_id"|"seed_id">>; Update:Partial<TreeAttempt>; Relationships:[] };
      cosmetics: { Row:Flatten<Cosmetic>; Insert:Omit<Cosmetic,"id"|"created_at">; Update:Partial<Cosmetic>; Relationships:[] };
      user_cosmetics: { Row:Flatten<UserCosmetic>; Insert:Omit<UserCosmetic,"unlocked_at">; Update:Partial<UserCosmetic>; Relationships:[] };
      profile_loadout: { Row:Flatten<ProfileLoadout>; Insert:Flatten<ProfileLoadout>; Update:Partial<ProfileLoadout>; Relationships:[] };
    };
    Views: {
      leaderboard: { Row:Flatten<LeaderboardRow>; Relationships:[] };
      attempt_summaries: { Row:Flatten<AttemptSummary>; Relationships:[] };
      comeback_summaries: { Row:Flatten<ComebackSummary>; Relationships:[] };
    };
    Functions: {
      complete_attempt: { Args:{p_attempt_id:string;p_xp_earned:number;p_speed_bonus?:number;p_time_seconds?:number}; Returns:CompleteAttemptResult };
      complete_tree_attempt: { Args:{p_attempt_id:string;p_xp_earned:number;p_outcome:string;p_process_score:number;p_grade:Grade;p_time_minutes?:number;p_knowledge_correct?:number;p_knowledge_total?:number}; Returns:CompleteTreeAttemptResult };
      grant_cosmetics: { Args:{p_user_id:string}; Returns:{slug:string;name:string}[] };
      set_profile_loadout: { Args:{p_user_id:string;p_slugs:string[]}; Returns:{slug:string}[] };
      grade_rank: { Args:{p_grade:Grade}; Returns:number };
      record_comeback_answer: { Args:{p_user_id:string;p_question_id:string;p_selected:number}; Returns:ComebackAnswerResult };
      award_comeback_badges: { Args:{p_user_id:string}; Returns:undefined };
      xp_to_tier: { Args:{p_xp:number}; Returns:Tier };
      score_to_grade: { Args:{p_score:number;p_total:number}; Returns:Grade };
    };
  };
}
