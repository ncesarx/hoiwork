import type { SVGProps } from "react";

export interface LogoProps extends SVGProps<SVGSVGElement> {
  showWordmark?: boolean;
}

export function Logo({ showWordmark = true, ...props }: LogoProps) {
  return (
    <svg
      aria-label="Home & Office Tech Solutions"
      fill="none"
      role="img"
      viewBox={showWordmark ? "0 0 420 92" : "0 0 92 92"}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect height="66" rx="16" stroke="currentColor" strokeWidth="7" width="58" x="7" y="7" />
      <rect height="43" rx="10" stroke="currentColor" strokeWidth="7" width="38" x="45" y="29" />
      <path d="M25 26V58M25 42H47" stroke="#FF8A00" strokeLinecap="round" strokeWidth="8" />
      <path d="M56 78H69" stroke="#FF8A00" strokeLinecap="round" strokeWidth="6" />
      {showWordmark ? (
        <g>
          <text fill="currentColor" fontFamily="Arial, sans-serif" fontSize="30" fontWeight="600" x="105" y="42">
            HOME &amp; <tspan fill="#FF8A00">OFFICE</tspan>
          </text>
          <text fill="#9EC3D4" fontFamily="Arial, sans-serif" fontSize="13" letterSpacing="7" x="106" y="68">
            TECH SOLUTIONS
          </text>
        </g>
      ) : null}
    </svg>
  );
}
