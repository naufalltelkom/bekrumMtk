import React from 'react';

export const SlenderJumpscare: React.FC = () => {
  return (
    <div
      data-testid="slender-jumpscare"
      className="fixed inset-0 z-[70] bg-black overflow-hidden flex items-center justify-center pointer-events-auto select-none"
    >
      {/* Rapid horror strobe flash background */}
      <div
        className="absolute inset-0 opacity-85 animate-ping"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(160, 0, 0, 0.72), rgba(0, 0, 0, 0.98) 68%)',
        }}
      />

      {/* Horizontal VHS Static Glitch Lines */}
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 2px, transparent 2px, transparent 6px)',
        }}
      />

      {/* Towering Faceless Slenderman Silhouette looming right in front of the player's eyes */}
      <div className="relative z-10 flex flex-col items-center justify-center animate-bounce">
        <svg
          viewBox="0 0 260 360"
          className="w-[340px] h-[460px] sm:w-[440px] sm:h-[560px] drop-shadow-[0_0_45px_rgba(255,0,0,0.75)]"
        >
          {/* Back Tentacles */}
          <path d="M90 190 Q20 120 12 40" stroke="#08080a" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M170 190 Q240 120 248 40" stroke="#08080a" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M95 220 Q15 210 5 150" stroke="#08080a" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M165 220 Q245 210 255 150" stroke="#08080a" strokeWidth="12" fill="none" strokeLinecap="round" />

          {/* Wide Suit Shoulders */}
          <path d="M40 360 L65 185 Q130 165 195 185 L220 360 Z" fill="#09090c" stroke="#1f1f24" strokeWidth="3" />
          {/* Crimson Tie */}
          <polygon points="130,190 118,225 130,335 142,225" fill="#991b1b" />
          {/* Neck */}
          <rect x="112" y="145" width="36" height="45" fill="#e5e5ea" />

          {/* Stark Pale Blank Faceless Head */}
          <ellipse cx="130" cy="100" rx="52" ry="68" fill="#f4f4f8" stroke="#18181b" strokeWidth="4" />
          {/* Subtle creepy hollow shadow indentations instead of eyes */}
          <ellipse cx="108" cy="96" rx="11" ry="7" fill="rgba(0,0,0,0.18)" />
          <ellipse cx="152" cy="96" rx="11" ry="7" fill="rgba(0,0,0,0.18)" />
        </svg>

        <div className="mt-[-45px] px-5 py-1.5 bg-red-950/90 border border-red-500 text-red-200 font-mono text-base sm:text-xl font-extrabold tracking-[0.25em] uppercase">
          SLENDERMAN TERTANGKAP! (-1 NYAWA)
        </div>
      </div>
    </div>
  );
};
