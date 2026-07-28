import { z } from "zod";
import { INVITE_CODE_MAX_LENGTH, QUESTION_TIME_SECONDS, AVATAR_MAX_BYTES, QUESTIONS_PER_SESSION, FLAG_REASONS, FLAG_COMMENT_MAX_LENGTH } from "./constants";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8,"Password must be at least 8 characters").max(72);
const uuid = z.string().uuid("Invalid ID format");

export const InviteCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(INVITE_CODE_MAX_LENGTH).regex(/^[A-Z0-9]+$/,"Letters and numbers only"),
});
export const SignUpSchema = z.object({
  email, password,
  full_name: z.string().trim().min(2).max(80).regex(/^[a-zA-Z\s'\-.]+$/,"Invalid characters"),
  role: z.enum(["mechanic","student","shop_owner"]),
  specialty: z.enum(["Automotive","Diesel","Both"]),
  shop_name: z.string().trim().max(100).optional().default(""),
  invite_code: z.string().trim().toUpperCase().min(2).max(INVITE_CODE_MAX_LENGTH),
});
export const LoginSchema = z.object({ email, password: z.string().min(1,"Password is required") });
export const CreateAttemptSchema = z.object({ challenge_id: uuid });
export const SubmitAnswerSchema = z.object({
  attempt_id: uuid, question_id: uuid,
  tier_order: z.number().int().min(0).max(QUESTIONS_PER_SESSION-1),
  selected: z.number().int().min(-1).max(3),
  time_taken_s: z.number().int().min(1).max(QUESTION_TIME_SECONDS).optional().default(QUESTION_TIME_SECONDS),
});
export const FinishAttemptSchema = z.object({ attempt_id: uuid });

// Diagnostic-tree runs. The client only ever names an option INDEX on the node it is currently
// on — it can't submit a score, a path, or a fault id. The server validates every transition
// against the tree and replays the whole path to score it.
export const StartTreeSchema = z.object({ slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/,"Invalid slug") });
export const TreeStepSchema = z.object({
  attempt_id: uuid,
  from_node_id: z.string().trim().min(1).max(80),
  option: z.number().int().min(-1).max(15), // -1 = follow the node's nextNodeId link
});
export const FinishTreeSchema = z.object({ attempt_id: uuid });

// Gear loadout. The client names decal SLUGS only — it can't send an ownership claim, a rule,
// or a slot index; the server resolves, verifies ownership and assigns slots in order.
export const SetLoadoutSchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/,"Invalid decal"))
    .max(4,"You can only put four decals on your box"),
});
export const QuestionFlagSchema = z.object({
  question_id: uuid,
  reason: z.enum(FLAG_REASONS),
  comment: z.string().trim().max(FLAG_COMMENT_MAX_LENGTH).optional().default(""),
});
export const ComebackAnswerSchema = z.object({
  question_id: uuid,
  selected: z.number().int().min(-1).max(3),
});
// Base64 grows input by ~4/3 — cap the encoded string a bit above the raw byte limit
// so oversized payloads are rejected before the (more expensive) decode step.
export const AvatarUploadSchema = z.object({
  image: z.string().min(1).max(Math.ceil(AVATAR_MAX_BYTES*1.4)),
});
