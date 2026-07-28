import React from "react";
import type { StickerKind, StickerRarity } from "@/lib/supabase/types";

// Minimal art contract — satisfied structurally by both a `cosmetics` row from the database
// and the local prototype catalog, so the same renderer serves the real app and /gear-pilot.
export interface StickerDef {
  slug:string; name:string; kind:StickerKind; legend:string; color:string;
  rarity?:StickerRarity;
}

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Deterministic tilt per slug — real stickers are never straight, and the same decal should sit
// the same way every render rather than jittering.
export function tiltFor(slug:string):number {
  let h=0;
  for (let i=0;i<slug.length;i++) h=(h*31+slug.charCodeAt(i))%1000;
  return (h%13)-6; // -6°..+6°
}

// ── Rarity drives how much art a decal gets ────────────────────────────────────────────────
// standard : flat, muted, deliberately plain — a participation sticker should look like one
// earned   : solid colour, real iconography, crisp outline
// rare     : full illustration + foil gradient + coloured glow, so it reads as a trophy
// Keeping the low tiers boring is what makes the top tiers feel worth chasing.

const Label:React.FC<{t:string;c:string;y:number;fs:number}> = ({t,c,y,fs}) => (
  <text x="50" y={y} textAnchor="middle" fontFamily={MONO} fontSize={fs} fontWeight="800"
    fill={c} letterSpacing="0.5">{t}</text>
);

// ── Per-decal illustrations ────────────────────────────────────────────────────────────────
const ART:Record<string,(c:string,legend:string)=>React.ReactNode> = {

  // Checkered flag — the beta cohort
  "founding-tech": (c,l) => (
    <>
      <path d="M24 70 V22" stroke={c} strokeWidth="4" strokeLinecap="round" />
      <g>
        {[0,1,2].map(r=>[0,1,2,3].map(q=>(
          <rect key={`${r}-${q}`} x={28+q*11} y={22+r*10} width="11" height="10"
            fill={(r+q)%2===0?c:"transparent"} stroke={c} strokeWidth="0.8" />
        )))}
      </g>
      <Label t={l} c={c} y={84} fs={14} />
    </>
  ),

  // An actual cat. P0420 is a catalytic-converter code; the joke writes itself.
  "cat-whisperer": (c,l) => (
    <>
      <path d="M28 46 L26 26 L42 36 M72 46 L74 26 L58 36" fill="none" stroke={c} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M50 34 C66 34 76 45 76 57 C76 69 65 76 50 76 C35 76 24 69 24 57 C24 45 34 34 50 34 Z"
        fill="none" stroke={c} strokeWidth="3.5" />
      <circle cx="40" cy="54" r="3.6" fill={c} /><circle cx="60" cy="54" r="3.6" fill={c} />
      <path d="M50 61 l-4 4 M50 61 l4 4 M50 61 v4" stroke={c} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M30 60 H16 M30 65 H18 M70 60 H84 M70 65 H82" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
      <Label t={l} c={c} y={89} fs={12} />
    </>
  ),

  // Spark plug throwing a spark
  "sparky": (c,l) => (
    <>
      <rect x="41" y="18" width="18" height="16" rx="2" fill="none" stroke={c} strokeWidth="3" />
      <path d="M38 34 h24 v10 h-24 z" fill="none" stroke={c} strokeWidth="3" />
      <path d="M43 44 h14 v14 h-14 z" fill="none" stroke={c} strokeWidth="2.5" />
      <path d="M50 58 v10 M50 68 h9 v6" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
      <path d="M62 66 l9-5 -5 9 9 -3 -8 9" fill="none" stroke={c} strokeWidth="2.6" strokeLinejoin="round" />
      <Label t={l} c={c} y={92} fs={14} />
    </>
  ),

  // Big omega over a scope trace — the 60Ω bus check
  "sixty-ohm": (c,l) => (
    <>
      <text x="50" y="58" textAnchor="middle" fontFamily={MONO} fontSize="44" fontWeight="800" fill={c}>Ω</text>
      <path d="M14 76 h13 l5 -9 5 9 h11 l5 -9 5 9 h13" fill="none" stroke={c} strokeWidth="2.6"
        strokeLinejoin="round" strokeLinecap="round" opacity=".85" />
    </>
  ),

  // CAN High / CAN Low mirrored around 2.5V — the actual waveform
  "bus-master": (c,l) => (
    <>
      <path d="M12 36 h10 v-12 h10 v12 h10 v-12 h10 v12 h10 v-12 h10 v12 h8"
        fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 54 h10 v12 h10 v-12 h10 v12 h10 v-12 h10 v12 h10 v-12 h8"
        fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" opacity=".7" />
      <line x1="10" y1="45" x2="90" y2="45" stroke={c} strokeWidth="1" strokeDasharray="3 3" opacity=".5" />
      <Label t={l} c={c} y={86} fs={13} />
    </>
  ),

  // Block-test reagent going yellow — combustion gases in the coolant
  "block-test": (c,l) => (
    <>
      <path d="M42 14 v26 L31 64 a10 10 0 0 0 9 14 h20 a10 10 0 0 0 9 -14 L58 40 V14"
        fill="none" stroke={c} strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M36 56 L64 56 a10 10 0 0 1 -4 22 h-20 a10 10 0 0 1 -4 -22 z" fill={c} opacity=".35" />
      <circle cx="45" cy="65" r="2.6" fill={c} /><circle cx="55" cy="71" r="2" fill={c} />
      <circle cx="52" cy="60" r="1.6" fill={c} />
      <path d="M38 14 h24" stroke={c} strokeWidth="3.4" strokeLinecap="round" />
      <Label t={l} c={c} y={92} fs={12} />
    </>
  ),

  // Meter reading milliamps — parasitic draw
  "parasitic-draw": (c,l) => (
    <>
      <rect x="22" y="24" width="56" height="42" rx="6" fill="none" stroke={c} strokeWidth="3" />
      <rect x="29" y="31" width="42" height="17" rx="2" fill={c} opacity=".22" />
      <text x="50" y="45" textAnchor="middle" fontFamily={MONO} fontSize="13" fontWeight="800" fill={c}>{l}</text>
      <circle cx="35" cy="58" r="3" fill={c} /><circle cx="65" cy="58" r="3" fill={c} />
      <path d="M35 66 q-12 12 -18 20 M65 66 q12 12 18 20" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),

  // Crown — Master tier
  "master-tier": (c,l) => (
    <>
      <path d="M20 62 L14 30 l14 12 L50 20 l22 22 14 -12 -6 32 z" fill="none" stroke={c} strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M20 62 h60 v9 h-60 z" fill="none" stroke={c} strokeWidth="3.2" />
      <circle cx="50" cy="36" r="3.2" fill={c} />
      <Label t={l} c={c} y={88} fs={14} />
    </>
  ),
};

// ── Generic shapes by kind (used when a decal has no bespoke art) ──────────────────────────
function genericArt(kind:StickerKind, c:string, legend:string, flat:boolean):React.ReactNode {
  const sw = flat ? 2 : 3;
  switch (kind) {
    case "oval":
      return (<>
        <ellipse cx="50" cy="50" rx="46" ry="31" fill="var(--bg-raised)" stroke={c} strokeWidth={sw} />
        {!flat && <ellipse cx="50" cy="50" rx="40" ry="25" fill="none" stroke={c} strokeWidth="1" opacity=".5" />}
        <Label t={legend} c={c} y={57} fs={19} />
      </>);
    case "shield":
      return (<>
        <path d="M50 8 L88 22 V52 C88 74 70 88 50 94 C30 88 12 74 12 52 V22 Z" fill="var(--bg-raised)" stroke={c} strokeWidth={sw} />
        {!flat && <path d="M50 16 L80 27 V52 C80 69 66 80 50 85 C34 80 20 69 20 52 V27 Z" fill="none" stroke={c} strokeWidth="1" opacity=".45" />}
        <Label t={legend} c={c} y={58} fs={17} />
      </>);
    case "patch":
      return (<>
        <rect x="8" y="20" width="84" height="60" rx="10" fill="var(--bg-raised)" stroke={c} strokeWidth={sw} />
        {!flat && <rect x="14" y="26" width="72" height="48" rx="7" fill="none" stroke={c} strokeWidth="1" strokeDasharray="4 3" opacity=".6" />}
        <Label t={legend} c={c} y={56} fs={16} />
      </>);
    case "stamp":
    default:
      return (<>
        <rect x="6" y="26" width="88" height="48" rx="4" fill="#0C2740" stroke={c} strokeWidth="2.5" />
        <rect x="11" y="31" width="78" height="38" rx="2" fill="none" stroke={c} strokeWidth="1.5" />
        <Label t={legend} c={c} y={55} fs={15} />
      </>);
  }
}

export const Sticker:React.FC<{
  sticker:StickerDef; size?:number; locked?:boolean; tilt?:boolean;
}> = ({sticker,size=64,locked=false,tilt=true}) => {
  const rarity = sticker.rarity ?? "earned";
  const bespoke = ART[sticker.slug];
  const uid = `st-${sticker.slug}`;
  const isRare = rarity === "rare";
  const isFlat = rarity === "standard";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={sticker.name}
      style={{
        display:"block",
        transform: tilt ? `rotate(${tiltFor(sticker.slug)}deg)` : undefined,
        filter: locked
          ? "grayscale(1)"
          : isRare
            ? `drop-shadow(0 0 5px color-mix(in srgb, ${sticker.color} 55%, transparent)) drop-shadow(0 1px 3px rgba(0,0,0,.5))`
            : isFlat ? "none" : "drop-shadow(0 1px 3px rgba(0,0,0,.45))",
        opacity: locked ? 0.3 : 1,
        transition:"opacity .15s, filter .15s",
      }}>
      <defs>
        {/* Foil sweep — rare only. This is the "highlighted" finish. */}
        <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={sticker.color} stopOpacity=".38" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="100%" stopColor={sticker.color} stopOpacity=".30" />
        </linearGradient>
      </defs>

      {/* Rare decals sit on a die-cut foil disc so they pop off the toolbox */}
      {isRare && !locked && (
        <>
          <circle cx="50" cy="50" r="47" fill={`url(#${uid}-foil)`} />
          <circle cx="50" cy="50" r="47" fill="none" stroke={sticker.color} strokeWidth="2" opacity=".65" />
        </>
      )}

      {bespoke ? bespoke(sticker.color, sticker.legend) : genericArt(sticker.kind, sticker.color, sticker.legend, isFlat)}
    </svg>
  );
};
