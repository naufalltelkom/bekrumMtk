/**
 * Type definitions for MathCipher 3D game
 */

export type GameStatus =
  | 'START'
  | 'OPENING_CUTSCENE'
  | 'PLAYING'
  | 'TERMINAL'
  | 'LOCKER_QUIZ'
  | 'CHUBBY_CAPTURE_CUTSCENE'
  | 'CHUBBY_QUIZ'
  | 'CHUBBY_COUNTER_CUTSCENE'
  | 'CHUBBY_WAKE_MASH'
  | 'HUG_CUTSCENE'
  | 'CHUBBY_SACRIFICE_CUTSCENE'
  | 'TEACHER_CATCH_CUTSCENE'
  | 'TEACHER_FAINT_QUIZ'
  | 'SLENDER_ABDUCT_CUTSCENE'
  | 'SLENDER_SPACE_ARRIVE_CUTSCENE'
  | 'SLENDER_BLACKHOLE_CUTSCENE'
  | 'TEACHER_ZAP_CUTSCENE'
  | 'SPACE_WORLD'
  | 'VICTORY'
  | 'DEFEAT';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type ChaserType = 'NONE' | 'TEACHER' | 'CHUBBY' | 'SLENDER';

export interface LinearFunction {
  name: 'f' | 'g' | 'h';
  a: number;
  b: number;
  formulaText: string;
}

export interface MathSubQuestion {
  id: string;
  label: string;
  prompt: string;
  hint: string;
  expectedAnswer: number;
}

export interface CipherLetterQuestion {
  id: string;
  label: string;
  mode: 'ENCRYPT';
  plaintext: string;
  ciphertext: string;
  prompt: string;
  hint: string;
  expectedText: string;
}

export interface FunctionBranchPuzzle {
  branchName: 'f' | 'g';
  fn: LinearFunction;
  questions: [MathSubQuestion, MathSubQuestion];
  cipherQuestion: CipherLetterQuestion;
}

export interface LevelConfig {
  id: Difficulty;
  name: string;
  badge: string;
  desc: string;
  timeSeconds: number;
  initialLives: number;
}

export interface PuzzleData {
  difficulty: Difficulty;
  level: LevelConfig;
  functions: LinearFunction[];
  easyBranches?: {
    f: FunctionBranchPuzzle;
    g: FunctionBranchPuzzle;
  };
  questions: MathSubQuestion[];
  cipherQuestion: CipherLetterQuestion;
  summaryText: string;
}

export interface SimpleQuizData {
  id: string;
  kind: 'locker' | 'chubby' | 'teacher_faint';
  title: string;
  subtitle: string;
  functionExpr: string;
  questionPrompt: string;
  correctAnswer: number;
  choices: number[];
}

export interface PlayerStats {
  lives: number;
  maxLives: number;
  timeLeft: number;
  maxTime: number;
  status: GameStatus;
  difficulty: Difficulty;
  distanceToTerminal: number;
  distanceToExit: number;
  isNearTerminal: boolean;
  isNearExit: boolean;
  isExitUnlocked: boolean;
  isSprinting: boolean;
  isSprintLocked: boolean;
  isShiftLocked: boolean;
  speed: number;
  lockerUsesLeft: number;
  maxLockerUses: number;
  isNearLocker: boolean;
  isHidingInLocker: boolean;
  activeChaser: ChaserType;
  alertMessage: string | null;
  inSpaceWorld: boolean;
  spaceTimeLeft: number;
  hasMysticStaff: boolean;
  isStaffEquipped: boolean;
  teacherStunTimer: number;
  spaceHasPortalOpen: boolean;
  spaceSlenderHp: number;
  spaceSlenderMaxHp: number;
  spaceSlenderBlinking: boolean;
  canReviveChubby: boolean;
  chubbyReviveBlockedReason: string | null;
}
