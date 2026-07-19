import React from "react";
type Variant="primary"|"ghost"|"danger"; type BtnSize="sm"|"md"|"lg";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?:Variant; size?:BtnSize; loading?:boolean; fullWidth?:boolean; }
const VARIANTS:Record<Variant,React.CSSProperties>={ primary:{background:"var(--accent)",color:"var(--accent-contrast)",border:"none"}, ghost:{background:"none",color:"var(--text-muted)",border:"0.5px solid var(--border)"}, danger:{background:"var(--bad-bg)",color:"var(--bad)",border:"0.5px solid var(--bad-border)"} };
const SIZES:Record<BtnSize,React.CSSProperties>={ sm:{padding:"6px 12px",fontSize:12}, md:{padding:"10px 16px",fontSize:13}, lg:{padding:"12px 20px",fontSize:14} };
export const Button:React.FC<ButtonProps> = ({variant="primary",size="md",loading=false,fullWidth=false,children,disabled,style,...props}) => (
  <button disabled={disabled||loading} style={{...VARIANTS[variant],...SIZES[size],width:fullWidth?"100%":undefined,borderRadius:6,fontWeight:500,cursor:disabled||loading?"not-allowed":"pointer",opacity:disabled||loading?0.6:1,fontFamily:"var(--font-sans)",...style}} {...props}>
    {loading?"Please wait…":children}
  </button>
);
