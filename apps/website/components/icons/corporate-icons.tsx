import type { SVGProps } from "react";
type IconProps=SVGProps<SVGSVGElement>;
const base={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
export function InfrastructureIcon(p:IconProps){return <svg {...base} {...p}><rect x="4" y="3" width="16" height="6" rx="2"/><rect x="4" y="15" width="16" height="6" rx="2"/><path d="M8 6h.01M8 18h.01M12 9v6"/></svg>}
export function CloudIcon(p:IconProps){return <svg {...base} {...p}><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 8.1 4.5 4.5 0 0 0 7 18Z"/></svg>}
export function SecurityIcon(p:IconProps){return <svg {...base} {...p}><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z"/><path d="m9.5 12 1.7 1.7 3.5-4"/></svg>}
export function SupportIcon(p:IconProps){return <svg {...base} {...p}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v4a2 2 0 0 0 2 2h2v-6H4ZM20 13v4a2 2 0 0 1-2 2h-2v-6h4Z"/></svg>}
