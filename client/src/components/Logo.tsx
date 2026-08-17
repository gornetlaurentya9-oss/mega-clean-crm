import { cx } from "./ui";

/**
 * Mega Clean brand mark, recreated as code (no raster assets).
 *
 * Renders a small asymmetric cluster of four-pointed "sparkle" shapes in
 * the accent blue, sitting above a bold uppercase wordmark ("MEGA CLEAN")
 * in the same accent blue, with a thin lowercase "professional team"
 * subline underneath in dark gray.
 *
 * Usage:
 *   <Logo size="sm" />                 // header/nav
 *   <Logo size="lg" />                 // login screen, centered
 *   <Logo size="md" markOnly />        // just the sparkle cluster
 *   <Logo size="sm" variant="light" /> // wordmark in white, for dark backgrounds
 */

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  className?: string;
  /** Render only the sparkle mark, no wordmark. */
  markOnly?: boolean;
  /** "dark" (default) renders the wordmark in brand-primary for light backgrounds.
   *  "light" renders the wordmark in white for dark/navy backgrounds. */
  variant?: "dark" | "light";
}

/**
 * A single four-pointed "twinkle" sparkle: four sharp points along the axes
 * connected by edges that curve inward (concave) toward the center. The
 * concavity ratio (~15% of the radius) is deliberately tight so the arms
 * read as thin and sharp rather than a rounded diamond — matching the real
 * Mega Clean mark rather than a generic emoji-style sparkle.
 */
function sparklePath(cx: number, cy: number, r: number, kRatio = 0.15) {
  const k = r * kRatio;
  const top = `${cx},${cy - r}`;
  const right = `${cx + r},${cy}`;
  const bottom = `${cx},${cy + r}`;
  const left = `${cx - r},${cy}`;
  return [
    `M ${top}`,
    `Q ${cx + k},${cy - k} ${right}`,
    `Q ${cx + k},${cy + k} ${bottom}`,
    `Q ${cx - k},${cy + k} ${left}`,
    `Q ${cx - k},${cy - k} ${top}`,
    "Z",
  ].join(" ");
}

function SparkleMark({ size, className }: { size: number; className?: string }) {
  // A loose, asymmetric cluster: one large sparkle, a medium sparkle
  // overlapping to its upper right, and two tiny accent flecks — matching
  // the real Mega Clean mark's layout rather than a single symmetric icon.
  const w = size * 1.35;
  const h = size * 1.1;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 135 110"
      fill="currentColor"
      className={cx("text-brand-accent", className)}
      aria-hidden="true"
    >
      <path d={sparklePath(58, 62, 30, 0.15)} />
      <path d={sparklePath(102, 36, 19, 0.15)} />
      <path d={sparklePath(30, 22, 7, 0.17)} />
      <path d={sparklePath(120, 18, 4.5, 0.18)} />
    </svg>
  );
}

const SIZES: Record<
  LogoSize,
  { sparkle: number; word: string; sub: string; tracking: string; gap: string; stacked: boolean; showSub: boolean }
> = {
  // Small: compact horizontal lockup for the sticky header/nav — no subtext,
  // so it stays inside a normal header row height.
  sm: { sparkle: 16, word: "text-sm", sub: "text-[9px]", tracking: "tracking-wide", gap: "gap-1.5", stacked: false, showSub: false },
  // Medium: stacked, for cards/panels.
  md: { sparkle: 22, word: "text-xl", sub: "text-[11px]", tracking: "tracking-wider", gap: "gap-0.5", stacked: true, showSub: true },
  // Large: stacked and centered, for the login screen.
  lg: { sparkle: 34, word: "text-3xl sm:text-4xl", sub: "text-sm", tracking: "tracking-wider", gap: "gap-1", stacked: true, showSub: true },
};

export function Logo({ size = "md", className, markOnly = false, variant = "dark" }: LogoProps) {
  const s = SIZES[size];
  const wordColor = variant === "light" ? "text-white" : "text-brand-accent";
  const subColor = variant === "light" ? "text-white/70" : "text-gray-600";

  const wordmark = !markOnly && (
    <div className={cx("flex flex-col leading-none", s.stacked && "items-center")}>
      <span className={cx("font-extrabold uppercase", s.tracking, s.word, wordColor)}>Mega Clean</span>
      {s.showSub && <span className={cx("font-light lowercase", s.sub, subColor)}>professional team</span>}
    </div>
  );

  if (s.stacked) {
    return (
      <div className={cx("inline-flex flex-col items-center", s.gap, className)}>
        <SparkleMark size={s.sparkle} />
        {wordmark}
      </div>
    );
  }

  return (
    <div className={cx("inline-flex items-center", s.gap, className)}>
      <SparkleMark size={s.sparkle} />
      {wordmark}
    </div>
  );
}

export default Logo;
