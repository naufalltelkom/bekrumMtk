import React, { useEffect, useState } from 'react';
import { sound } from '../game/audio';

interface DialogueLine {
  speaker: string;
  roleColor: string;
  text: string;
  startSec: number;
  endSec: number;
}

const CUTSCENE_DURATION = 7.0;

const DIALOGUE_LINES: DialogueLine[] = [
  {
    speaker: 'Bang Biru (Memeluk Erat)',
    roleColor: '#60a5fa',
    text: 'Aduh sakit perutku... tapi kepalaku akhirnya jernih! Makasih udah nyadarin aku...',
    startSec: 0,
    endSec: 2.6,
  },
  {
    speaker: 'Kamu',
    roleColor: '#d8b4fe',
    text: 'Maaf ya Bang harus kupukul biar sadar. Ayo kita cari jalan keluar!',
    startSec: 2.6,
    endSec: 5.0,
  },
  {
    speaker: 'Bang Biru',
    roleColor: '#fde047',
    text: 'Biar aku yang jalan duluan ke arah pintu keluar buat jagain kamu!',
    startSec: 5.0,
    endSec: CUTSCENE_DURATION,
  },
];

interface HugCutsceneProps {
  onComplete: () => void;
}

export const HugCutscene: React.FC<HugCutsceneProps> = ({ onComplete }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    sound.startSadCutsceneMusic();

    const startMs = performance.now();
    const tickId = window.setInterval(() => {
      const sec = (performance.now() - startMs) / 1000;
      setElapsed(Math.min(CUTSCENE_DURATION, sec));
      if (sec >= CUTSCENE_DURATION) {
        window.clearInterval(tickId);
        onComplete();
      }
    }, 100);

    return () => {
      window.clearInterval(tickId);
      sound.stopSadCutsceneMusic();
    };
  }, [onComplete]);

  const currentLine =
    DIALOGUE_LINES.find((l) => elapsed >= l.startSec && elapsed < l.endSec) ||
    DIALOGUE_LINES[DIALOGUE_LINES.length - 1];

  const remaining = Math.max(0, Math.ceil(CUTSCENE_DURATION - elapsed));

  return (
    <div
      data-testid="hug-cutscene"
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none"
    >
      {/* Top Cinema Letterbox Crop Bar */}
      <div className="w-full h-[14vh] sm:h-[16vh] bg-black border-b border-neutral-900 flex items-center justify-between px-6">
        <div className="font-mono text-[11px] text-neutral-400 tracking-widest uppercase">
          BANG BIRU SADAR &amp; MEMELUKMU ({remaining}s)
        </div>
        <button
          onClick={() => {
            sound.playClick();
            onComplete();
          }}
          className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono rounded cursor-pointer"
        >
          Lewati &gt;&gt;
        </button>
      </div>

      {/* Middle 3D Viewport Area (transparent so hugging 3D scene shows through clearly) */}
      <div className="flex-1 relative flex items-end justify-center pb-5 px-4 pointer-events-none">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, transparent 45%, rgba(12, 8, 22, 0.58) 100%)',
          }}
        />

        <div className="relative z-10 max-w-xl w-full bg-black/80 border border-white/15 rounded-xl px-5 py-3 text-center shadow-2xl space-y-1">
          <div
            className="font-mono text-xs font-bold tracking-wider uppercase"
            style={{ color: currentLine.roleColor }}
          >
            {currentLine.speaker}
          </div>
          <p className="text-sm sm:text-base text-white font-medium leading-relaxed">
            &ldquo;{currentLine.text}&rdquo;
          </p>
        </div>
      </div>

      {/* Bottom Cinema Letterbox Crop Bar */}
      <div className="w-full h-[14vh] sm:h-[16vh] bg-black border-t border-neutral-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-1.5">
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#60a5fa] transition-all duration-150"
              style={{ width: `${(elapsed / CUTSCENE_DURATION) * 100}%` }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-neutral-500">
            Bang Biru memelukmu dengan tulus sebelum berjalan menuju pintu keluar...
          </p>
        </div>
      </div>
    </div>
  );
};
