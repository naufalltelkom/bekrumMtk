import React, { useEffect, useState } from 'react';
import { sound } from '../game/audio';

interface CaptionStep {
  speaker: string;
  roleColor: string;
  text: string;
  startSec: number;
  endSec: number;
}

const TEACHER_KILL_DURATION = 20.0;
const TEACHER_CAPTIONS: CaptionStep[] = [
  {
    speaker: 'Guru Matematika (Kejam)',
    roleColor: '#ef4444',
    text: 'Jawaban salah! Nilai kamu NOL besar... rasakan akibatnya!',
    startSec: 0,
    endSec: 4.5,
  },
  {
    speaker: 'Guru Matematika (Menginjak)',
    roleColor: '#f87171',
    text: 'Jangan harap ada murid yang bisa kabur dari ruang kelasku!',
    startSec: 4.5,
    endSec: 10.0,
  },
  {
    speaker: 'Guru Matematika (Kabur)',
    roleColor: '#fbbf24',
    text: 'Cukup! Waktunya aku lari secepatnya sebelum ada yang melihat!',
    startSec: 10.0,
    endSec: TEACHER_KILL_DURATION,
  },
];

const SLENDER_ABDUCT_DURATION = 6.5;
const SLENDER_CAPTIONS: CaptionStep[] = [
  {
    speaker: 'Slenderman',
    roleColor: '#e5e7eb',
    text: '...Tubuhmu terangkat tinggi oleh cengkeramannya...',
    startSec: 0,
    endSec: 4.0,
  },
  {
    speaker: 'Dimensi Angkasa',
    roleColor: '#c084fc',
    text: 'Cahaya ungu menelanmu — TELEPORT KE DUNIA SLENDERMAN!',
    startSec: 4.0,
    endSec: SLENDER_ABDUCT_DURATION,
  },
];

interface CinemaCutsceneProps {
  variant: 'teacher_kill' | 'slender_abduct';
  onComplete: () => void;
}

export const CinemaCutscene: React.FC<CinemaCutsceneProps> = ({ variant, onComplete }) => {
  const duration = variant === 'teacher_kill' ? TEACHER_KILL_DURATION : SLENDER_ABDUCT_DURATION;
  const captions = variant === 'teacher_kill' ? TEACHER_CAPTIONS : SLENDER_CAPTIONS;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let stompTimerId: number | null = null;
    let warpTimerId: number | null = null;

    if (variant === 'teacher_kill') {
      sound.setChaserAudio('TEACHER');
      sound.playTeacherStomp();
      let stompCount = 0;
      stompTimerId = window.setInterval(() => {
        stompCount++;
        if (stompCount < 7) {
          sound.playTeacherStomp();
        }
      }, 1350);
    } else {
      sound.setChaserAudio('SLENDER');
      warpTimerId = window.setTimeout(() => {
        sound.playTeleportWarp();
      }, 4000);
    }

    const startMs = performance.now();
    const tickId = window.setInterval(() => {
      const sec = (performance.now() - startMs) / 1000;
      setElapsed(Math.min(duration, sec));
      if (sec >= duration) {
        window.clearInterval(tickId);
        onComplete();
      }
    }, 80);

    return () => {
      window.clearInterval(tickId);
      if (stompTimerId !== null) window.clearInterval(stompTimerId);
      if (warpTimerId !== null) window.clearTimeout(warpTimerId);
      sound.setChaserAudio('NONE');
    };
  }, [variant, duration, onComplete]);

  const currentCaption =
    captions.find((c) => elapsed >= c.startSec && elapsed < c.endSec) ||
    captions[captions.length - 1];
  const remaining = Math.max(0, Math.ceil(duration - elapsed));
  const isTeleportFlash = variant === 'slender_abduct' && elapsed >= 4.2;

  return (
    <div
      data-testid={`cutscene-${variant}`}
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none"
    >
      {/* Top Cinema Letterbox Bar */}
      <div className="w-full h-[14vh] sm:h-[16vh] bg-black border-b border-neutral-900 flex items-center justify-between px-6">
        <div className="font-mono text-[11px] text-neutral-400 tracking-widest uppercase">
          {variant === 'teacher_kill'
            ? `GURU MATEMATIKA MENGHABISIMU (${remaining}s)`
            : `SLENDERMAN MENARIKMU KE DUNIANYA (${remaining}s)`}
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

      {/* Middle Transparent 3D Viewport + Vignette & Captions */}
      <div className="flex-1 relative flex items-end justify-center pb-5 px-4 pointer-events-none">
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-500"
          style={{
            background: isTeleportFlash
              ? 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.42) 10%, rgba(15, 5, 35, 0.85) 100%)'
              : variant === 'teacher_kill'
              ? 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(75, 5, 10, 0.65) 100%)'
              : 'radial-gradient(circle at 50% 50%, transparent 42%, rgba(15, 4, 28, 0.68) 100%)',
          }}
        />

        <div className="relative z-10 max-w-xl w-full bg-black/80 border border-white/15 rounded-xl px-5 py-3 text-center shadow-2xl space-y-1">
          <div
            className="font-mono text-xs font-bold tracking-wider uppercase"
            style={{ color: currentCaption.roleColor }}
          >
            {currentCaption.speaker}
          </div>
          <p className="text-sm sm:text-base text-white font-medium leading-relaxed">
            &ldquo;{currentCaption.text}&rdquo;
          </p>
        </div>
      </div>

      {/* Bottom Cinema Letterbox Bar */}
      <div className="w-full h-[14vh] sm:h-[16vh] bg-black border-t border-neutral-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-1.5">
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                variant === 'teacher_kill' ? 'bg-red-500' : 'bg-purple-500'
              }`}
              style={{ width: `${(elapsed / duration) * 100}%` }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-neutral-500">
            {variant === 'teacher_kill'
              ? elapsed < 10
                ? 'Guru Matematika menginjakmu dengan kejam...'
                : 'Guru Matematika berlari kabur sekencang mungkin...'
              : elapsed < 4.0
              ? 'Slenderman mengangkatmu dari lantai...'
              : 'Teleportasi menuju Dunia Angkasa Slenderman...'}
          </p>
        </div>
      </div>
    </div>
  );
};
