import React, { useEffect } from 'react';
import { Difficulty } from '../game/types';
import { LEVELS } from '../game/cipher';
import { sound } from '../game/audio';
import { Play } from 'lucide-react';

interface StartScreenProps {
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  selectedDifficulty,
  onSelectDifficulty,
  onStart,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        sound.playClick();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#070a08]/92">
      <div className="w-full max-w-xl bg-[#0e1410] border border-[#d6c77a]/35 rounded-2xl shadow-[0_25px_90px_rgba(0,0,0,0.95)] p-6 sm:p-8 flex flex-col space-y-5">
        {/* Title Lockup */}
        <div className="text-center space-y-1.5">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
            THE LAST <span className="text-[#d6c77a]">EXIT</span>
          </h1>
          <p className="text-xs font-mono text-[#6fffea] tracking-wider">
            MATHCIPHER 3D // FUNGSI KOMPOSISI &amp; INVERS
          </p>
        </div>

        {/* Concise Mission & Entities Overview */}
        <div className="text-xs sm:text-sm text-neutral-300 leading-relaxed text-center space-y-2">
          <p>
            Cari terminal di dalam labirin Backrooms, pecahkan soal{' '}
            <strong className="text-[#ffde69]">Fungsi Komposisi &amp; Invers</strong> secara mandiri
            (tanpa kalkulator), lalu lari ke pintu keluar!
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-left pt-1">
            <div className="p-2 rounded bg-red-950/35 border border-red-800/40 text-red-200">
              <strong className="block text-red-400">1. GURU MTK</strong>
              Lari 75% kecepatan kita. Jika tertangkap = pingsan &amp; jawab soal bangun lagi (-1♥ jika salah).
            </div>
            <div className="p-2 rounded bg-blue-950/35 border border-blue-800/40 text-blue-200">
              <strong className="block text-blue-400">2. KEMEJA BIRU</strong>
              Jalan lambat. Lepas karung, bangunkan, berpelukan &amp; ia akan menghadang Guru MTK!
            </div>
            <div className="p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-200">
              <strong className="block text-white">3. SLENDERMAN</strong>
              Kunci lari di 2m! Dekat 0.5m terbawa ke Dunia Angkasa luas cari Tongkat Ghaib.
            </div>
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>PILIH LEVEL KESULITAN:</span>
            <span className="text-[#d6c77a]">{LEVELS[selectedDifficulty].badge}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((diff) => {
              const active = selectedDifficulty === diff;
              const lvl = LEVELS[diff];
              return (
                <button
                  key={diff}
                  onClick={() => {
                    sound.playClick();
                    onSelectDifficulty(diff);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    active
                      ? 'bg-[#d6c77a]/15 border-[#d6c77a] text-white shadow-[0_0_15px_rgba(214,199,122,0.25)]'
                      : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/70'
                  }`}
                >
                  <span className="font-mono text-xs font-bold tracking-wider">
                    {lvl.id}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 mt-1">
                    10 Menit • {lvl.initialLives}♥
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-2.5 bg-black/60 border border-neutral-800 rounded-md text-[11px] font-mono text-neutral-300 leading-normal">
            {LEVELS[selectedDifficulty].desc}
          </div>
        </div>

        {/* Start Game CTA */}
        <button
          data-start="true"
          onClick={() => {
            sound.playClick();
            onStart();
          }}
          className="w-full py-3.5 bg-[#d6c77a] hover:bg-[#e6d88c] text-neutral-950 font-mono font-bold text-sm tracking-widest uppercase rounded-lg shadow-[0_10px_30px_rgba(214,199,122,0.25)] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Play size={18} fill="currentColor" />
          <span>MASUK KE BACKROOMS (MULAI)</span>
        </button>

        {/* Single-line clean controls hint */}
        <div className="pt-2 border-t border-neutral-800/80 text-center text-[10px] font-mono text-neutral-400">
          WASD Gerak · SHIFT Lari · L Shift Lock (Lari) · Klik Kanan Arah · E Interaksi · Enter Mulai
        </div>
      </div>
    </div>
  );
};
