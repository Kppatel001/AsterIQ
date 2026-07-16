/** Central brand configuration. */
export const APP_NAME = "Asteriq AI";
export const APP_TAGLINE = "Describe your idea. AI builds everything.";
export const APP_DESCRIPTION =
  "Asteriq AI — India's AI no-code platform. Build apps, websites, and tools from a single prompt, and deploy them to the internet in one click.";
export const REPO_PREFIX = "asteriq";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="aiqCyan" x1="10" y1="8" x2="16" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#3B82F6" /></linearGradient>
        <linearGradient id="aiqViolet" x1="30" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#A855F7" /><stop offset="1" stopColor="#D946EF" /></linearGradient>
        <linearGradient id="aiqBar" x1="17" y1="30" x2="31" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#22D3EE" /><stop offset="1" stopColor="#C026D3" /></linearGradient>
        <linearGradient id="aiqOrbit" x1="2" y1="20" x2="46" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#38BDF8" /><stop offset="1" stopColor="#6366F1" /></linearGradient>
      </defs>
      <ellipse cx="24" cy="27" rx="21.5" ry="7.4" transform="rotate(-22 24 27)" stroke="url(#aiqOrbit)" strokeWidth="2" fill="none" opacity="0.95" />
      <line x1="24" y1="7.5" x2="12.5" y2="40.5" stroke="url(#aiqCyan)" strokeWidth="5.4" strokeLinecap="round" />
      <line x1="24" y1="7.5" x2="35.5" y2="40.5" stroke="url(#aiqViolet)" strokeWidth="5.4" strokeLinecap="round" />
      <line x1="17.5" y1="30" x2="30.5" y2="30" stroke="url(#aiqBar)" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M38.5 5 L39.6 8.4 L43 9.5 L39.6 10.6 L38.5 14 L37.4 10.6 L34 9.5 L37.4 8.4 Z" fill="#ffffff" />
      <path d="M44 13 L44.5 14.7 L46.2 15.2 L44.5 15.7 L44 17.4 L43.5 15.7 L41.8 15.2 L43.5 14.7 Z" fill="#E0F2FE" />
    </svg>
  );
}
export function Logo({ size = 28, withText = true, textClass = "text-xl" }: { size?: number; withText?: boolean; textClass?: string; }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <LogoMark size={size} />
      {withText && (<span className={`font-extrabold tracking-tight ${textClass}`}>Aster<span className="gradient-text">iq</span><span className="ml-1 align-top text-[0.62em] font-bold gradient-text">AI</span></span>)}
    </span>
  );
}
