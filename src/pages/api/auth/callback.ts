import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient } from "@/lib/supabase/server";

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="GET") { res.setHeader("Allow","GET"); return res.status(405).end("Method Not Allowed"); }
  const { code, next } = req.query;
  const redirectTo = typeof next==="string" && next.startsWith("/") ? next : "/";
  if (typeof code!=="string"||!code) return res.redirect(303,redirectTo);
  try {
    const supabase=createApiClient(req,res);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) { console.error("[auth/callback]",error.message); return res.redirect(303,"/"); }
    return res.redirect(303,redirectTo);
  } catch(err) { console.error("[auth/callback] unexpected:",err); return res.redirect(303,"/"); }
}
