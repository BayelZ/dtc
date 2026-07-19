import React from "react";
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?:string; error?:string; hint?:string; }
export const Input:React.FC<InputProps> = ({label,error,hint,style,...props}) => (
  <div style={{marginBottom:error?4:14}}>
    {label && <label style={{fontSize:12,color:"var(--text-muted)",display:"block",marginBottom:6}}>{label}{hint&&<span style={{color:"var(--text-faint)",marginLeft:4}}>({hint})</span>}</label>}
    <input style={{width:"100%",padding:"10px 12px",background:"var(--bg-raised)",border:`0.5px solid ${error?"var(--bad-border)":"var(--border)"}`,borderRadius:6,color:"var(--text)",fontSize:14,outline:"none",boxSizing:"border-box",...style}} {...props} />
    {error && <p style={{fontSize:12,color:"var(--bad)",margin:"4px 0 10px"}}>{error}</p>}
  </div>
);
