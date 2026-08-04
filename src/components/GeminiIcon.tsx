/** Gemini "spark" mark, rendered with the Google gradient. */
export function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gemini" className={className}>
      <defs>
        <linearGradient id="gemini-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="45%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gemini-gradient)"
        d="M12 1.5c.34 4.2 1.53 6.9 3.6 8.4 1.5 1.09 3.44 1.75 5.9 2.1-2.46.35-4.4 1.01-5.9 2.1-2.07 1.5-3.26 4.2-3.6 8.4-.34-4.2-1.53-6.9-3.6-8.4-1.5-1.09-3.44-1.75-5.9-2.1 2.46-.35 4.4-1.01 5.9-2.1 2.07-1.5 3.26-4.2 3.6-8.4Z"
      />
    </svg>
  );
}
