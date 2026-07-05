import React from "react";
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?:string; error?:string; hint?:string; }
export const Input:React.FC<InputProps> = ({label,error,hint,style,...props}) => (
  <div style={{marginBottom:error?4:14}}>
    {label && <label style={{fontSize:12,color:"#888",display:"block",marginBottom:6}}>{label}{hint&&<span style={{color:"#555",marginLeft:4}}>({hint})</span>}</label>}
    <input style={{width:"100%",padding:"10px 12px",background:"#242424",border:`0.5px solid ${error?"#5a2d2d":"#3e3e3e"}`,borderRadius:6,color:"#f0f0f0",fontSize:14,outline:"none",boxSizing:"border-box",...style}} {...props} />
    {error && <p style={{fontSize:12,color:"#ff7070",margin:"4px 0 10px"}}>{error}</p>}
  </div>
);
