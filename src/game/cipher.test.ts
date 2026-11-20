import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  evalLinear,
  formatLinear,
  generatePuzzle,
  generateSimpleQuiz,
} from './cipher';

test('HARD difficulty starts with exactly 3 lives', () => {
  assert.equal(LEVELS.HARD.initialLives, 3);
  assert.equal(LEVELS.EASY.initialLives, 3);
  assert.equal(LEVELS.MEDIUM.initialLives, 3);
});

test('formatLinear & evalLinear compute exact integers without mod 26', () => {
  const f = formatLinear('f', 3, 6);
  assert.equal(evalLinear(f, 2), 12);
  assert.equal(evalLinear(f, 10), 36); // proves no mod 26 truncation
});

test('EASY level provides selectable f(x) and g(x) branches with exact answers', () => {
  const puzzle = generatePuzzle('EASY');
  assert.ok(puzzle.easyBranches, 'EASY must provide easyBranches for f and g');
  const fBranch = puzzle.easyBranches.f;
  const gBranch = puzzle.easyBranches.g;

  assert.equal(fBranch.questions.length, 2);
  assert.equal(gBranch.questions.length, 2);
  assert.ok(Number.isInteger(fBranch.questions[0].expectedAnswer));
  assert.ok(Number.isInteger(fBranch.questions[1].expectedAnswer));
  assert.ok(Number.isInteger(gBranch.questions[0].expectedAnswer));
  assert.ok(Number.isInteger(gBranch.questions[1].expectedAnswer));

  // Verify inverse question satisfies f(ans) == yInv
  const fInvPrompt = fBranch.questions[1].prompt;
  const match = fInvPrompt.match(/f⁻¹\((-?\d+)\)/);
  assert.ok(match, 'Prompt should ask for f⁻¹(y)');
  const yInv = Number(match![1]);
  assert.equal(evalLinear(fBranch.fn, fBranch.questions[1].expectedAnswer), yInv);
});

test('MEDIUM level computes 2-function composition f(g(x)) and inverse cleanly', () => {
  const puzzle = generatePuzzle('MEDIUM');
  assert.equal(puzzle.functions.length, 2);
  const [f, g] = puzzle.functions;

  const q1Match = puzzle.questions[0].prompt.match(/\(f ∘ g\)\((-?\d+)\)/);
  assert.ok(q1Match);
  const x1 = Number(q1Match![1]);
  assert.equal(puzzle.questions[0].expectedAnswer, evalLinear(f, evalLinear(g, x1)));

  const q2Match = puzzle.questions[1].prompt.match(/\(f ∘ g\)⁻¹\((-?\d+)\)/);
  assert.ok(q2Match);
  const yInv = Number(q2Match![1]);
  const xAns = puzzle.questions[1].expectedAnswer;
  assert.equal(evalLinear(f, evalLinear(g, xAns)), yInv);
});

test('HARD level computes 3-function composition f(g(h(x))) and inverse cleanly', () => {
  const puzzle = generatePuzzle('HARD');
  assert.equal(puzzle.functions.length, 3);
  const [f, g, h] = puzzle.functions;

  const q1Match = puzzle.questions[0].prompt.match(/\(f ∘ g ∘ h\)\((-?\d+)\)/);
  assert.ok(q1Match);
  const x1 = Number(q1Match![1]);
  assert.equal(
    puzzle.questions[0].expectedAnswer,
    evalLinear(f, evalLinear(g, evalLinear(h, x1)))
  );

  const q2Match = puzzle.questions[1].prompt.match(/\(f ∘ g ∘ h\)⁻¹\((-?\d+)\)/);
  assert.ok(q2Match);
  const yInv = Number(q2Match![1]);
  const xAns = puzzle.questions[1].expectedAnswer;
  assert.equal(evalLinear(f, evalLinear(g, evalLinear(h, xAns))), yInv);
});

test('generateSimpleQuiz generates 4 unique choices and avoids excluded IDs', () => {
  const seen = new Set<string>();
  const kinds: ('locker' | 'chubby' | 'teacher_faint')[] = ['locker', 'chubby', 'teacher_faint'];
  for (let i = 0; i < 12; i++) {
    const q = generateSimpleQuiz(kinds[i % 3], seen);
    assert.equal(seen.has(q.id), false, 'Should avoid repeating questions');
    seen.add(q.id);
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4, 'Choices must be unique');
    assert.ok(q.choices.includes(q.correctAnswer), 'Correct answer must be in choices');
  }
});

test('Soal 3 letter encryption uses direct A=1..Z=26 composition & inverse without mod 26', async () => {
  const {
    ALPHABET,
    decryptWordWithFunctions,
    encryptWordWithFunctions,
    evalComposite,
    letterToNum,
    numToLetter,
  } = await import('./cipher');
  assert.equal(ALPHABET.length, 26);
  assert.equal(letterToNum('A'), 1);
  assert.equal(letterToNum('Z'), 26);
  assert.equal(numToLetter(1), 'A');
  assert.equal(numToLetter(26), 'Z');

  for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
    for (let trial = 0; trial < 15; trial++) {
      const p = generatePuzzle(diff);
      assert.ok(p.cipherQuestion, `${diff} must provide cipherQuestion`);
      assert.equal(p.cipherQuestion.expectedText.length, 3);
      assert.equal(p.cipherQuestion.prompt.toLowerCase().includes('mod 26'), false);

      const activeFns =
        diff === 'EASY' && p.easyBranches ? [p.easyBranches.f.fn] : p.functions;

      for (const ch of p.cipherQuestion.plaintext) {
        const y = evalComposite(letterToNum(ch), activeFns);
        assert.ok(y >= 1 && y <= 26, `${diff} letter ${ch} -> ${y} must fit 1..26 without mod 26`);
      }

      assert.equal(
        encryptWordWithFunctions(p.cipherQuestion.plaintext, activeFns),
        p.cipherQuestion.expectedText
      );
      assert.equal(
        decryptWordWithFunctions(p.cipherQuestion.expectedText, activeFns),
        p.cipherQuestion.plaintext
      );
    }
  }
});

