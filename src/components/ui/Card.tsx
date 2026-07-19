import React from "react";
export const Card:React.FC<{children:React.ReactNode;style?:React.CSSProperties;onClick?:()=>void;hoverable?:boolean}> = ({children,style,onClick,hoverable}) => (
  <div onClick={onClick} style={{background:"var(--bg-card)",border:"0.5px solid var(--border)",borderRadius:10,padding:"1rem 1.25rem",cursor:onClick||hoverable?"pointer":undefined,...style}}>{children}</div>
);
