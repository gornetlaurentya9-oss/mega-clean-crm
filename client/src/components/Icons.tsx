import type { SVGProps } from "react";

/**
 * Shared line-icon set. Plain inline SVG (stroke = currentColor, so icons
 * pick up whatever text color/opacity the caller sets) instead of emoji
 * characters, which render inconsistently across platforms (and default to
 * the chunky Android/Noto Color Emoji glyphs on many systems). Keep new
 * icons in this file rather than reaching for emoji or an icon library.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.8" />
      <path d="M17 14.2a6.5 6.5 0 0 1 4.5 5.8" />
    </svg>
  );
}

export function StaffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="8" r="3" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 15.5 21 20.5" />
      <path d="M21 15.5 16 20.5" />
    </svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
      <path d="M7.5 9.5h9M7.5 13h6" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h12v17l-2.2-1.6L13.8 20l-1.8-1.6L10.2 20 8 18.4 6 20V3.5Z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </svg>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11.2 11.8 20 3" />
      <path d="M16.5 6.5 19 9M13.8 9.2l2.3 2.3" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c.5 3.2 1.3 4 4.5 4.5-3.2.5-4 1.3-4.5 4.5-.5-3.2-1.3-4-4.5-4.5C10.7 7 11.5 6.2 12 3Z" />
      <path d="M18.5 14c.3 1.7.7 2.1 2.4 2.4-1.7.3-2.1.7-2.4 2.4-.3-1.7-.7-2.1-2.4-2.4 1.7-.3 2.1-.7 2.4-2.4Z" />
      <path d="M6 15c.25 1.4.6 1.75 2 2-1.4.25-1.75.6-2 2-.25-1.4-.6-1.75-2-2 1.4-.25 1.75-.6 2-2Z" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 5.5 8 12l7 6.5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 5.5 16 12l-7 6.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 21.5 20H2.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5a5 5 0 0 1 5 5v3.2l1.6 3.3a1 1 0 0 1-.9 1.4H6.3a1 1 0 0 1-.9-1.4L7 11.7V8.5a5 5 0 0 1 5-5Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

/** Distinct from a plain message bubble — used to flag that a CLIENT has raised an issue with a
 *  job's slot (see Roster.tsx), styled with an interior exclamation mark so it reads differently
 *  from both a generic "message" icon and the triangular scheduling-conflict icon. */
export function MessageAlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
      <path d="M12 9v3.2M12 15h.01" />
    </svg>
  );
}

/** Used for the daily confirmation screen (Today.tsx) — a checklist/clipboard-check mark, distinct
 *  from CalendarIcon (the week-level roster) and CheckIcon (a plain inline confirm action). */
export function ChecklistIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3v2h6V3" />
      <path d="M8.5 12.5l1.8 1.8L14.5 10" />
      <path d="M8.5 17h7" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15.5" />
      <path d="M13.5 6 19.5 12l-6 6" />
    </svg>
  );
}
