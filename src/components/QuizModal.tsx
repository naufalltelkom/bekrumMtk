import React, { useState, useEffect, useRef } from 'react';
import { SimpleQuizData } from '../game/types';
import { sound } from '../game/audio';
import { Lock, AlertTriangle, CheckCircle2, SmilePlus, HeartPulse } from 'lucide-react';

interface QuizModalProps {
  quiz: SimpleQuizData;
  lives: number;
  onCorrect: () => void;
  onWrong: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const QuizModal: React.FC<QuizModalProps> = ({
  quiz,
  lives,
  onCorrect,
  onWrong,
}) => {
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTypedAnswer('');
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [quiz]);

  const submitValue = (val: number) => {
    if (val === quiz.correctAnswer) {
      sound.playSuccess();
      const okMsg =
        quiz.kind === 'locker'
          ? 'Kunci lemari terbuka!'
          : quiz.kind === 'teacher_faint'
          ? 'Kamu tersadar dan bangun kembali!'
          : 'Dia tersentuh dan jiwa aslinya kembali!';
      setFeedback(`BENAR! ${okMsg}`);
      setTimeout(() => {
        onCorrect();
      }, 650);
    } else {
      sound.playError();
      if (quiz.kind === 'teacher_faint') {
        const nextLives = Math.max(0, lives - 1);
        setFeedback(
          `SALAH! Kamu gagal bangun — Nyawa berkurang 1♥ (Sisa: ${nextLives}♥) & kembali ke awal!`
        );
      } else {
        const nextLives = Math.max(0, lives - 0.5);
        setFeedback(
          quiz.kind === 'locker'
            ? `SALAH! Nyawa berkurang 0.5♥ (Sisa: ${nextLives}♥) dan kamu tetap terkunci di lemari! Coba soal baru.`
            : `SALAH! Nyawa berkurang 0.5♥ (Sisa: ${nextLives}♥)! Jawab soal baru agar dia sadar.`
        );
      }
      onWrong();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedAnswer.trim() === '') return;
    const parsed = Number(typedAnswer.trim());
    if (Number.isNaN(parsed)) {
      setFeedback('Masukkan angka yang valid.');
      return;
    }
    submitValue(parsed);
  };

  const isLocker = quiz.kind === 'locker';
  const isTeacherFaint = quiz.kind === 'teacher_faint';
  const isChubby = quiz.kind === 'chubby';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isChubby ? 'bg-[#120b05]/95' : 'bg-black/85'
      }`}
      style={
        isChubby
          ? {
              backgroundImage:
                'radial-gradient(circle at 50% 50%, rgba(45, 28, 12, 0.78) 18%, rgba(10, 6, 2, 0.98) 82%), repeating-linear-gradient(45deg, rgba(120, 78, 35, 0.14) 0px, rgba(120, 78, 35, 0.14) 4px, transparent 4px, transparent 9px)',
            }
          : undefined
      }
    >
      <div
        className={`w-full max-w-md rounded-xl border-2 p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.95)] space-y-4 ${
          isLocker
            ? 'bg-[#0b1310] border-[#42e6bf]/60'
            : isTeacherFaint
            ? 'bg-[#1a0a0c] border-[#ef4444]/70'
            : 'bg-[#1b1209] border-[#b45309]/80'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isLocker
                ? 'bg-[#42e6bf]/15 text-[#42e6bf]'
                : isTeacherFaint
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-600/25 text-amber-400'
            }`}
          >
            {isLocker ? (
              <Lock size={20} />
            ) : isTeacherFaint ? (
              <HeartPulse size={20} />
            ) : (
              <SmilePlus size={20} />
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-neutral-400 uppercase">
              {isLocker
                ? 'TANTANGAN KELUAR LEMARI'
                : isTeacherFaint
                ? 'KAMU PINGSAN DIPUKUL GURU MTK'
                : 'KEPALAMU TERTUTUP KARUNG GONI!'}
            </p>
            <h2 className="text-base sm:text-lg font-extrabold text-white leading-tight">
              {quiz.title}
            </h2>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          {isChubby
            ? 'Karung sudah menutupi kepalamu! Jawab soal ini dengan benar untuk melepas karung lalu memukul perutnya!'
            : quiz.subtitle}
        </p>

        {/* Math Question Card */}
        <div className="p-4 bg-[#050807] border border-neutral-800 rounded-lg text-center space-y-1.5">
          <div className="font-mono text-xs text-[#6fffea]">{quiz.functionExpr}</div>
          <div className="font-mono text-base sm:text-lg font-bold text-[#ffde69]">
            {quiz.questionPrompt}
          </div>
        </div>

        {/* Multiple Choice A B C D */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-neutral-400 tracking-wider">
            PILIH JAWABAN A / B / C / D:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quiz.choices.map((choice, idx) => (
              <button
                key={`${quiz.id}-opt-${idx}`}
                type="button"
                onClick={() => submitValue(choice)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-[#6fffea] rounded-lg font-mono text-sm font-bold text-white transition-colors cursor-pointer"
              >
                <span className="w-6 h-6 rounded bg-neutral-800 text-[#d6c77a] flex items-center justify-center text-xs">
                  {OPTION_LETTERS[idx]}
                </span>
                <span>{choice}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Or Direct Answer Input Box below */}
        <form onSubmit={handleFormSubmit} className="space-y-1.5 pt-2 border-t border-neutral-800">
          <label className="block text-[10px] font-mono text-neutral-400 tracking-wider">
            ATAU KETIK JAWABAN LANGSUNG DI KOTAK INI:
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="number"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Ketik angka..."
              className="flex-1 px-3 py-2 bg-[#050807] border border-neutral-700 focus:border-[#6fffea] rounded font-mono text-sm text-white outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#d6c77a] hover:bg-[#e6d88c] text-neutral-950 font-mono font-bold text-xs rounded cursor-pointer"
            >
              JAWAB
            </button>
          </div>
        </form>

        {feedback && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded text-xs font-mono ${
              feedback.startsWith('BENAR')
                ? 'bg-[#42e6bf]/15 text-[#42e6bf] border border-[#42e6bf]/30'
                : 'bg-[#ff5252]/15 text-[#ff5252] border border-[#ff5252]/30'
            }`}
          >
            {feedback.startsWith('BENAR') ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            )}
            <span>{feedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};
