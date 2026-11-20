import React, { useEffect, useState, useCallback } from 'react';
import { sound } from '../game/audio';

interface CaptionStep {
  speaker: string;
  roleColor: string;
  text: string;
  startSec: number;
  endSec: number;
}

export type CinemaVariant =
  | 'opening'
  | 'chubby_capture'
  | 'chubby_counter'
  | 'chubby_sacrifice'
  | 'teacher_catch'
  | 'slender_abduct'
  | 'slender_space_arrive'
  | 'slender_blackhole'
  | 'teacher_zap';

interface VariantConfig {
  duration: number;
  title: string;
  barColor: string;
  captions: CaptionStep[];
  footerAt: (t: number) => string;
}

const CONFIGS: Record<CinemaVariant, VariantConfig> = {
  opening: {
    duration: 20.0,
    title: 'PROLOG: DUNIA NYATA ➔ BACKROOMS',
    barColor: 'bg-[#d6c77a]',
    captions: [
      {
        speaker: 'Dunia Nyata (Depan Rumah)',
        roleColor: '#6fffea',
        text: 'Malam itu di depan rumah, kamu menatap game misterius "The Last Exit" di layar HP-mu...',
        startSec: 0,
        endSec: 5.5,
      },
      {
        speaker: 'Kamu',
        roleColor: '#d6c77a',
        text: 'Aneh banget game ini... ah sudahlah, tutup HP dan masuk ke dalam rumah dulu.',
        startSec: 5.5,
        endSec: 10.5,
      },
      {
        speaker: 'Pintu Rumah Terbuka',
        roleColor: '#fde047',
        text: 'Krieek... Lho?! Kenapa di balik pintu rumahku malah muncul lorong kuning Backrooms?!',
        startSec: 10.5,
        endSec: 15.2,
      },
      {
        speaker: 'Backrooms Level 0',
        roleColor: '#ffde69',
        text: 'Pintu tertutup! Bersiaplah — cari Terminal Matematika & selamatkan dirimu!',
        startSec: 15.2,
        endSec: 20.0,
      },
    ],
    footerAt: (t) =>
      t < 5.5
        ? 'Zoom out perlahan dari layar HP di dunia nyata...'
        : t < 10.5
        ? 'Menutup HP & berjalan tenang menuju pintu rumah...'
        : t < 15.2
        ? 'Membuka pintu rumah — lorong Backrooms muncul di dalam...'
        : 'Melangkah masuk & bersiap menghadapi Backrooms...',
  },
  chubby_capture: {
    duration: 4.8,
    title: 'ENTITAS KEMEJA BIRU MENYERANG!',
    barColor: 'bg-blue-500',
    captions: [
      {
        speaker: 'Bang Biru (Menggeram)',
        roleColor: '#60a5fa',
        text: 'GRRRHH!! Mau lari ke mana kamu?! *mencekek*',
        startSec: 0,
        endSec: 1.7,
      },
      {
        speaker: 'Kamu (Terjatuh Telentang)',
        roleColor: '#f87171',
        text: 'Ugh!! Aku terjatuh telentang di lantai...',
        startSec: 1.7,
        endSec: 2.8,
      },
      {
        speaker: 'Bang Biru',
        roleColor: '#f59e0b',
        text: 'Sini kututup matamu pakai karung goni biar nggak kabur!!',
        startSec: 2.8,
        endSec: 4.8,
      },
    ],
    footerAt: (t) =>
      t < 1.7
        ? 'Bang Biru mencekek lehermu sambil menggeram...'
        : t < 2.8
        ? 'Kamu terjatuh telentang ke lantai...'
        : 'POV Telentang: Bang Biru menurunkan karung ke kepalamu...',
  },
  chubby_counter: {
    duration: 3.4,
    title: 'MELEPAS KARUNG & SERANGAN BALIK!',
    barColor: 'bg-amber-400',
    captions: [
      {
        speaker: 'Kamu',
        roleColor: '#6fffea',
        text: 'Berhasil lepas dari karung! Rasakan pukulan ini!!',
        startSec: 0,
        endSec: 1.5,
      },
      {
        speaker: 'Bang Biru (Tertinju Perut)',
        roleColor: '#60a5fa',
        text: 'OOUUGHH!! *pingsan & tertidur pulas di lantai*',
        startSec: 1.5,
        endSec: 3.4,
      },
    ],
    footerAt: (t) =>
      t < 1.3
        ? 'Melepas karung & bersiap meninju perut Bang Biru...'
        : 'BUGH!! Bang Biru terpukul perutnya hingga pingsan tertidur!',
  },
  chubby_sacrifice: {
    duration: 12.2,
    title: 'PENGORBANAN BANG BIRU!',
    barColor: 'bg-red-500',
    captions: [
      {
        speaker: 'Bang Biru (Jalan ke Pintu Keluar)',
        roleColor: '#60a5fa',
        text: 'Ikuti aku ke arah pintu keluar, biar aku buka jalannya—',
        startSec: 0,
        endSec: 2.2,
      },
      {
        speaker: 'Bang Biru (Menghadang 5 Detik!)',
        roleColor: '#fde047',
        text: 'AWAS GURU MTK! Cepat pergi! Aku hadang dia di sini selama mungkin!!',
        startSec: 2.2,
        endSec: 7.2,
      },
      {
        speaker: 'Guru Matematika (Menyeret)',
        roleColor: '#ef4444',
        text: 'MINGGIR KAU! *menunduk & menyeret tubuh telentang Bang Biru ke samping dengan tangan kirinya*',
        startSec: 7.2,
        endSec: 9.8,
      },
      {
        speaker: 'Guru Matematika (Mengejar!)',
        roleColor: '#f87171',
        text: 'SEKARANG GILIRANMU MURID NAKAL!! *berlari mengejarmu*',
        startSec: 9.8,
        endSec: 12.2,
      },
    ],
    footerAt: (t) =>
      t < 2.2
        ? 'Bang Biru berjalan menuju arah pintu keluar...'
        : t < 7.2
        ? `Bang Biru menghadang Guru MTK (${Math.max(1, Math.ceil(7.2 - t))}s)...`
        : t < 8.6
        ? 'Guru MTK memukul Bang Biru hingga pingsan telentang...'
        : t < 9.8
        ? 'Guru MTK menunduk & menyeret Bang Biru ke samping pakai tangan kiri...'
        : 'LARI KE BELAKANG! Guru Matematika mulai mengejarmu!',
  },
  teacher_catch: {
    duration: 8.5,
    title: 'TERTANGKAP GURU MATEMATIKA!',
    barColor: 'bg-red-600',
    captions: [
      {
        speaker: 'Guru Matematika (Memukul Penggaris)',
        roleColor: '#ef4444',
        text: 'SUDAH KUBILANG JANGAN LARI! *memukulmu dengan penggaris kayu hingga pingsan*',
        startSec: 0,
        endSec: 2.2,
      },
      {
        speaker: 'Guru Matematika (Menginjak Perut)',
        roleColor: '#f87171',
        text: 'Rasakan injakan ini di perutmu!!',
        startSec: 2.2,
        endSec: 5.0,
      },
      {
        speaker: 'Guru Matematika (Menjauh)',
        roleColor: '#fbbf24',
        text: 'Hmph! Aku pergi dulu... nanti kamu lihat saja di ujung labirin!',
        startSec: 5.0,
        endSec: 8.5,
      },
    ],
    footerAt: (t) =>
      t < 2.2
        ? 'Guru MTK memukulmu dengan penggaris hingga pingsan...'
        : t < 5.0
        ? 'Guru MTK menginjak perutmu dengan kejam...'
        : 'Guru MTK berlari pelan menjauh ke sisi jauh peta labirin...',
  },
  slender_abduct: {
    duration: 5.5,
    title: 'SLENDERMAN MENCEKEK & MENGANGKATMU',
    barColor: 'bg-purple-500',
    captions: [
      {
        speaker: 'Slenderman',
        roleColor: '#e5e7eb',
        text: '...Kedua tangannya terus mencekek lehermu & mengangkatmu tinggi ke atas...',
        startSec: 0,
        endSec: 3.4,
      },
      {
        speaker: 'Dimensi Angkasa',
        roleColor: '#c084fc',
        text: 'Masih tercekek di udara — TELEPORT MEMASUKI DUNIA ANGKASA SLENDERMAN!',
        startSec: 3.4,
        endSec: 5.5,
      },
    ],
    footerAt: (t) =>
      t < 3.4
        ? 'Slenderman terus mencekek & mengangkatmu ke atas...'
        : 'Masih tercekek saat portal Dunia Angkasa terbuka...',
  },
  slender_space_arrive: {
    duration: 5.6,
    title: 'TURUN DARI LANGIT ANGKASA & DIDORONG KE JURANG!',
    barColor: 'bg-purple-400',
    captions: [
      {
        speaker: 'Langit Dunia Angkasa',
        roleColor: '#c084fc',
        text: 'Dari atas langit Dunia Angkasa, Slenderman turun bersamamu tepat ke tengah arena...',
        startSec: 0,
        endSec: 1.7,
      },
      {
        speaker: 'Slenderman (Mendorong Keras!)',
        roleColor: '#f87171',
        text: 'BUKK!! Begitu tiba di tengah, Slenderman mendorongmu keras ke arah pinggir jurang!!',
        startSec: 1.7,
        endSec: 3.4,
      },
      {
        speaker: 'Tepi Jurang Angkasa',
        roleColor: '#6fffea',
        text: 'Nyaris jatuh ke luar angkasa!! Cepat tahan keseimbangan & cari Tongkat Kunci Ghaib!',
        startSec: 3.4,
        endSec: 5.6,
      },
    ],
    footerAt: (t) =>
      t < 1.7
        ? 'Slenderman turun dari atas Dunia Angkasa menuju tengah platform...'
        : t < 3.4
        ? 'Mendorong tubuhmu keras ke arah pinggir jurang angkasa...'
        : 'Hampir terjatuh di tepi jurang! Bersiap mencari Tongkat Ghaib...',
  },
  slender_blackhole: {
    duration: 4.8,
    title: 'SLENDERMAN TERSEDOT BLACK HOLE!',
    barColor: 'bg-purple-500',
    captions: [
      {
        speaker: 'Pusaran Black Hole Terbuka!',
        roleColor: '#c084fc',
        text: '10 serangan petir Tongkat Ghaib menghancurkan pertahanan Slenderman! Black Hole raksasa terbuka di belakangnya!',
        startSec: 0,
        endSec: 1.5,
      },
      {
        speaker: 'Slenderman Tersedot',
        roleColor: '#f87171',
        text: 'Gravitasi Black Hole menarik tubuh Slenderman berputar & tersedot habis ke dalam pusaran hitam!!',
        startSec: 1.5,
        endSec: 3.7,
      },
      {
        speaker: 'Portal Backrooms Terbuka!',
        roleColor: '#6fffea',
        text: 'Slenderman lenyap ditelan Black Hole! Portal bergambar Backrooms terbuka—masuklah untuk kembali ke posisimu semula!',
        startSec: 3.7,
        endSec: 4.8,
      },
    ],
    footerAt: (t) =>
      t < 1.5
        ? 'Black Hole terbuka kuat di atas arena angkasa...'
        : t < 3.7
        ? 'Slenderman berputar & tersedot masuk ke dalam Black Hole...'
        : 'Teleport kembali ke Backrooms membawa Tongkat Kunci Ghaib...',
  },
  teacher_zap: {
    duration: 7.8,
    title: 'PETIR TONGKAT GHAIB MENYENGAT GURU MTK!',
    barColor: 'bg-[#6fffea]',
    captions: [
      {
        speaker: 'Petir Tongkat Ghaib',
        roleColor: '#6fffea',
        text: 'ZAPPP!! Petir kecil menyambar — Guru Matematika mental jauh ke belakang!!',
        startSec: 0,
        endSec: 1.5,
      },
      {
        speaker: 'Guru Matematika (Tengkurap Pingsan)',
        roleColor: '#fbbf24',
        text: 'BRAKK! Guru Matematika terbanting & jatuh tengkurap pingsan di lantai!',
        startSec: 1.5,
        endSec: 3.0,
      },
      {
        speaker: 'Guru Matematika (Memaksa Bangun)',
        roleColor: '#f87171',
        text: 'Urghh... Guru MTK mencoba memaksa dirinya bangun dengan tubuh gemetar...',
        startSec: 3.0,
        endSec: 5.5,
      },
      {
        speaker: 'Guru Matematika (Ambruk Tak Berdaya)',
        roleColor: '#42e6bf',
        text: 'BRUKK! Tenaganya habis & kembali pingsan tak berdaya! Timer bangun mulai berjalan!',
        startSec: 5.5,
        endSec: 7.8,
      },
    ],
    footerAt: (t) =>
      t < 1.5
        ? 'Tersengat petir kecil & mental jauh ke belakang...'
        : t < 3.0
        ? 'Guru MTK jatuh tengkurap pingsan...'
        : t < 5.5
        ? 'Guru MTK berusaha memaksa bangun dari tengkurap...'
        : 'Terjatuh tak berdaya & pingsan! Waktu pemulihan akan berjalan...',
  },
};

interface CutsceneOverlayProps {
  variant: CinemaVariant;
  onComplete: () => void;
}

export const CutsceneOverlay: React.FC<CutsceneOverlayProps> = ({ variant, onComplete }) => {
  const cfg = CONFIGS[variant];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timers: number[] = [];

    if (variant === 'opening') {
      timers.push(window.setTimeout(() => sound.playDoorCreak(), 10600));
    } else if (variant === 'chubby_capture') {
      sound.playChubbyGrowl();
      timers.push(window.setTimeout(() => sound.playChubbyGrowl(), 950));
      timers.push(window.setTimeout(() => sound.playTeacherHit(), 1750));
    } else if (variant === 'chubby_counter') {
      sound.playLockerToggle(false);
      timers.push(window.setTimeout(() => sound.playPunch(), 1300));
    } else if (variant === 'chubby_sacrifice') {
      sound.setChaserAudio('TEACHER');
      timers.push(window.setTimeout(() => sound.playTeacherHit(), 7200));
      timers.push(window.setTimeout(() => sound.playDragSfx(), 8500));
    } else if (variant === 'teacher_catch') {
      sound.setChaserAudio('TEACHER');
      sound.playTeacherHit();
      timers.push(window.setTimeout(() => sound.playTeacherStomp(), 2300));
      timers.push(window.setTimeout(() => sound.playTeacherStomp(), 3450));
      timers.push(window.setTimeout(() => sound.playTeacherStomp(), 4400));
    } else if (variant === 'slender_abduct') {
      sound.setChaserAudio('SLENDER');
      sound.playSlenderJumpscare();
      timers.push(window.setTimeout(() => sound.playTeleportWarp(), 3400));
    } else if (variant === 'slender_space_arrive') {
      sound.startSpaceAudio();
      timers.push(window.setTimeout(() => sound.playTeacherHit(), 2900));
    } else if (variant === 'slender_blackhole') {
      sound.playElectricShock();
      timers.push(window.setTimeout(() => sound.playTeleportWarp(), 1500));
      timers.push(window.setTimeout(() => sound.playDoorOpen(), 3600));
    } else if (variant === 'teacher_zap') {
      sound.playElectricShock();
      timers.push(window.setTimeout(() => sound.playTeacherHit(), 1250));
      timers.push(window.setTimeout(() => sound.playTeacherStomp(), 5600));
    }

    const startMs = performance.now();
    const tickId = window.setInterval(() => {
      const sec = (performance.now() - startMs) / 1000;
      setElapsed(Math.min(cfg.duration, sec));
      if (sec >= cfg.duration) {
        window.clearInterval(tickId);
        onComplete();
      }
    }, 65);

    return () => {
      window.clearInterval(tickId);
      timers.forEach((id) => window.clearTimeout(id));
      sound.setChaserAudio('NONE');
    };
  }, [variant, cfg.duration, onComplete]);

  const currentCaption =
    cfg.captions.find((c) => elapsed >= c.startSec && elapsed < c.endSec) ||
    cfg.captions[cfg.captions.length - 1];
  const remaining = Math.max(0, Math.ceil(cfg.duration - elapsed));

  // Burlap sack screen darken near end of chubby_capture
  const sackAlpha =
    variant === 'chubby_capture' && elapsed >= 3.2
      ? Math.min(0.94, ((elapsed - 3.2) / 1.55) * 0.94)
      : 0;

  const isTeleportFlash =
    (variant === 'slender_abduct' && elapsed >= 3.6) ||
    (variant === 'slender_blackhole' && elapsed >= 3.7);

  return (
    <div
      data-testid={`cutscene-${variant}`}
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none"
    >
      {/* Top Cinema Letterbox Bar */}
      <div className="w-full h-[13vh] sm:h-[15vh] bg-black border-b border-neutral-900 flex items-center justify-between px-6 relative z-20">
        <div className="font-mono text-[11px] text-neutral-300 tracking-widest uppercase">
          {cfg.title} ({remaining}s)
        </div>
        <button
          data-testid="cutscene-skip-btn"
          onClick={() => {
            sound.playClick();
            onComplete();
          }}
          className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono rounded cursor-pointer"
        >
          Lewati &gt;&gt;
        </button>
      </div>

      {/* Middle 3D Viewport Area */}
      <div className="flex-1 relative flex items-end justify-center pb-5 px-4 pointer-events-none">
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-300"
          style={{
            background: isTeleportFlash
              ? 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.45) 10%, rgba(15, 5, 35, 0.88) 100%)'
              : variant === 'teacher_zap' && elapsed < 1.2
              ? 'radial-gradient(circle at 50% 50%, rgba(111, 255, 234, 0.25) 10%, rgba(12, 16, 35, 0.58) 100%)'
              : sackAlpha > 0
              ? `radial-gradient(circle at 50% 50%, rgba(36, 22, 10, ${sackAlpha * 0.8}) 5%, rgba(16, 9, 3, ${sackAlpha}) 90%)`
              : variant === 'teacher_catch' || variant === 'chubby_sacrifice'
              ? 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(65, 5, 10, 0.52) 100%)'
              : 'radial-gradient(circle at 50% 50%, transparent 48%, rgba(8, 8, 16, 0.55) 100%)',
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
      <div className="w-full h-[13vh] sm:h-[15vh] bg-black border-t border-neutral-900 flex items-center justify-center px-6 relative z-20">
        <div className="w-full max-w-md space-y-1.5">
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${cfg.barColor}`}
              style={{ width: `${(elapsed / cfg.duration) * 100}%` }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-neutral-400">
            {cfg.footerAt(elapsed)}
          </p>
        </div>
      </div>
    </div>
  );
};

interface ChubbyWakeMashProps {
  mode?: 'counter' | 'sacrifice_revive';
  onShakeImpulse: () => void;
  onComplete: () => void;
}

/**
 * Interactive Spacebar Mash Minigame: Player shakes sleeping Chubby until he wakes up!
 */
export const ChubbyWakeMashOverlay: React.FC<ChubbyWakeMashProps> = ({
  mode = 'counter',
  onShakeImpulse,
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [wokeUp, setWokeUp] = useState(false);

  const handlePump = useCallback(() => {
    if (wokeUp) return;
    sound.playBodyShake();
    onShakeImpulse();
    setProgress((prev) => {
      const next = Math.min(100, prev + 11);
      if (next >= 100) {
        setWokeUp(true);
        sound.playSuccess();
      }
      return next;
    });
  }, [wokeUp, onShakeImpulse]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handlePump();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePump]);

  // Slight gentle decay if idle
  useEffect(() => {
    if (wokeUp) {
      const t = window.setTimeout(() => onComplete(), 1100);
      return () => window.clearTimeout(t);
    }
    const id = window.setInterval(() => {
      setProgress((prev) => Math.max(0, prev - 1.5));
    }, 150);
    return () => window.clearInterval(id);
  }, [wokeUp, onComplete]);

  return (
    <div
      data-testid="chubby-wake-mash"
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none"
    >
      <div className="w-full h-[12vh] bg-black border-b border-neutral-900 flex items-center justify-between px-6">
        <span className="font-mono text-xs text-blue-300 tracking-widest uppercase">
          {mode === 'sacrifice_revive'
            ? 'GURU MTK MENJAUH — BANGUNKAN BANG BIRU!'
            : 'BANGUNKAN BANG BIRU DARI PINGSAN!'}
        </span>
        <span className="font-mono text-xs text-neutral-400">
          {wokeUp
            ? mode === 'sacrifice_revive'
              ? 'BANGUN BERDIRI!'
              : 'BANGUN DUDUK!'
            : `${Math.round(progress)}%`}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-end pb-8 px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-md w-full bg-black/85 border-2 border-blue-400/70 rounded-xl p-5 text-center space-y-3 shadow-2xl">
          <p className="font-mono text-xs sm:text-sm font-bold text-white">
            {wokeUp
              ? mode === 'sacrifice_revive'
                ? '✅ Bang Biru tersadar, berdiri normal & menemanimu lagi!'
                : '✅ Bang Biru tersadar & bangun duduk!'
              : 'TEKAN [SPASI] BERULANG-ULANG DENGAN CEPAT UNTUK MENGGUNCANG BADANNYA!'}
          </p>

          <div className="h-3.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
            <div
              className="h-full bg-blue-400 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          {!wokeUp && (
            <button
              type="button"
              onClick={handlePump}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-mono font-extrabold text-sm tracking-wider rounded-lg cursor-pointer transition-transform"
            >
              GOYANGKAN BADANNYA [SPASI]
            </button>
          )}
        </div>
      </div>

      <div className="w-full h-[10vh] bg-black border-t border-neutral-900" />
    </div>
  );
};
