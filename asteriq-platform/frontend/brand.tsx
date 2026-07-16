/**
 * Central brand configuration.
 * Change the name/tagline/logo HERE and it updates across the whole app.
 */

export const APP_NAME = "Aster IQ";
export const APP_TAGLINE = "Describe your idea. AI builds everything.";
export const APP_DESCRIPTION =
  "Aster IQ — India's AI no-code platform. Build apps, websites, and tools from a single prompt, and deploy them to the internet in one click.";
/** Prefix for GitHub repos created by the deploy engine */
export const REPO_PREFIX = "asteriq";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="asterg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#asterg)" />
      {/* four-point star — "aster" */}
      <path
        d="M24 9 L27.6 20.4 L39 24 L27.6 27.6 L24 39 L20.4 27.6 L9 24 L20.4 20.4 Z"
        fill="#fff"
      />
      <circle cx="36.5" cy="11.5" r="2.2" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function Logo({
  size = 28,
  withText = true,
  textClass = "text-xl",
}: {
  size?: number;
  withText?: boolean;
  textClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <LogoMark size={size} />
      {withText && (
        <span className={`font-extrabold tracking-tight ${textClass}`}>
          aster<span className="gradient-text">IQ</span>
        </span>
      )}
    </span>
  );
}
