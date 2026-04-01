/**
 * Rebooked brand logo — calendar with rebook arrow + orange accent dot.
 * Matches the favicon exactly: navy fill, teal strokes, orange dot.
 */
export function RebookedIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-label="Rebooked"
    >
      <rect x="4" y="8" width="24" height="20" rx="4" ry="4" stroke="#00A896" strokeWidth="2.5" fill="#0D1B2A" />
      <line x1="11" y1="4" x2="11" y2="12" stroke="#00A896" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="21" y1="4" x2="21" y2="12" stroke="#00A896" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 17 C20 14, 14 14, 14 17 C14 20, 20 20, 20 17" stroke="#00A896" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M18 14 L20 17 L17 17" stroke="#00A896" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="25" cy="25" r="2.5" fill="#E8920A" />
    </svg>
  );
}

export function RebookedLogo({ size = 32, showText = true, className = "" }: { size?: number; showText?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <RebookedIcon size={size} />
      {showText && (
        <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Rebooked
        </span>
      )}
    </div>
  );
}
