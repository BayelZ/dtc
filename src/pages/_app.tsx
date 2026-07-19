import type { AppProps } from "next/app";
import React from "react";
import "@/styles/globals.css";

interface EBState { hasError:boolean; message:string }
class ErrorBoundary extends React.Component<{children:React.ReactNode},EBState> {
  constructor(props:{children:React.ReactNode}) { super(props); this.state={hasError:false,message:""}; }
  static getDerivedStateFromError(e:Error):EBState { return {hasError:true,message:e.message}; }
  componentDidCatch(e:Error,info:React.ErrorInfo) { console.error("[DTC ErrorBoundary]",e,info.componentStack); }
  render() {
    if (this.state.hasError) return (
      <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,padding:"2rem",color:"var(--text)"}}>
        <span style={{fontSize:32}}>⚠️</span><h2 style={{margin:0}}>Something went wrong</h2><p style={{color:"var(--text-muted)",margin:0}}>{this.state.message}</p>
        <button onClick={()=>window.location.reload()} style={{padding:"8px 20px",background:"var(--accent)",color:"var(--accent-contrast)",border:"none",borderRadius:6,cursor:"pointer"}}>Reload page</button>
      </div>
    );
    return this.props.children;
  }
}

export default function App({ Component, pageProps }:AppProps) { return <ErrorBoundary><Component {...pageProps} /></ErrorBoundary>; }
