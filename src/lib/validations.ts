import { z } from "zod";
import { INVITE_CODE_MAX_LENGTH, QUESTION_TIME_SECONDS } from "./constants";

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
  tier_order: z.number().int().min(0).max(2),
  selected: z.number().int().min(-1).max(3),
  time_taken_s: z.number().int().min(1).max(QUESTION_TIME_SECONDS).optional().default(QUESTION_TIME_SECONDS),
});
export const FinishAttemptSchema = z.object({ attempt_id: uuid });
