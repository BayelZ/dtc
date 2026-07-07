import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { AvatarUploadSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { AVATAR_UPLOAD_RATE_MAX, AVATAR_UPLOAD_RATE_WINDOW_S, AVATAR_MAX_BYTES } from "@/lib/constants";

// Default Next.js body parser caps JSON bodies at 1MB — base64 of a 2MB image is ~2.7MB.
export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };

// WebP container magic bytes: "RIFF"...."WEBP" — rejects arbitrary content
// (HTML/JS/etc) uploaded with a spoofed Content-Type, since the declared
// MIME type on a direct API call is fully attacker-controlled.
function isValidWebp(buf:Buffer):boolean {
  if (buf.length<12) return false;
  return buf.toString("ascii",0,4)==="RIFF" && buf.toString("ascii",8,12)==="WEBP";
}

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`avatar-upload:${user.id}`,AVATAR_UPLOAD_RATE_MAX,AVATAR_UPLOAD_RATE_WINDOW_S)) return res.status(429).json({error:"Too many uploads. Please wait a minute."});

  const parsed=AvatarUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});

  let buffer:Buffer;
  try { buffer=Buffer.from(parsed.data.image,"base64"); }
  catch { return res.status(400).json({error:"Invalid image data."}); }

  if (buffer.length===0||buffer.length>AVATAR_MAX_BYTES) return res.status(400).json({error:"Image must be under 2MB."});
  if (!isValidWebp(buffer)) return res.status(400).json({error:"Invalid image file."});

  const admin=getSupabaseAdmin();
  const path=`${user.id}.webp`;
  const { error:uploadErr } = await admin.storage.from("avatars").upload(path, buffer, { upsert:true, contentType:"image/webp" });
  if (uploadErr) { console.error("[profile/avatar] upload:",uploadErr); return res.status(500).json({error:"Failed to upload image."}); }

  const { data:{publicUrl} } = admin.storage.from("avatars").getPublicUrl(path);
  const avatar_url=`${publicUrl}?t=${Date.now()}`;

  const { error:updateErr } = await admin.from("profiles").update({avatar_url}).eq("id",user.id);
  if (updateErr) { console.error("[profile/avatar] db update:",updateErr); return res.status(500).json({error:"Failed to save profile."}); }

  return res.status(200).json({avatar_url});
}
