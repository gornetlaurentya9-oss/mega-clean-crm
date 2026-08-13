import { cx } from "./ui";

/**
 * Mega Clean brand mark, recreated as code (no raster assets).
 *
 * Renders a small cluster of 2-3 four-pointed "sparkle" shapes in the
 * accent blue, sitting above a bold uppercase wordmark ("MEGA CLEAN") in
 * the primary brand blue, with a thin lowercase "professional team"
 * subline underneath.
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
 * A single four-pointed "twinkle" sparkle: four points along the axes
 * connected by edges that curve inward (concave) toward the center,
 * giving the classic soft sparkle/asterisk silhouette (not a 5-point star).
 */
function Sparkle({
  size,
  className,
  style,
}: {
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Points at top/right/bottom/left (12 o'clock, 3, 6, 9), with quadratic
  // bezier edges that bow in toward the center (control point pulled to
  // roughly 22% of the radius) to create the concave "twinkle" curve.
  const c = 12; // viewBox center
  const r = 11; // outer point radius
  const k = 2.6; // control-point pull toward center (concavity)

  const top = `${c},${c - r}`;
  const right = `${c + r},${c}`;
  const bottom = `${c},${c + r}`;
  const left = `${c - r},${c}`;

  const d = [
    `M ${top}`,
    `Q ${c + k},${c - k} ${right}`,
    `Q ${c + k},${c + k} ${bottom}`,
    `Q ${c - k},${c + k} ${left}`,
    `Q ${c - k},${c - k} ${top}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function SparkleMark({ size, className }: { size: number; className?: string }) {
  // Loosely clustered/overlapping sparkles of varying sizes.
  const box = size * 1.5;
  return (
    <div
      className={cx("relative text-brand-accent", className)}
      style={{ width: box, height: size * 1.1 }}
      aria-hidden="true"
    >
      <Sparkle size={size * 0.62} style={{ position: "absolute", left: 0, top: size * 0.28 }} />
      <Sparkle size={size} style={{ position: "absolute", left: size * 0.34, top: 0 }} />
      <Sparkle size={size * 0.42} style={{ position: "absolute", left: size * 1.06, top: size * 0.38 }} />
    </div>
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
  const wordColor = variant === "light" ? "text-white" : "text-brand-primary";
  const subColor = variant === "light" ? "text-white/70" : "text-gray-400";

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
