type IconProps = {
  size?: number;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function DashboardIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function TicketsIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M3.5 8.2a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.2a1.7 1.7 0 0 0 0 3.2v1.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-1.2a1.7 1.7 0 0 0 0-3.2Z" />
      <path d="M9 6.2v11.6" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

export function UsersIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.6 19c.6-3 2.7-4.6 5.4-4.6s4.8 1.6 5.4 4.6" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 6.1" />
      <path d="M15 14.5c2 .3 3.5 1.7 4 4.5" />
    </svg>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M9 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4h4" />
      <path d="M16 16l4.5-4-4.5-4" />
      <path d="M20.2 12H9.5" />
    </svg>
  );
}

export function SunIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.7 4.7l1.7 1.7M17.6 17.6l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.7 19.3l1.7-1.7M17.6 6.4l1.7-1.7" />
    </svg>
  );
}

export function MoonIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function SparklesIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
      <path d="M11 2l1.6 4.9L17.5 8.5l-4.9 1.6L11 15l-1.6-4.9L4.5 8.5l4.9-1.6L11 2zM18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
    </svg>
  );
}
