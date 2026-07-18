"use client";
import { useId } from "react";

/** Animated circular usage ring. Shows a percentage only — never a credit balance. */
export function UsageRing({
  pct,
  size = 140,
  label = "Used",
  unlimited = false,
}: {
  pct: number;
  size?: number;
  label?: string;
  unlimited?: boolean;
}) {
  const gid = useId().replace(/[:]/g, "");
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = unlimited ? 100 : Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={unlimited ? "Unlimited usage" : `${p} percent of today's AI credits used`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#D946EF" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-white/10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={`url(#${gid})`}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * p) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {unlimited ? (
          <>
            <span className="text-3xl font-extrabold gradient-text leading-none">∞</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Unlimited</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-extrabold tabular-nums leading-none">{p}%</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Animated horizontal usage bar. Percentage only. */
export function UsageBar({
  pct,
  unlimited = false,
  showPct = true,
}: {
  pct: number;
  unlimited?: boolean;
  showPct?: boolean;
}) {
  const p = unlimited ? 100 : Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Today's AI usage"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500"
          style={{ width: `${p}%`, transition: "width 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </div>
      {showPct && (
        <span className="text-sm font-semibold text-zinc-300 tabular-nums shrink-0">
          {unlimited ? "∞" : `${p}% Used`}
        </span>
      )}
    </div>
  );
}

/** "Tomorrow • 12:00 AM" plus a live countdown. */
export function resetLabel(nextReset: number): { when: string; countdown: string } {
  const ms = Math.max(0, nextReset - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { when: "Tomorrow • 12:00 AM", countdown: `${h}h ${m}m` };
}

/** Grey shimmer placeholder used while live data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.07] ${className}`} />;
}
