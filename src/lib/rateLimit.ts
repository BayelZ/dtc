interface Bucket { count:number; resetAt:number }
const store = new Map<string,Bucket>();
if (typeof setInterval!=="undefined") {
  setInterval(()=>{ const now=Date.now(); for (const [k,b] of store) if (now>b.resetAt) store.delete(k); }, 60_000);
}
export async function rateLimit(key:string, max:number, windowSec:number):Promise<boolean> {
  const now=Date.now(); const bucket=store.get(key);
  if (!bucket||now>bucket.resetAt) { store.set(key,{count:1,resetAt:now+windowSec*1000}); return false; }
  if (bucket.count>=max) return true;
  bucket.count+=1; return false;
}
