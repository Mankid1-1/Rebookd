interface SmsCharCounterProps {
  text: string;
}

export function SmsCharCounter({ text }: SmsCharCounterProps) {
  const length = text.length;
  const segments = Math.ceil(length / 160) || 1;
  const remaining = segments * 160 - length;
  const isMultiSegment = segments > 1;
  const isWarning = segments >= 3;

  return (
    <div className={`flex items-center gap-2 text-xs ${isWarning ? "text-yellow-500" : "text-muted-foreground"}`}>
      <span>{length} / {segments * 160} chars</span>
      <span>({segments} {segments === 1 ? "segment" : "segments"})</span>
      {isMultiSegment && (
        <span className="text-xs">
          {remaining} remaining in segment
        </span>
      )}
      {isWarning && (
        <span className="text-yellow-500 font-medium">
          Long messages cost more
        </span>
      )}
    </div>
  );
}
