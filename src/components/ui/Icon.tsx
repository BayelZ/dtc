import React from "react";

export type IconName =
  | "zap" | "fuel" | "wind" | "cog" | "share" | "gauge" | "target" | "trending"
  | "shield" | "flag" | "check-circle" | "flame" | "trophy" | "timer" | "camera"
  | "lock" | "moon" | "ground" | "miss";

interface IconProps {
  icon: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export const Icon:React.FC<IconProps> = ({icon,size=20,color="currentColor",strokeWidth=2,style}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {icon==="zap" && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
    {icon==="fuel" && <g><rect x="4" y="4" width="12" height="16" rx="1" /><line x1="4" y1="10" x2="16" y2="10" /><path d="M16 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V7l-3-3" /></g>}
    {icon==="wind" && <g><path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 18h9a2 2 0 1 0-2-2" /></g>}
    {icon==="cog" && <g><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></g>}
    {icon==="share" && <g><circle cx="5" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><line x1="7.3" y1="10.8" x2="15.7" y2="7.2" /><line x1="7.3" y1="13.2" x2="15.7" y2="16.8" /></g>}
    {icon==="gauge" && <g><path d="M4 15a8 8 0 0 1 16 0" /><line x1="12" y1="15" x2="16" y2="10" /><circle cx="12" cy="15" r="1.2" fill={color} /></g>}
    {icon==="target" && <g><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill={color} /></g>}
    {icon==="trending" && <g><polyline points="3 16 9 10 13 14 21 5" /><polyline points="15 5 21 5 21 11" /></g>}
    {icon==="shield" && <path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" />}
    {icon==="flag" && <g><line x1="5" y1="3" x2="5" y2="21" /><path d="M5 4h11l-2.5 4L16 12H5" /></g>}
    {icon==="check-circle" && <g><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9" /></g>}
    {icon==="flame" && <path d="M12 21c4 0 6-2.5 6-6 0-3-2-4.5-3-7-0.5 1.5-1.5 2-2 1-0.7-1.4-0.5-3.5-1-5-3 2.5-5 6-5 9.5 0 3.9 1.9 7.5 5 7.5z" />}
    {icon==="trophy" && <g><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 5H4a2 2 0 0 0 2 4h1M17 5h3a2 2 0 0 1-2 4h-1" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="9" y1="18" x2="15" y2="18" /></g>}
    {icon==="timer" && <g><circle cx="12" cy="13" r="8" /><line x1="12" y1="13" x2="12" y2="9" /><line x1="12" y1="13" x2="15" y2="14.5" /><line x1="10" y1="2" x2="14" y2="2" /></g>}
    {icon==="camera" && <g><path d="M4 8h3l1.5-2h6L16 8h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="14" r="3.5" /></g>}
    {icon==="lock" && <g><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></g>}
    {icon==="moon" && <path d="M20 12.5A8 8 0 1 1 11.5 4a6.5 6.5 0 0 0 8.5 8.5z" />}
    {icon==="ground" && <g><line x1="12" y1="4" x2="12" y2="12" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="8" y1="15" x2="16" y2="15" /><line x1="10" y1="18" x2="14" y2="18" /></g>}
    {icon==="miss" && <g><circle cx="12" cy="12" r="9" /><line x1="8.3" y1="8.3" x2="15.7" y2="15.7" /><line x1="15.7" y1="8.3" x2="8.3" y2="15.7" /></g>}
  </svg>
);
