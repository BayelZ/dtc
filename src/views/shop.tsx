import React from "react";
import { Card } from "@/components/ui/Card";

export const ShopPage:React.FC = () => {
  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Shop portal</h1>
      <p style={{fontSize:13,color:"var(--text-muted)",margin:"0 0 1.5rem"}}>Review candidate skill ratings, grades, and tier for hiring decisions</p>
      <Card style={{textAlign:"center",padding:"3rem 1.5rem"}}>
        <p style={{fontSize:16,fontWeight:500,margin:"0 0 6px",color:"var(--text)"}}>Coming soon</p>
        <p style={{fontSize:13,color:"var(--text-muted)",margin:0}}>The shop portal is still in development.</p>
      </Card>
    </div>
  );
};
