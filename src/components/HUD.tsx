import React, { useState, useEffect } from 'react';
import { PlayerStats } from '../game/types';
import {
  Volume2,
  VolumeX,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  DoorClosed,
  AlertTriangle,
  Crosshair,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { sound } from '../game/audio';

export interface MinimapEntityMarker {
  id: string;
  x: number;
  z: number;
  color: string;
  radius?: number;
}

interface HUDProps {
  stats: PlayerStats;
  maze: number[][];
  mazeSize: number;
  playerPos: { x: number; z: number };
  playerYaw: number;
  enemyMarkers?: MinimapEntityMarker[];
  lockerMarkers?: { x: number; z: number }[];
  onOpenMenu: () => void;
  onOpenTerminal: () => void;
  onToggleLocker: () => void;
  onInteract: () => void;
  onToggleShiftLock: () => void;
  onUseMysticStaff: () => void;
  onCastLightning: () => void;
  onReviveChubby: () => void;
}

/**
 * Custom Half-Heart / Full-Heart / Empty-Heart SVG renderer
 */
const HeartIcon: React.FC<{ fill: 'full' | 'half' | 'empty' }> = ({ fill }) => {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true">
      <defs>
        <clipPath id="halfClip">
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      {/* Empty outline */}
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="#2e2e34"
        stroke="#52525b"
        strokeWidth="1.2"
      />
      {fill === 'full' && (
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="#ff5252"
        />
      )}
      {fill === 'half' && (
        <path
          clipPath="url(#halfClip)"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="#ff5252"
        />
      )}
    </svg>
  );
};

/**
 * Memoized static 19x19 maze walls SVG layer so 361 rects never diff on 180ms HUD updates (prevents frame hitches)
 */
const MazeWallsLayer = React.memo(({ maze }: { maze: number[][] }) => {
  return (
    <>
      {maze.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            fill={cell === 1 ? '#eed868' : '#08130c'}
            stroke={cell === 1 ? '#a89538' : '#030805'}
            strokeWidth={0.06}
          />
        ))
      )}
    </>
  );
});

export const HUD: React.FC<HUDProps> = ({
  stats,
  maze,
  mazeSize,
  playerPos,
  playerYaw,
  enemyMarkers = [],
  lockerMarkers = [],
  onOpenMenu,
  onOpenTerminal,
  onToggleLocker,
  onInteract,
  onToggleShiftLock,
  onUseMysticStaff,
  onCastLightning,
  onReviveChubby,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [showMinimap, setShowMinimap] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;
    const calcFps = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 750) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(calcFps);
    };
    animId = requestAnimationFrame(calcFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const minutes = Math.floor(stats.timeLeft / 60);
  const seconds = stats.timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Half-heart calculation
  const heartStates: ('full' | 'half' | 'empty')[] = Array.from(
    { length: stats.maxLives },
    (_, i) => {
      const rem = stats.lives - i;
      if (rem >= 0.75) return 'full';
      if (rem >= 0.25) return 'half';
      return 'empty';
    }
  );

  // Dynamic Objective Text
  let objectiveText = 'Cari terminal matematika & hindari 3 entitas.';
  if (stats.inSpaceWorld) {
    objectiveText = stats.spaceHasPortalOpen
      ? 'Portal Backrooms terbuka! Masuk ke portal untuk kembali ke posisi awal!'
      : stats.hasMysticStaff
      ? 'Tongkat didapat! Tembak Slenderman 10x dengan [KLIK KIRI / ENTER]!'
      : 'Cari TONGKAT KUNCI GHAIB di Dunia Angkasa!';
  } else if (stats.isHidingInLocker) {
    objectiveText = 'BERSEMBUNYI DI LEMARI — Mengintip lewat celah kecil pintu brankas.';
  } else if (stats.isExitUnlocked) {
    objectiveText = 'PINTU TERBUKA! Lari ke pintu keluar sekarang!';
  } else if (stats.isNearTerminal) {
    objectiveText = 'Terminal ditemukan! Tekan [E] untuk mengerjakan soal.';
  } else if (stats.distanceToTerminal < 16) {
    objectiveText = `Terminal dekat (${Math.round(stats.distanceToTerminal)}m).`;
  }

  // Minimap coordinate math
  const cellSize = 4.0;
  const offset = (mazeSize - 1) / 2;
  const playerCol = Math.min(mazeSize - 1, Math.max(0, playerPos.x / cellSize + offset));
  const playerRow = Math.min(mazeSize - 1, Math.max(0, playerPos.z / cellSize + offset));

  const termCol = mazeSize - 3;
  const termRow = mazeSize - 3;
  const exitCol = mazeSize - 2;
  const exitRow = mazeSize - 2;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between overflow-hidden">
      {/* LOCKER INSIDE VIEW PERIMETER VIGNETTE (leaves 3D steel locker & louver slits crisp in center!) */}
      {stats.isHidingInLocker && !stats.inSpaceWorld && (
        <div
          data-testid="locker-inside-pov"
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0) 42%, rgba(4, 7, 6, 0.65) 82%, rgba(0, 0, 0, 0.92) 100%)',
          }}
        />
      )}

      {/* 1. TOP HEADER BAR */}
      <header className="relative z-20 flex items-start justify-between px-3 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        {/* TOP-LEFT CLUSTER: Menu, Controls/Shift Lock + TOP-LEFT RADAR MAP (+20% enlarged) */}
        <div className="flex flex-col items-start gap-2 pointer-events-auto">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onOpenMenu();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/70 rounded text-xs font-mono tracking-wider transition-colors cursor-pointer"
            >
              ← MENU
            </button>

            <button
              data-testid="shift-lock-btn"
              onClick={() => {
                sound.playClick();
                onToggleShiftLock();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                stats.isShiftLocked
                  ? 'bg-[#ffde69]/20 border-[#ffde69] text-[#ffde69]'
                  : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/70 text-neutral-300'
              }`}
              title="Toggle Shift Lock Auto-Lari (Tombol L)"
            >
              <Crosshair size={13} />
              <span>SHIFT LOCK (LARI): {stats.isShiftLocked ? 'ON' : 'OFF'} [L]</span>
            </button>

            <div className="hidden md:block pl-1">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-widest text-sm text-white">
                  MATH<span className="text-[#6fffea]">CIPHER</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-[#d6c77a]/20 text-[#d6c77a] border border-[#d6c77a]/40">
                  {stats.difficulty}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  {fps} FPS
                </span>
              </div>
              <p className="text-[9px] font-mono text-neutral-400 truncate max-w-[260px]">
                {objectiveText}
              </p>
            </div>
          </div>

          {/* TOP-LEFT RADAR MAP (+20% bigger: 84px mobile / 108px desktop) */}
          {!stats.inSpaceWorld ? (
            <div data-testid="top-left-minimap" className="flex flex-col items-start">
              <div className="flex items-center justify-between gap-2 w-full text-[10px] font-mono text-neutral-300 px-1 mb-0.5">
                <span className="flex items-center gap-1 font-bold text-[#6fffea]">
                  <Compass size={12} /> MAP
                </span>
                <button
                  onClick={() => setShowMinimap(!showMinimap)}
                  aria-label={showMinimap ? 'Sembunyikan Map' : 'Tampilkan Map'}
                  className="hover:text-white text-neutral-400 transition-colors p-0.5 cursor-pointer"
                >
                  {showMinimap ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              {showMinimap && (
                <div className="flex flex-col items-center gap-1 bg-[#08100c]/95 border border-[#6fffea]/45 rounded-lg p-1.5 shadow-[0_6px_22px_rgba(0,0,0,0.9)]">
                  <div
                    data-testid="minimap-box"
                    className="relative w-[84px] h-[84px] sm:w-[108px] sm:h-[108px] bg-[#040907] rounded overflow-hidden border border-neutral-800"
                  >
                    <svg viewBox={`0 0 ${mazeSize} ${mazeSize}`} className="w-full h-full">
                      {/* Static 19x19 Maze Corridors & Yellow Walls (memoized) */}
                      <MazeWallsLayer maze={maze} />

                      {/* Hiding Lockers tiny emerald squares */}
                      {lockerMarkers.map((lm, i) => {
                        const lc = lm.x / cellSize + offset;
                        const lr = lm.z / cellSize + offset;
                        return (
                          <rect
                            key={`lk-${i}`}
                            x={lc + 0.15}
                            y={lr + 0.15}
                            width={0.65}
                            height={0.65}
                            fill="#10b981"
                            opacity={0.85}
                          />
                        );
                      })}

                      {/* Exit Gate */}
                      <rect
                        x={exitCol - 0.1}
                        y={exitRow - 0.1}
                        width={1.2}
                        height={1.2}
                        fill={stats.isExitUnlocked ? '#42e6bf' : '#ff4d5e'}
                        stroke="#ffffff"
                        strokeWidth={0.1}
                        rx={0.15}
                      />

                      {/* Terminal */}
                      <circle
                        cx={termCol + 0.5}
                        cy={termRow + 0.5}
                        r={0.8}
                        fill="#6fffea"
                        stroke="#ffffff"
                        strokeWidth={0.1}
                      />

                      {/* Enemies on Radar */}
                      {enemyMarkers.map((em) => {
                        const ec = em.x / cellSize + offset;
                        const er = em.z / cellSize + offset;
                        return (
                          <circle
                            key={em.id}
                            cx={ec + 0.5}
                            cy={er + 0.5}
                            r={em.radius ?? 0.72}
                            fill={em.color}
                            stroke="#000000"
                            strokeWidth={0.15}
                          />
                        );
                      })}

                      {/* Player Blip — PURPLE */}
                      <g
                        transform={`translate(${playerCol + 0.5}, ${
                          playerRow + 0.5
                        }) rotate(${(-playerYaw * 180) / Math.PI})`}
                      >
                        <polygon points="0,0 -2.2,-4.8 2.2,-4.8" fill="rgba(192, 132, 252, 0.55)" />
                        <polygon points="0,-1.3 -0.55,0.5 0.55,0.5" fill="#ffffff" />
                        <circle
                          cx={0}
                          cy={0}
                          r={0.95}
                          fill="#a855f7"
                          stroke="#ffffff"
                          strokeWidth={0.18}
                        />
                      </g>
                    </svg>
                  </div>

                  {/* Mini Compact Legend */}
                  <div className="flex items-center gap-1.5 text-[7.5px] font-mono text-neutral-300">
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] inline-block" /> Anda
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-sm bg-[#eed868] inline-block" /> Tembok
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6fffea] inline-block" /> Term
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 bg-[#140929]/95 border border-purple-500/60 rounded-lg font-mono text-[11px] text-purple-200 shadow-lg space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-300">
                <Sparkles size={13} /> DUNIA ANGKASA SLENDERMAN
              </div>
              <div className="text-[10px]">
                {stats.spaceHasPortalOpen
                  ? '🌀 PORTAL BACKROOMS TERBUKA! Masuk ke portal untuk kembali ke lokasi awal!'
                  : stats.hasMysticStaff
                  ? `⚡ Serang Slenderman ${stats.spaceSlenderMaxHp}x pakai [KLIK KIRI / ENTER]! (Kebal saat blink)`
                  : '🔍 Cari Tongkat Kunci Ghaib bercahaya ungu & lari [SHIFT]!'}
              </div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Audio, Mystic Staff, Locker Uses, Half-Heart Health, Timer */}
        <div className="flex items-center gap-2.5 sm:gap-4 pointer-events-auto">
          {stats.hasMysticStaff && (
            <div className="flex items-center gap-1.5">
              {!stats.inSpaceWorld && (
                <button
                  data-testid="staff-equip-btn"
                  onClick={() => {
                    sound.playClick();
                    onUseMysticStaff();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[11px] font-bold cursor-pointer border transition-colors ${
                    stats.isStaffEquipped
                      ? 'bg-purple-700/90 hover:bg-purple-600 border-[#6fffea] text-white shadow-[0_0_16px_rgba(111,255,234,0.5)]'
                      : 'bg-purple-950/90 hover:bg-purple-900 border-purple-400 text-purple-200'
                  }`}
                  title="Pegang atau Simpan Tongkat Kunci Ghaib (Tombol F)"
                >
                  <Wand2 size={14} className="text-[#6fffea]" />
                  <span className="hidden sm:inline">
                    {stats.isStaffEquipped ? '[F] DI TANGAN' : '[F] PEGANG TONGKAT'}
                  </span>
                  <span className="sm:hidden">[F] TONGKAT</span>
                </button>
              )}

              {(stats.isStaffEquipped || stats.inSpaceWorld) && (
                <button
                  data-testid="staff-cast-btn"
                  onClick={onCastLightning}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-900/90 hover:bg-cyan-800 border border-[#6fffea] text-[#6fffea] rounded font-mono text-[11px] font-extrabold shadow-[0_0_14px_rgba(111,255,234,0.45)] cursor-pointer"
                  title="Tembak Petir Sihir Tongkat (Klik Kiri / Tombol Enter)"
                >
                  <Sparkles size={13} />
                  <span>[KLIK KIRI / ENTER] PETIR</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={toggleSound}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-300 hover:text-white rounded transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {!stats.inSpaceWorld && (
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-mono text-neutral-400 tracking-wider">LEMARI</span>
              <span
                className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${
                  stats.lockerUsesLeft > 0 ? 'text-[#42e6bf]' : 'text-[#ff5252]'
                }`}
              >
                {stats.lockerUsesLeft}/{stats.maxLockerUses}
              </span>
            </div>
          )}

          {/* Health (supports 0.5 hearts) */}
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono text-neutral-400 tracking-wider">
              NYAWA ({stats.lives})
            </span>
            <div className="flex items-center gap-0.5">
              {heartStates.map((st, idx) => (
                <HeartIcon key={idx} fill={st} />
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono text-neutral-400 tracking-wider">
              {stats.inSpaceWorld ? 'ANGKASA' : 'WAKTU'}
            </span>
            <span
              className={`font-mono text-sm sm:text-base font-bold tabular-nums ${
                stats.inSpaceWorld
                  ? stats.spaceTimeLeft <= 10
                    ? 'text-[#ff5252]'
                    : 'text-purple-300'
                  : stats.timeLeft < 60
                  ? 'text-[#ff5252]'
                  : 'text-white'
              }`}
            >
              {stats.inSpaceWorld ? `${Math.max(0, Math.ceil(stats.spaceTimeLeft))}s` : timeFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* CHASER WARNING / BOSS HP / SPRINT LOCK / STATUS ALERT BANNER */}
      <div className="relative z-20 flex flex-col items-center gap-1.5 px-4 pointer-events-none">
        {stats.inSpaceWorld && stats.hasMysticStaff && !stats.spaceHasPortalOpen && (
          <div
            data-testid="slender-boss-hp"
            className="w-full max-w-sm bg-[#120724]/95 border border-purple-400/75 rounded-lg px-3.5 py-2 shadow-[0_0_24px_rgba(168,85,247,0.45)] space-y-1.5"
          >
            <div className="flex items-center justify-between text-[11px] font-mono font-extrabold">
              <span className="text-purple-200 tracking-wider">
                HP SLENDERMAN
              </span>
              <span className={stats.spaceSlenderBlinking ? 'text-amber-300' : 'text-[#6fffea]'}>
                {stats.spaceSlenderBlinking
                  ? '⚡ BLINK (KEBAL PETIR!)'
                  : `${stats.spaceSlenderHp} / ${stats.spaceSlenderMaxHp}`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-purple-700/70">
              <div
                className={`h-full transition-all duration-150 ${
                  stats.spaceSlenderBlinking ? 'bg-amber-400/70' : 'bg-gradient-to-r from-purple-500 to-[#6fffea]'
                }`}
                style={{
                  width: `${Math.max(0, (stats.spaceSlenderHp / Math.max(1, stats.spaceSlenderMaxHp)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        {stats.chubbyReviveBlockedReason && !stats.inSpaceWorld && (
          <div className="px-4 py-1 bg-amber-950/90 border border-amber-400 text-amber-200 rounded font-mono text-xs font-bold shadow-lg text-center">
            {stats.chubbyReviveBlockedReason}
          </div>
        )}
        {stats.isSprintLocked && !stats.inSpaceWorld && (
          <div className="px-4 py-1 bg-purple-950/95 border border-purple-400 text-purple-200 rounded font-mono text-xs font-extrabold tracking-widest shadow-lg">
            ⚠ LARI DIKUNCI! SLENDERMAN JARAK &le; 2 METER!
          </div>
        )}
        {stats.teacherStunTimer > 0 && !stats.inSpaceWorld && (
          <div
            data-testid="teacher-stun-timer"
            className="px-4 py-1.5 bg-cyan-950/95 border border-[#6fffea] text-[#6fffea] rounded font-mono text-xs font-extrabold tracking-wider shadow-lg flex items-center gap-2.5"
          >
            <Sparkles size={14} />
            <span>
              ⚡ GURU MTK PINGSAN TAK BERDAYA — BANGUN KEMBALI DALAM: {Math.ceil(stats.teacherStunTimer)}s
            </span>
          </div>
        )}
        {stats.activeChaser === 'TEACHER' && !stats.isHidingInLocker && !stats.inSpaceWorld && (
          <div className="px-4 py-1.5 bg-red-950/90 border border-red-500 text-red-200 rounded font-mono text-xs font-bold tracking-wider flex items-center gap-2 shadow-lg">
            <AlertTriangle size={14} className="text-red-400" />
            <span>
              GURU MTK MENGEJAR (75% SPEED)!{' '}
              {stats.hasMysticStaff
                ? stats.isStaffEquipped
                  ? 'KLIK KIRI / TEKAN [ENTER] TEMBAK PETIR ATAU LARI [SHIFT]!'
                  : 'TEKAN [F] PEGANG TONGKAT + [KLIK KIRI / ENTER] TEMBAK PETIR!'
                : 'LARI [SHIFT] ATAU LEMARI [E]!'}
            </span>
          </div>
        )}
        {stats.activeChaser === 'CHUBBY' && !stats.isHidingInLocker && !stats.inSpaceWorld && (
          <div className="px-4 py-1.5 bg-blue-950/90 border border-blue-400 text-blue-200 rounded font-mono text-xs font-bold tracking-wider shadow-lg">
            ORANG GENDUT KEMEJA BIRU MENGEJAR! JANGAN SAMPAI LAMBAT!
          </div>
        )}
        {stats.activeChaser === 'SLENDER' && !stats.isHidingInLocker && !stats.inSpaceWorld && (
          <div className="px-4 py-1.5 bg-neutral-950/95 border-2 border-red-600 text-red-300 rounded font-mono text-xs font-extrabold tracking-widest shadow-lg">
            SLENDERMAN MELIHATMU! HINDARI JARAK 0.5m ATAU TERBAWA KE DUNIA ANGKASA!
          </div>
        )}
        {stats.alertMessage && (
          <div className="px-4 py-1.5 bg-amber-950/90 border border-amber-400 text-amber-200 rounded font-mono text-xs font-bold shadow-lg text-center">
            {stats.alertMessage}
          </div>
        )}
      </div>

      {/* 2. CENTER RETICLE */}
      <div className="pointer-events-none self-center my-auto flex flex-col items-center opacity-50">
        <div
          className={`w-2 h-2 rounded-full ${
            stats.isShiftLocked ? 'bg-[#6fffea] ring-2 ring-[#6fffea]/40' : 'bg-white/75'
          }`}
        />
      </div>

      {/* 3. INTERACTION PROMPT POPUP (Terminal / Exit / Locker / Revive Chubby) */}
      {!stats.inSpaceWorld &&
        (stats.canReviveChubby ||
          stats.isHidingInLocker ||
          stats.isNearLocker ||
          stats.isNearTerminal ||
          (stats.isNearExit && stats.isExitUnlocked)) && (
        <div className="relative z-20 pointer-events-auto self-center mb-4">
          {stats.canReviveChubby ? (
            <button
              data-testid="revive-chubby-btn"
              onClick={() => {
                sound.playClick();
                onReviveChubby();
              }}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-blue-950/95 hover:bg-blue-900 border-2 border-blue-400 text-white rounded-lg shadow-[0_0_20px_rgba(96,165,250,0.45)] font-mono text-xs sm:text-sm font-bold tracking-wider cursor-pointer"
            >
              <Sparkles size={18} className="text-blue-300" />
              <span>
                BANG BIRU PINGSAN • TEKAN{' '}
                <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-blue-300">
                  SPASI
                </kbd>{' '}
                UNTUK BANGUNKAN!
              </span>
            </button>
          ) : stats.isHidingInLocker ? (
            <button
              onClick={() => {
                sound.playClick();
                onToggleLocker();
              }}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-[#0b1a14] hover:bg-[#122b21] border-2 border-[#42e6bf] text-white rounded-lg shadow-[0_0_20px_rgba(66,230,191,0.35)] font-mono text-xs sm:text-sm font-bold tracking-wider cursor-pointer"
            >
              <DoorClosed size={18} className="text-[#42e6bf]" />
              <span>
                SEDANG DI LEMARI • TEKAN <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-[#42e6bf]">E</kbd> UNTUK KELUAR (JAWAB SOAL)
              </span>
            </button>
          ) : stats.isNearTerminal && !stats.isExitUnlocked ? (
            <button
              onClick={() => {
                sound.playClick();
                onOpenTerminal();
              }}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-neutral-900/95 hover:bg-neutral-800 border-2 border-[#6fffea] text-white rounded-lg shadow-[0_0_20px_rgba(111,255,234,0.4)] font-mono text-xs sm:text-sm font-bold tracking-wider cursor-pointer"
            >
              <KeyRound size={18} className="text-[#6fffea]" />
              <span>
                TEKAN <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-[#d6c77a]">E</kbd> ATAU KLIK UNTUK BUKA TERMINAL
              </span>
            </button>
          ) : stats.isNearExit && stats.isExitUnlocked ? (
            <button
              onClick={() => {
                sound.playClick();
                onInteract();
              }}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-neutral-900/95 hover:bg-neutral-800 border-2 border-[#42e6bf] text-white rounded-lg shadow-[0_0_20px_rgba(66,230,191,0.4)] font-mono text-xs sm:text-sm font-bold tracking-wider cursor-pointer"
            >
              <KeyRound size={18} className="text-[#42e6bf]" />
              <span>
                TEKAN <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-[#42e6bf]">E</kbd> UNTUK KELUAR!
              </span>
            </button>
          ) : stats.isNearLocker ? (
            <button
              onClick={() => {
                sound.playClick();
                onToggleLocker();
              }}
              className={`flex items-center gap-2.5 px-5 py-2.5 border-2 rounded-lg font-mono text-xs sm:text-sm font-bold tracking-wider cursor-pointer ${
                stats.lockerUsesLeft > 0
                  ? 'bg-neutral-900/95 hover:bg-neutral-800 border-[#10b981] text-white'
                  : 'bg-red-950/90 border-red-500 text-red-200'
              }`}
            >
              <DoorClosed size={18} className="text-[#10b981]" />
              <span>
                {stats.lockerUsesLeft > 0
                  ? `TEKAN [E] MASUK LEMARI PERSEMBUNYIAN (SISA ${stats.lockerUsesLeft}x)`
                  : 'KESEMPATAN MASUK LEMARI SUDAH HABIS (0/5)!'}
              </span>
            </button>
          ) : null}
        </div>
      )}

      {/* 4. BOTTOM CLUSTER: CONTROLS DOCK & PACE BAR */}
      <footer className="relative z-20 p-3 sm:p-4 flex items-end justify-between gap-4 pointer-events-none">
        {!stats.inSpaceWorld ? (
          <div className="hidden sm:flex flex-col text-[10px] font-mono text-neutral-400 bg-black/70 border border-neutral-800 rounded px-2.5 py-1.5">
            <span>JARAK TERMINAL: {Math.round(stats.distanceToTerminal)}m</span>
            <span>JARAK EXIT: {Math.round(stats.distanceToExit)}m</span>
          </div>
        ) : (
          <div className="hidden sm:flex flex-col text-[10px] font-mono text-purple-300 bg-[#140929]/85 border border-purple-700/60 rounded px-2.5 py-1.5">
            <span>{stats.spaceHasPortalOpen ? 'PORTAL BACKROOMS: AKTIF' : 'DIMENSI ANGKASA'}</span>
          </div>
        )}

        <div className="pointer-events-auto flex flex-col items-center mx-auto">
          <button
            onClick={() => setIsZenMode(!isZenMode)}
            className="text-[10px] font-mono text-neutral-400 hover:text-white px-2.5 py-0.5 bg-black/75 rounded-t border-t border-x border-neutral-800 transition-colors cursor-pointer"
          >
            {isZenMode ? '▲ PETUNJUK KONTROL' : '▼ SEMBUNYIKAN (ZEN)'}
          </button>

          {!isZenMode && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3.5 py-1.5 bg-neutral-950/90 border border-neutral-800 rounded-lg shadow-xl text-[10px] sm:text-xs font-mono text-neutral-300">
              <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded">WASD</kbd> GERAK
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded">SHIFT</kbd> LARI
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[#ffde69]">L</kbd> SHIFT LOCK (LARI)
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded">KLIK KANAN</kbd> ARAH
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[#6fffea]">E</kbd> INTERAKSI
              </span>
              {stats.hasMysticStaff && (
                <>
                  <span className="text-neutral-600">•</span>
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-purple-950 border border-purple-500 rounded text-purple-300">F</kbd> PEGANG TONGKAT
                  </span>
                  <span className="text-neutral-600">•</span>
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-cyan-950 border border-[#6fffea] rounded text-[#6fffea]">KLIK KIRI / ENTER</kbd> PETIR
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
            <span>PACE:</span>
            <span
              className={`font-bold ${
                stats.isSprintLocked
                  ? 'text-purple-400'
                  : stats.isSprinting
                  ? 'text-[#ffde69]'
                  : 'text-neutral-300'
              }`}
            >
              {stats.isSprintLocked ? 'LOCKED' : stats.isSprinting ? 'SPRINT' : 'WALK'}
            </span>
          </div>
          <div className="w-20 sm:w-24 h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-150 ${
                stats.isSprintLocked
                  ? 'bg-purple-500'
                  : stats.isSprinting
                  ? 'bg-[#ffde69]'
                  : 'bg-[#6fffea]'
              }`}
              style={{ width: `${Math.min(100, (stats.speed / 6.5) * 100)}%` }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
