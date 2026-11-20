import {
  Difficulty,
  LevelConfig,
  LinearFunction,
  MathSubQuestion,
  PuzzleData,
  SimpleQuizData,
} from './types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatLinear(name: 'f' | 'g' | 'h', a: number, b: number): LinearFunction {
  const sign = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
  const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
  return {
    name,
    a,
    b,
    formulaText: `${name}(x) = ${aStr}x ${sign}`,
  };
}

export function evalLinear(fn: LinearFunction, x: number): number {
  return fn.a * x + fn.b;
}

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function letterToNum(ch: string): number {
  const idx = ALPHABET.indexOf(ch.toUpperCase());
  return idx >= 0 ? idx + 1 : 1;
}

export function numToLetter(n: number): string {
  const clamped = Math.max(1, Math.min(26, Math.round(n)));
  return ALPHABET[clamped - 1];
}

export function evalComposite(x: number, fns: LinearFunction[]): number {
  let val = x;
  for (let i = fns.length - 1; i >= 0; i--) {
    val = evalLinear(fns[i], val);
  }
  return val;
}

/**
 * Encrypts an uppercase word using right-to-left function composition (A=1..Z=26, no mod 26):
 * e.g. [f, g] -> (f ∘ g)(x) = f(g(x))
 */
export function encryptWordWithFunctions(word: string, fns: LinearFunction[]): string {
  return word
    .toUpperCase()
    .split('')
    .map((ch) => numToLetter(evalComposite(letterToNum(ch), fns)))
    .join('');
}

/**
 * Decrypts an encrypted word using the inverse of function composition (no mod 26):
 * e.g. (f ∘ g)⁻¹(y) = g⁻¹(f⁻¹(y))
 */
export function decryptWordWithFunctions(ciphertext: string, fns: LinearFunction[]): string {
  return ciphertext
    .toUpperCase()
    .split('')
    .map((ch) => {
      let val = letterToNum(ch);
      for (let i = 0; i < fns.length; i++) {
        val = (val - fns[i].b) / fns[i].a;
      }
      return numToLetter(val);
    })
    .join('');
}

const CIPHER_WORDS = [
  'ABA',
  'ADA',
  'BAB',
  'BAD',
  'BAG',
  'BED',
  'CAB',
  'CAD',
  'DAD',
  'DEA',
  'FAD',
  'FED',
  'GAB',
  'GAD',
  'GAG',
];

function buildCipherQuestion(
  id: string,
  fns: LinearFunction[],
  compositionLabel: string
): {
  id: string;
  label: string;
  mode: 'ENCRYPT';
  plaintext: string;
  ciphertext: string;
  prompt: string;
  hint: string;
  expectedText: string;
} {
  const validWords = CIPHER_WORDS.filter((word) =>
    word.split('').every((ch) => {
      const out = evalComposite(letterToNum(ch), fns);
      return Number.isInteger(out) && out >= 1 && out <= 26;
    })
  );
  const plaintext = validWords.length > 0 ? pick(validWords) : 'ADA';
  const ciphertext = encryptWordWithFunctions(plaintext, fns);

  const firstCh = plaintext[0];
  const firstNum = letterToNum(firstCh);
  const firstEval = evalComposite(firstNum, fns);
  const firstOut = numToLetter(firstEval);

  return {
    id,
    label: 'Soal 3 (Enkripsi Huruf — Komposisi & Invers Langsung)',
    mode: 'ENCRYPT',
    plaintext,
    ciphertext,
    prompt: `Enkripsikan kata "${plaintext}" (3 huruf) memakai ${compositionLabel} (A=1..Z=26) ➔ ...`,
    hint: `Ubah tiap huruf ke angka (A=1..Z=26), lalu hitung langsung hasil fungsinya! Contoh '${firstCh}'=${firstNum} ➔ hasil=${firstEval} (${firstOut}). Untuk mengembalikan huruf asal cukup pakai fungsi inversnya.`,
    expectedText: ciphertext,
  };
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  EASY: {
    id: 'EASY',
    name: 'MUDAH (LEVEL 1)',
    badge: 'Pilih f(x) atau g(x) + Invers + Enkripsi',
    desc: 'Level 1: Pilih f(x) atau g(x), hitung nilai fungsi, fungsi invers, dan enkripsi huruf (A=1..Z=26).',
    timeSeconds: 600,
    initialLives: 3,
  },
  MEDIUM: {
    id: 'MEDIUM',
    name: 'SEDANG (LEVEL 2)',
    badge: 'Komposisi f(x) & g(x) + Enkripsi',
    desc: 'Level 2: Gabungan f(x) dan g(x). Hitung (f ∘ g)(k), invers (f ∘ g)⁻¹(y), dan enkripsi huruf komposisi.',
    timeSeconds: 600,
    initialLives: 3,
  },
  HARD: {
    id: 'HARD',
    name: 'SULIT (LEVEL 3)',
    badge: 'Komposisi 3 Fungsi f, g, h + Enkripsi',
    desc: 'Level 3: Komposisi 3 fungsi f(g(h(x))), invers bertingkat, dan enkripsi huruf 3 fungsi!',
    timeSeconds: 600,
    initialLives: 3,
  },
};

function buildSingleFunctionQuestions(fn: LinearFunction): [MathSubQuestion, MathSubQuestion] {
  // Slightly more challenging than basic entity quizzes: uses 2-step expression
  const x1 = randInt(4, 9);
  const x2 = randInt(2, 6);
  const val1 = evalLinear(fn, x1); // f(x1)
  const fx2 = evalLinear(fn, x2); // f(x2)
  const shift = randInt(2, 5);
  const q1Ans = val1 + shift;

  // Pick one target y for inverse: f^-1(y) = xInv
  const xInv = randInt(5, 11);
  const yInv = evalLinear(fn, xInv);

  return [
    {
      id: `${fn.name}-q1`,
      label: `Soal 1 (Evaluasi ${fn.name}(x))`,
      prompt: `Hitung nilai ${fn.name}(${x1}) + ${shift} = ...`,
      hint: `Substitusikan x = ${x1} ke ${fn.formulaText}, lalu tambah ${shift}.`,
      expectedAnswer: q1Ans,
    },
    {
      id: `${fn.name}-q2`,
      label: `Soal 2 (Invers ${fn.name}⁻¹(x))`,
      prompt: `Tentukan nilai ${fn.name}⁻¹(${yInv}) = ...`,
      hint: `Ubah y = ${fn.a}x ${fn.b >= 0 ? '+' : '-'} ${Math.abs(fn.b)} menjadi x = (y ${fn.b >= 0 ? '-' : '+'} ${Math.abs(fn.b)}) / ${fn.a} dengan y = ${yInv}. (Cek: ${fn.name}(${xInv}) = ${fx2 > -999 ? yInv : yInv})`,
      expectedAnswer: xInv,
    },
  ];
}

export function generatePuzzle(difficulty: Difficulty): PuzzleData {
  const level = LEVELS[difficulty];

  if (difficulty === 'EASY') {
    // Keep outputs strictly inside 1..26 for A..G words (max 3*7 + 4 = 25 <= 26, no mod 26)
    const aF = pick([2, 3]);
    const aG = pick([2, 3]);
    const f = formatLinear('f', aF, aF === 2 ? randInt(1, 6) : randInt(1, 4));
    const g = formatLinear('g', aG, aG === 2 ? randInt(1, 6) : randInt(1, 4));

    const fQs = buildSingleFunctionQuestions(f);
    const gQs = buildSingleFunctionQuestions(g);
    const fCipher = buildCipherQuestion('f-q3', [f], 'f(x)');
    const gCipher = buildCipherQuestion('g-q3', [g], 'g(x)');

    return {
      difficulty,
      level,
      functions: [f, g],
      easyBranches: {
        f: { branchName: 'f', fn: f, questions: fQs, cipherQuestion: fCipher },
        g: { branchName: 'g', fn: g, questions: gQs, cipherQuestion: gCipher },
      },
      questions: fQs,
      cipherQuestion: fCipher,
      summaryText: `${f.formulaText} atau ${g.formulaText}`,
    };
  }

  if (difficulty === 'MEDIUM') {
    // f(g(x)) <= 4x + 6 -> strictly within 1..26 for A..E words (no mod 26)
    const f = formatLinear('f', 2, randInt(1, 2));
    const g = formatLinear('g', 2, randInt(1, 2));

    // Q1: (f o g)(x1)
    const x1 = randInt(2, 5);
    const gx1 = evalLinear(g, x1);
    const fgx1 = evalLinear(f, gx1);

    // Q2: (f o g)^-1(yInv) = xInv (exact integer!)
    const xInv = randInt(2, 6);
    const yInv = evalLinear(f, evalLinear(g, xInv));

    const q1: MathSubQuestion = {
      id: 'med-q1',
      label: 'Soal 1 (Komposisi Fungsi)',
      prompt: `Hitung nilai (f ∘ g)(${x1}) = f(g(${x1})) = ...`,
      hint: `Cari dulu g(${x1}), lalu hasilnya masukkan ke x pada f(x).`,
      expectedAnswer: fgx1,
    };

    const q2: MathSubQuestion = {
      id: 'med-q2',
      label: 'Soal 2 (Invers Komposisi)',
      prompt: `Tentukan nilai (f ∘ g)⁻¹(${yInv}) = ...`,
      hint: `Cari invers dari luar ke dalam: g⁻¹(f⁻¹(${yInv})), atau pecahkan f(g(x)) = ${yInv}.`,
      expectedAnswer: xInv,
    };

    const cipherQuestion = buildCipherQuestion('med-q3', [f, g], '(f ∘ g)(x) = f(g(x))');

    return {
      difficulty,
      level,
      functions: [f, g],
      questions: [q1, q2],
      cipherQuestion,
      summaryText: `${f.formulaText}, ${g.formulaText}`,
    };
  }

  // HARD: 3-function composition f(g(h(x))) <= 4x + 10 -> strictly within 1..26 for A..D words (no mod 26)
  const f = formatLinear('f', 2, randInt(1, 2));
  const g = formatLinear('g', 1, randInt(1, 2));
  const h = formatLinear('h', 2, randInt(1, 2));

  const x1 = randInt(1, 3);
  const hx1 = evalLinear(h, x1);
  const ghx1 = evalLinear(g, hx1);
  const fghx1 = evalLinear(f, ghx1);

  let xInv = randInt(2, 4);
  if (xInv === x1) xInv = x1 + 1;
  const yInv = evalLinear(f, evalLinear(g, evalLinear(h, xInv)));

  const q1: MathSubQuestion = {
    id: 'hard-q1',
    label: 'Soal 1 (Komposisi 3 Fungsi)',
    prompt: `Hitung nilai (f ∘ g ∘ h)(${x1}) = f(g(h(${x1}))) = ...`,
    hint: `Hitung bertahap dari dalam: h(${x1}) ➔ masukkan ke g ➔ masukkan ke f.`,
    expectedAnswer: fghx1,
  };

  const q2: MathSubQuestion = {
    id: 'hard-q2',
    label: 'Soal 2 (Invers 3 Fungsi)',
    prompt: `Tentukan nilai (f ∘ g ∘ h)⁻¹(${yInv}) = ...`,
    hint: `Cari bertahap dari luar: h⁻¹(g⁻¹(f⁻¹(${yInv}))).`,
    expectedAnswer: xInv,
  };

  const cipherQuestion = buildCipherQuestion(
    'hard-q3',
    [f, g, h],
    '(f ∘ g ∘ h)(x) = f(g(h(x)))'
  );

  return {
    difficulty,
    level,
    functions: [f, g, h],
    questions: [q1, q2],
    cipherQuestion,
    summaryText: `${f.formulaText}, ${g.formulaText}, ${h.formulaText}`,
  };
}

/**
 * Generates simple randomized math questions for:
 * - Exiting a Locker ('locker'): e.g. f(x) = 3x + 6, hitung f(2) = ...
 * - Escaping Chubby Entity ('chubby'): e.g. f(x) = 10x + 7, hitung f(5) = ...
 * Ensures no repeated question id if excludeIds is provided!
 */
export function generateSimpleQuiz(
  kind: 'locker' | 'chubby' | 'teacher_faint',
  excludeIds?: Set<string>
): SimpleQuizData {
  let a = 3;
  let b = 6;
  let x = 2;
  let qId = '';

  // Try up to 25 times to guarantee a fresh unique problem every death/retry
  for (let attempt = 0; attempt < 25; attempt++) {
    if (kind === 'locker') {
      a = randInt(2, 7);
      b = randInt(2, 12);
      x = randInt(2, 6);
    } else if (kind === 'teacher_faint') {
      a = randInt(3, 8);
      b = randInt(4, 15);
      x = randInt(2, 6);
    } else {
      a = randInt(4, 12);
      b = randInt(3, 15);
      x = randInt(2, 7);
    }
    qId = `${kind}-${a}x+${b}@${x}`;
    if (!excludeIds || !excludeIds.has(qId)) {
      break;
    }
  }

  const correctAnswer = a * x + b;
  const functionExpr = `f(x) = ${a}x + ${b}`;
  const questionPrompt = `Jika ${functionExpr}, maka nilai f(${x}) adalah ...`;

  // Generate 3 plausible distinct wrong choices
  const choiceSet = new Set<number>([correctAnswer]);
  const offsets = [-6, -4, -3, -2, 2, 3, 4, 6, 8, -a, a, b];
  let safety = 0;
  while (choiceSet.size < 4 && safety < 50) {
    safety++;
    const delta = pick(offsets);
    const candidate = correctAnswer + delta;
    if (candidate > 0 && candidate !== correctAnswer) {
      choiceSet.add(candidate);
    }
  }
  while (choiceSet.size < 4) {
    choiceSet.add(correctAnswer + choiceSet.size * 3);
  }

  const choices = Array.from(choiceSet).sort((u, v) => u - v);

  const titleMap: Record<typeof kind, string> = {
    locker: 'KUNCI LEMARI TERAKTIVASI',
    chubby: 'TERTANGKAP ENTITAS KEMEJA BIRU!',
    teacher_faint: 'PINGSAN TERKENA PENGGARIS GURU MTK!',
  };

  const subtitleMap: Record<typeof kind, string> = {
    locker:
      'Jawab soal sederhana ini untuk membuka kunci lemari dari dalam. Salah menjawab = -0.5♥ & tetap terkunci!',
    chubby:
      'Jawab soal matematika ini agar dia menjadi baik dan membiarkanmu pergi!',
    teacher_faint:
      'Kamu pingsan! Jawab soal ini untuk langsung bangun kembali. Jika SALAH: mati (-1♥) dan mengulang dari awal!',
  };

  return {
    id: qId,
    kind,
    title: titleMap[kind],
    subtitle: subtitleMap[kind],
    functionExpr,
    questionPrompt,
    correctAnswer,
    choices,
  };
}
