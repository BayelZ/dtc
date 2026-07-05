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
export interface Profile { id:string; full_name:string; role:UserRole; specialty:Specialty; shop_name:string; city:string; xp:number; streak:number; tier:Tier; last_active:string|null; invite_code:string; created_at:string; }
export interface Challenge { id:string; slug:string; title:string; type:ChallengeType; specialty:Specialty; xp_reward:number; description:string; tags:string[]; is_published:boolean; created_at:string; }
export interface Question { id:string; challenge_id:string; difficulty:Difficulty; tier_order:number; question_text:string; options:string[]; correct_index:number; explanation:string; created_at:string; }
export interface Attempt { id:string; user_id:string; challenge_id:string; score:number; total_questions:number; xp_earned:number; speed_bonus_xp:number; time_seconds:number; grade:Grade|null; answers:AnswerRecord[]; completed:boolean; created_at:string; }
export interface Badge { id:string; name:string; description:string; icon:string; criteria:Record<string,unknown>; created_at:string; }
export interface UserBadge { user_id:string; badge_id:string; earned_at:string; }
export interface SkillScore { id:string; user_id:string; domain:SkillDomain; xp:number; attempts:number; correct:number; updated_at:string; }
export interface ChallengeDomain { challenge_id:string; domain:SkillDomain; }

export interface AnswerRecord { question_id:string; tier_order:number; selected:number; correct:number; is_correct:boolean; time_taken_s?:number; }
export type SafeQuestion = Omit<Question,"correct_index">;

export interface LeaderboardRow {
  id:string; full_name:string; shop_name:string; specialty:string; xp:number; streak:number; tier:string;
  badge_count:number; grade_a_count:number; grade_b_count:number; grade_c_count:number; grade_f_count:number;
  challenges_completed:number; accuracy_pct:number; rank:number; specialty_rank:number;
}

export interface CompleteAttemptResult { grade:Grade; tier:Tier; tier_up:boolean; xp_earned:number; new_xp:number; }
export interface FinishAttemptResponse {
  score:number; total:number; grade:Grade; xp_earned:number; speed_bonus:number;
  new_total_xp:number; tier:Tier; tier_up:boolean; already_completed?:boolean;
}

export const TIER_ICONS: Record<Tier,string> = { Bronze:"🥉", Silver:"🥈", Gold:"🥇", Platinum:"💎", Master:"👑" };
export const TIER_COLORS: Record<Tier,{bg:string;color:string;border:string}> = {
  Bronze:{bg:"#2a1a08",color:"#CD7F32",border:"#7a4a18"},
  Silver:{bg:"#1e1e1e",color:"#A8A9AD",border:"#555"},
  Gold:{bg:"#2a2008",color:"#EF9F27",border:"#7a5a18"},
  Platinum:{bg:"#1a1a2e",color:"#8888cc",border:"#444488"},
  Master:{bg:"#2a1208",color:"#E85D24",border:"#883318"},
};
export const GRADE_COLORS: Record<Grade,{color:string;label:string}> = {
  A:{color:"#6fcf6f",label:"Excellent"}, B:{color:"#5aade6",label:"Good"},
  C:{color:"#e6b84a",label:"Passing"}, F:{color:"#ff7070",label:"Failed"},
};
export const SKILL_DOMAIN_ICONS: Record<SkillDomain,string> = {
  Electrical:"⚡", Fuel:"🛢", Emissions:"💨", Drivetrain:"⚙️", Network:"🔗",
};

export interface Database {
  public: {
    Tables: {
      invite_codes: { Row:Flatten<InviteCode>; Insert:Omit<InviteCode,"id"|"created_at">; Update:Partial<InviteCode>; Relationships:[] };
      profiles: { Row:Flatten<Profile>; Insert:Omit<Profile,"created_at">; Update:Partial<Profile>; Relationships:[] };
      challenges: { Row:Flatten<Challenge>; Insert:Omit<Challenge,"id"|"created_at">; Update:Partial<Challenge>; Relationships:[] };
      questions: { Row:Flatten<Question>; Insert:Omit<Question,"id"|"created_at">; Update:Partial<Question>; Relationships:[] };
      attempts: { Row:Flatten<Attempt>; Insert:Omit<Attempt,"id"|"created_at"|"grade"> & {grade?:Grade|null}; Update:Partial<Attempt>; Relationships:[] };
      badges: { Row:Flatten<Badge>; Insert:Omit<Badge,"id"|"created_at">; Update:Partial<Badge>; Relationships:[] };
      user_badges: { Row:Flatten<UserBadge>; Insert:Flatten<UserBadge>; Update:Partial<UserBadge>; Relationships:[] };
      skill_scores: { Row:Flatten<SkillScore>; Insert:Omit<SkillScore,"id"|"updated_at">; Update:Partial<SkillScore>; Relationships:[] };
      challenge_domains: { Row:Flatten<ChallengeDomain>; Insert:Flatten<ChallengeDomain>; Update:Partial<ChallengeDomain>; Relationships:[] };
    };
    Views: { leaderboard: { Row:Flatten<LeaderboardRow>; Relationships:[] } };
    Functions: {
      complete_attempt: { Args:{p_attempt_id:string;p_xp_earned:number;p_speed_bonus?:number;p_time_seconds?:number}; Returns:CompleteAttemptResult };
      xp_to_tier: { Args:{p_xp:number}; Returns:Tier };
      score_to_grade: { Args:{p_score:number;p_total:number}; Returns:Grade };
    };
  };
}
