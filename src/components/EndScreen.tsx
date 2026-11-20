import React from 'react';
import { GameStatus, PuzzleData, PlayerStats } from '../game/types';
import { Trophy, Skull, RotateCcw, Menu } from 'lucide-react';
import { sound } from '../game/audio';

interface EndScreenProps {
  status: GameStatus;
  stats: PlayerStats;
  puzzle: PuzzleData;
  onRetry: () => void;
  onMenu: () => void;
}

export const EndScreen: React.FC<EndScreenProps> = ({
  status,
  stats,
  puzzle,
  onRetry,
  onMenu,
}) => {
  const isVictory = status === 'VICTORY';
  const timeUsed = stats.maxTime - stats.timeLeft;
  const minutes = Math.floor(timeUsed / 60);
  const seconds = timeUsed % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
      <div className="w-full max-w-lg bg-[#101613] border border-neutral-700/80 rounded-2xl shadow-[0_25px_90px_rgba(0,0,0,0.95)] p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            isVictory
              ? 'bg-[#42e6bf]/20 text-[#42e6bf] border border-[#42e6bf]/40'
              : 'bg-[#ff5252]/20 text-[#ff5252] border border-[#ff5252]/40'
          }`}
        >
          {isVictory ? <Trophy size={32} /> : <Skull size={32} />}
        </div>

        <div className="space-y-1">
          <p
            className={`font-mono text-xs tracking-widest uppercase ${
              isVictory ? 'text-[#42e6bf]' : 'text-[#ff5252]'
            }`}
          >
            {isVictory ? 'MISSION COMPLETE' : 'MISSION FAILED'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {isVictory ? 'KAMU BERHASIL KELUAR!' : 'TERJEBAK DI BACKROOMS'}
          </h2>
          <p className="text-xs text-neutral-300 max-w-md pt-1">
            {isVictory
              ? 'Selamat! Kamu berhasil memecahkan soal Fungsi Komposisi & Invers dan lolos dari para entitas!'
              : stats.lives <= 0
              ? 'Nyawamu habis! Latih kembali hitungan Komposisi & Invers lalu coba lagi.'
              : 'Waktu habis! Terus semangat dan hindari kejaran entitas di ronde berikutnya.'}
          </p>
        </div>

        <div className="w-full grid grid-cols-3 gap-2 p-3 bg-black/60 border border-neutral-800 rounded-xl font-mono text-xs">
          <div className="flex flex-col items-center p-2 rounded bg-neutral-900/50">
            <span className="text-[10px] text-neutral-500">WAKTU</span>
            <span className="text-sm font-bold text-white mt-0.5">{timeFormatted}</span>
          </div>

          <div className="flex flex-col items-center p-2 rounded bg-neutral-900/50">
            <span className="text-[10px] text-neutral-500">SISA NYAWA</span>
            <span className="text-sm font-bold text-[#ff5252] mt-0.5">
              {stats.lives} / {stats.maxLives} ♥
            </span>
          </div>

          <div className="flex flex-col items-center p-2 rounded bg-neutral-900/50">
            <span className="text-[10px] text-neutral-500">LEVEL</span>
            <span className="text-sm font-bold text-[#d6c77a] mt-0.5">
              {stats.difficulty}
            </span>
          </div>
        </div>

        <div className="w-full p-3 bg-[#070b09] border border-neutral-800/80 rounded-lg text-xs font-mono">
          <span className="text-neutral-400 block mb-1">FUNGSI PADA RONDE INI:</span>
          <span className="text-[#6fffea] font-bold text-xs tracking-wide">
            {puzzle.summaryText}
          </span>
        </div>

        <div className="w-full space-y-2.5">
          <button
            data-start="true"
            onClick={() => {
              sound.playClick();
              onRetry();
            }}
            className="w-full py-3.5 bg-[#d6c77a] hover:bg-[#e6d88c] text-neutral-950 font-mono font-bold text-xs tracking-wider uppercase rounded-lg shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>MAIN LAGI (SOAL &amp; MAP BARU)</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onMenu();
            }}
            className="w-full py-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 font-mono text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Menu size={16} />
            <span>KEMBALI KE MENU UTAMA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
