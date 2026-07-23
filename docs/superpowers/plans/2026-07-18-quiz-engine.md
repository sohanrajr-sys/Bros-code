# Quiz Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quiz system — MCQ, descriptive (short/long-answer), and coding questions with admin-set percentage weights, graded automatically where possible, finalized by an admin before any student sees a score.

**Architecture:** New Prisma models (`Quiz`, `QuizQuestion`, `QuizMcqOption`, `QuizCodingQuestion`, `QuizCodingTestCase`, `QuizAttempt`, `QuizAnswer`) fully independent of the existing `Problem` bank. A pure-function scoring module (`src/lib/quizScoring.ts`) handles MCQ and short-answer descriptive scoring synchronously at submit time. Coding questions reuse the existing `gradeDsa`/`runPistonSubmission`/`getCodegen` functions unchanged (only its test-case parameter type is generalized) via a second BullMQ queue. Admin authoring reuses the function-signature and test-case editors already built for `Problem`, extracted into shared components. Every attempt requires an explicit admin "Finalize" action before a student can see any score.

**Tech Stack:** Next.js App Router (Server Components + Route Handlers), Prisma, BullMQ, Piston (existing), Zod, Vitest (new — first test framework in this repo).

---

## Spec Reference

Full design: `docs/superpowers/specs/2026-07-18-quiz-engine-design.md`. This plan implements that spec exactly, with one addition caught during planning: `QuizAttempt.isLate` (the spec describes flagging late submissions for the admin's awareness but the schema section omitted the field — added here) and two data-integrity guards not explicit in the spec but required to satisfy it safely: editing a quiz's question set is blocked once it has any attempts, and deleting a quiz with attempts is blocked (both would otherwise cascade-delete real student data).

---

## Phase 0: Test Tooling

This repo has no test framework yet. The scoring engine (Phase 2) is pure, high-stakes logic (weight math, partial credit) — it gets real unit tests. Everything else in this plan follows the codebase's existing verification style: `tsc --noEmit`, `eslint`, and manual/Playwright-driven checks against the running dev server.

### Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `cd /Users/sohanrajrajanna/Downloads/bros-code && npm install --save-dev vitest`

Expected: adds `vitest` to `devDependencies` in `package.json`.

- [ ] **Step 2: Add the test script**

Edit `package.json`'s `scripts` block to add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Verify the runner works with a throwaway test**

Create `src/lib/__vitest_smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 5: Delete the smoke test and commit tooling**

Run: `rm src/lib/__vitest_smoke.test.ts`

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-function unit tests"
```

---

## Phase 1: Schema

### Task 2: Add quiz models to the schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the new enums**

Add after the existing `enum GradingStatus`-style block (after `enum SubmissionStatus` at the end of the enum section):

```prisma
enum QuizStatus {
  DRAFT
  PUBLISHED
}

enum QuizQuestionType {
  MCQ
  DESCRIPTIVE
  CODING
}

enum McqScoringMode {
  ALL_OR_NOTHING
  PROPORTIONAL
}

enum DescriptiveMode {
  SHORT_ANSWER
  LONG_ANSWER
}

enum QuizAttemptStatus {
  IN_PROGRESS
  SUBMITTED
  FINALIZED
}

enum GradingStatus {
  PENDING
  GRADED
}
```

- [ ] **Step 2: Add the quiz models**

Append at the end of `prisma/schema.prisma`:

```prisma
model Quiz {
  id               String     @id @default(cuid())
  title            String
  description      String
  status           QuizStatus @default(DRAFT)
  opensAt          DateTime?
  closesAt         DateTime?
  timeLimitMinutes Int?
  maxAttempts      Int        @default(1)
  createdBy        String
  createdByUser    User       @relation("QuizCreatedBy", fields: [createdBy], references: [id])
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  questions QuizQuestion[]
  attempts  QuizAttempt[]
}

model QuizQuestion {
  id     String           @id @default(cuid())
  quizId String
  order  Int
  type   QuizQuestionType
  weight Int

  mcqScoringMode   McqScoringMode?
  descriptiveMode  DescriptiveMode?
  acceptedKeywords String[]
  prompt           String?

  quiz           Quiz                @relation(fields: [quizId], references: [id], onDelete: Cascade)
  mcqOptions     QuizMcqOption[]
  codingQuestion QuizCodingQuestion?
  answers        QuizAnswer[]

  @@index([quizId])
}

model QuizMcqOption {
  id         String  @id @default(cuid())
  questionId String
  text       String
  isCorrect  Boolean @default(false)
  order      Int

  question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
}

model QuizCodingQuestion {
  id                String  @id @default(cuid())
  questionId        String  @unique
  description       String
  constraints       String?
  functionSignature Json

  question  QuizQuestion         @relation(fields: [questionId], references: [id], onDelete: Cascade)
  testCases QuizCodingTestCase[]
}

model QuizCodingTestCase {
  id                String  @id @default(cuid())
  codingQuestionId  String
  input             String
  expectedOutput    String
  isHidden          Boolean @default(false)
  order             Int

  codingQuestion QuizCodingQuestion @relation(fields: [codingQuestionId], references: [id], onDelete: Cascade)

  @@index([codingQuestionId])
}

model QuizAttempt {
  id            String            @id @default(cuid())
  quizId        String
  userId        String
  attemptNumber Int
  status        QuizAttemptStatus @default(IN_PROGRESS)
  isLate        Boolean           @default(false)
  startedAt     DateTime          @default(now())
  submittedAt   DateTime?
  finalizedAt   DateTime?

  quiz    Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  user    User         @relation(fields: [userId], references: [id])
  answers QuizAnswer[]

  @@index([quizId])
  @@index([userId])
  @@unique([quizId, userId, attemptNumber])
}

model QuizAnswer {
  id         String @id @default(cuid())
  attemptId  String
  questionId String

  selectedOptionIds String[]
  textAnswer        String?
  codeLanguage      Language?
  codeSubmission    String?

  autoScore       Float?
  overriddenScore Float?
  gradingStatus   GradingStatus @default(PENDING)

  attempt  QuizAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([attemptId])
  @@index([questionId])
  @@unique([attemptId, questionId])
}
```

- [ ] **Step 3: Add the reverse relations to `User`**

Find the `User` model's relation block:

```prisma
  createdProblems Problem[]    @relation("ProblemCreatedBy")
  submissions     Submission[]
```

Replace with:

```prisma
  createdProblems Problem[]     @relation("ProblemCreatedBy")
  submissions     Submission[]
  createdQuizzes  Quiz[]        @relation("QuizCreatedBy")
  quizAttempts    QuizAttempt[]
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Create and apply the migration**

Try interactive generation first:

Run: `npx prisma migrate dev --name add_quiz_engine`

If this fails with "Prisma Migrate has detected that the environment is non-interactive" (it will, in this sandbox — hit twice already in this repo's history, for the `add_function_signature` and `add_user_and_role` migrations), write the migration by hand instead, matching Prisma's own generated SQL conventions exactly (`TEXT` ids, `TIMESTAMP(3)` for `DateTime`, `JSONB` for `Json`, `Table_column_idx`/`Table_col1_col2_key`/`Table_column_fkey` naming):

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_quiz_engine
```

Write the following to the new directory's `migration.sql` (substitute the actual timestamped directory name created above):

```sql
-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('MCQ', 'DESCRIPTIVE', 'CODING');

-- CreateEnum
CREATE TYPE "McqScoringMode" AS ENUM ('ALL_OR_NOTHING', 'PROPORTIONAL');

-- CreateEnum
CREATE TYPE "DescriptiveMode" AS ENUM ('SHORT_ANSWER', 'LONG_ANSWER');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "GradingStatus" AS ENUM ('PENDING', 'GRADED');

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "mcqScoringMode" "McqScoringMode",
    "descriptiveMode" "DescriptiveMode",
    "acceptedKeywords" TEXT[],
    "prompt" TEXT,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizMcqOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuizMcqOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizCodingQuestion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "constraints" TEXT,
    "functionSignature" JSONB NOT NULL,

    CONSTRAINT "QuizCodingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizCodingTestCase" (
    "id" TEXT NOT NULL,
    "codingQuestionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuizCodingTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT[],
    "textAnswer" TEXT,
    "codeLanguage" "Language",
    "codeSubmission" TEXT,
    "autoScore" DOUBLE PRECISION,
    "overriddenScore" DOUBLE PRECISION,
    "gradingStatus" "GradingStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizMcqOption_questionId_idx" ON "QuizMcqOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizCodingQuestion_questionId_key" ON "QuizCodingQuestion"("questionId");

-- CreateIndex
CREATE INDEX "QuizCodingTestCase_codingQuestionId_idx" ON "QuizCodingTestCase"("codingQuestionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_userId_attemptNumber_key" ON "QuizAttempt"("quizId", "userId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizMcqOption" ADD CONSTRAINT "QuizMcqOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizCodingQuestion" ADD CONSTRAINT "QuizCodingQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizCodingTestCase" ADD CONSTRAINT "QuizCodingTestCase_codingQuestionId_fkey" FOREIGN KEY ("codingQuestionId") REFERENCES "QuizCodingQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Then apply it:

```bash
npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 6: Verify with a typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (nothing references the new models yet, so this just confirms the generated client itself is valid).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add quiz engine schema (Quiz, QuizQuestion, QuizAttempt, QuizAnswer, etc.)"
```

---

## Phase 2: Scoring Engine (TDD)

Pure functions, no I/O. This is the highest-bug-risk part of the feature (weight math, partial credit), so it's the one part of this plan built test-first.

### Task 3: `scoreMcq` — all-or-nothing mode

**Files:**
- Create: `src/lib/quizScoring.ts`
- Create: `src/lib/quizScoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { scoreMcq } from "./quizScoring";

describe("scoreMcq — ALL_OR_NOTHING", () => {
  it("awards full weight when the selected set exactly matches the correct set", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["b", "a"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(20);
  });

  it("awards zero on a partial match", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a"],
      correctOptionIds: ["a", "b"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });

  it("awards zero when an extra wrong option is selected", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b", "c"],
      correctOptionIds: ["a", "b"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });

  it("awards zero when nothing is selected", () => {
    const score = scoreMcq({
      selectedOptionIds: [],
      correctOptionIds: ["a"],
      scoringMode: "ALL_OR_NOTHING",
      weight: 20,
    });
    expect(score).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- quizScoring`
Expected: FAIL — `Cannot find module './quizScoring'` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

```ts
export type McqScoringMode = "ALL_OR_NOTHING" | "PROPORTIONAL";

export interface McqScoreInput {
  selectedOptionIds: string[];
  correctOptionIds: string[];
  scoringMode: McqScoringMode;
  weight: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scoreMcq(input: McqScoreInput): number {
  const { selectedOptionIds, correctOptionIds, scoringMode, weight } = input;
  const selected = new Set(selectedOptionIds);
  const correct = new Set(correctOptionIds);

  if (scoringMode === "ALL_OR_NOTHING") {
    const exactMatch =
      selected.size === correct.size && [...selected].every((id) => correct.has(id));
    return exactMatch ? weight : 0;
  }

  // PROPORTIONAL — implemented in the next task
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- quizScoring`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizScoring.ts src/lib/quizScoring.test.ts
git commit -m "feat: scoreMcq (all-or-nothing mode)"
```

### Task 4: `scoreMcq` — proportional mode

**Files:**
- Modify: `src/lib/quizScoring.ts`
- Modify: `src/lib/quizScoring.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/quizScoring.test.ts`:

```ts
describe("scoreMcq — PROPORTIONAL", () => {
  it("awards full weight for an exact match", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["a", "b"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(30);
  });

  it("awards partial credit for a partial match (2 of 3 correct)", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(20); // 2/3 * 30
  });

  it("subtracts wrong picks from the credit", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a", "b", "wrong"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(10); // (2 correct - 1 wrong) / 3 * 30
  });

  it("floors at zero when wrong picks outweigh correct ones", () => {
    const score = scoreMcq({
      selectedOptionIds: ["wrong1", "wrong2", "wrong3"],
      correctOptionIds: ["a"],
      scoringMode: "PROPORTIONAL",
      weight: 30,
    });
    expect(score).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const score = scoreMcq({
      selectedOptionIds: ["a"],
      correctOptionIds: ["a", "b", "c"],
      scoringMode: "PROPORTIONAL",
      weight: 10,
    });
    expect(score).toBe(3.33); // 1/3 * 10 = 3.333...
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- quizScoring`
Expected: FAIL on the new `PROPORTIONAL` cases (current implementation returns `0` unconditionally for that branch, so the "exact match" and "partial credit" cases fail; the "floors at zero" case coincidentally passes).

- [ ] **Step 3: Implement proportional scoring**

Replace the `// PROPORTIONAL` comment and its `return 0;` in `scoreMcq` with:

```ts
  const correctPicks = [...selected].filter((id) => correct.has(id)).length;
  const wrongPicks = selected.size - correctPicks;
  const fraction = Math.max(0, correctPicks - wrongPicks) / correct.size;
  return round2(fraction * weight);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- quizScoring`
Expected: `9 passed` (4 from Task 3 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizScoring.ts src/lib/quizScoring.test.ts
git commit -m "feat: scoreMcq (proportional partial credit)"
```

### Task 5: `scoreShortAnswerDescriptive`

**Files:**
- Modify: `src/lib/quizScoring.ts`
- Modify: `src/lib/quizScoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/quizScoring.test.ts`:

```ts
import { scoreShortAnswerDescriptive } from "./quizScoring";

describe("scoreShortAnswerDescriptive", () => {
  it("awards full weight on a case-insensitive keyword match", () => {
    const score = scoreShortAnswerDescriptive("The answer is O(log n)", ["o(log n)"], 15);
    expect(score).toBe(15);
  });

  it("matches any one of several accepted keywords", () => {
    const score = scoreShortAnswerDescriptive("binary search tree", ["bst", "binary search tree"], 15);
    expect(score).toBe(15);
  });

  it("awards zero when no keyword matches", () => {
    const score = scoreShortAnswerDescriptive("linked list", ["array", "hash map"], 15);
    expect(score).toBe(0);
  });

  it("awards zero on an empty answer", () => {
    const score = scoreShortAnswerDescriptive("", ["anything"], 15);
    expect(score).toBe(0);
  });
});
```

Add the import at the top of the test file (merge with the existing `scoreMcq` import line):

```ts
import { scoreMcq, scoreShortAnswerDescriptive } from "./quizScoring";
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- quizScoring`
Expected: FAIL — `scoreShortAnswerDescriptive is not exported`.

- [ ] **Step 3: Implement it**

Add to `src/lib/quizScoring.ts`:

```ts
export function scoreShortAnswerDescriptive(
  textAnswer: string,
  acceptedKeywords: string[],
  weight: number
): number {
  const normalized = textAnswer.toLowerCase();
  const matched = acceptedKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
  return matched ? weight : 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- quizScoring`
Expected: `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizScoring.ts src/lib/quizScoring.test.ts
git commit -m "feat: scoreShortAnswerDescriptive (keyword matching)"
```

### Task 6: `effectiveScore` and `weightsSumTo100`

**Files:**
- Modify: `src/lib/quizScoring.ts`
- Modify: `src/lib/quizScoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/quizScoring.test.ts`:

```ts
import { effectiveScore, weightsSumTo100 } from "./quizScoring";

describe("effectiveScore", () => {
  it("uses the override when present, even if it's zero", () => {
    expect(effectiveScore(10, 0)).toBe(0);
  });

  it("falls back to autoScore when there's no override", () => {
    expect(effectiveScore(10, null)).toBe(10);
  });

  it("falls back to zero when neither is set", () => {
    expect(effectiveScore(null, null)).toBe(0);
  });
});

describe("weightsSumTo100", () => {
  it("is true when weights sum to exactly 100", () => {
    expect(weightsSumTo100([50, 30, 20])).toBe(true);
  });

  it("is false when weights sum to anything else", () => {
    expect(weightsSumTo100([50, 30, 19])).toBe(false);
    expect(weightsSumTo100([50, 30, 21])).toBe(false);
  });

  it("is false for an empty question list", () => {
    expect(weightsSumTo100([])).toBe(false);
  });
});
```

Update the import line to include both:

```ts
import { scoreMcq, scoreShortAnswerDescriptive, effectiveScore, weightsSumTo100 } from "./quizScoring";
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- quizScoring`
Expected: FAIL — `effectiveScore is not exported`.

- [ ] **Step 3: Implement both functions**

Add to `src/lib/quizScoring.ts`:

```ts
export function effectiveScore(autoScore: number | null, overriddenScore: number | null): number {
  if (overriddenScore !== null) return overriddenScore;
  if (autoScore !== null) return autoScore;
  return 0;
}

export function weightsSumTo100(weights: number[]): boolean {
  if (weights.length === 0) return false;
  return weights.reduce((sum, w) => sum + w, 0) === 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- quizScoring`
Expected: `19 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizScoring.ts src/lib/quizScoring.test.ts
git commit -m "feat: effectiveScore and weightsSumTo100"
```

---

## Phase 3: Reuse the DSA Grader for Quiz Coding Questions

### Task 7: Generalize `gradeDsa`'s test-case type

`gradeDsa` currently takes `TestCase[]` (the `Problem`-specific Prisma type). `QuizCodingTestCase` has the identical shape it actually uses (`input`, `expectedOutput`, `isHidden`) — generalizing the parameter type to a local structural interface lets both `Problem` grading and quiz coding-question grading call the exact same function, satisfying the "no new grading engine" goal from the spec literally.

**Files:**
- Modify: `src/worker/graders/dsa.ts:1-13`

- [ ] **Step 1: Replace the `TestCase` import with a local interface**

Current code at the top of `src/worker/graders/dsa.ts`:

```ts
import type { TestCase } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
```

Replace with:

```ts
import type { Language } from "@/generated/prisma/enums";

/** Structural shape both Problem.TestCase and QuizCodingTestCase satisfy. */
export interface GradableTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}
```

- [ ] **Step 2: Update the function signature**

Find:

```ts
export async function gradeDsa(
  language: Language,
  code: string,
  testCases: TestCase[],
  functionSignature?: unknown
): Promise<GradeOutcome> {
```

Replace `testCases: TestCase[]` with `testCases: GradableTestCase[]`:

```ts
export async function gradeDsa(
  language: Language,
  code: string,
  testCases: GradableTestCase[],
  functionSignature?: unknown
): Promise<GradeOutcome> {
```

- [ ] **Step 3: Verify the existing call site still compiles**

`src/worker/index.ts` calls `gradeDsa(submission.language, submission.code, problem.testCases, problem.functionSignature)` — `problem.testCases` is Prisma's `TestCase[]`, which has every field `GradableTestCase` needs plus more, so this is still a valid argument (TypeScript structural typing allows a wider type where a narrower one is expected).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify existing DSA grading still works end-to-end**

Dependent services must be running: `docker compose up -d` (from the repo root, brings up `postgres`/`redis`/`piston`), then in separate terminals `npm run worker` and `npm run dev`.

Run:
```bash
curl -s -X POST http://localhost:3000/api/problems/two-sum/submissions \
  -H "Content-Type: application/json" \
  -H "x-debug-role: student" -H "x-debug-user-id: student1" \
  -d '{"language":"PYTHON","code":"def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []"}'
```
(Substitute the real problem id if `two-sum` isn't the slug used by the route — check `src/app/api/problems/[id]/submissions/route.ts` for whether it takes a slug or a cuid; use whichever the seeded Two Sum problem's `id` actually is.)

Expected: `{"submissionId":"..."}`, and polling `GET /api/submissions/<id>` shows `"status":"PASSED"`.

- [ ] **Step 5: Commit**

```bash
git add src/worker/graders/dsa.ts
git commit -m "refactor: generalize gradeDsa's test-case type so quiz coding questions can reuse it"
```

### Task 8: Add the quiz-grading queue

**Files:**
- Modify: `src/lib/queue.ts`

- [ ] **Step 1: Add the queue definition**

Append to `src/lib/queue.ts`:

```ts
export const QUIZ_GRADING_QUEUE = "quiz-grading";

export interface QuizGradingJobData {
  quizAnswerId: string;
}

const globalForQuizQueue = globalThis as unknown as {
  quizGradingQueue: Queue<QuizGradingJobData> | undefined;
};

export const quizGradingQueue =
  globalForQuizQueue.quizGradingQueue ??
  new Queue<QuizGradingJobData>(QUIZ_GRADING_QUEUE, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQuizQueue.quizGradingQueue = quizGradingQueue;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue.ts
git commit -m "feat: add quiz-grading BullMQ queue"
```

### Task 9: Worker — grade quiz coding answers

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Add the processing function**

Add after the existing `processSubmission` function in `src/worker/index.ts`:

```ts
async function processQuizAnswer(quizAnswerId: string): Promise<void> {
  const answer = await prisma.quizAnswer.findUnique({
    where: { id: quizAnswerId },
    include: {
      question: {
        include: {
          codingQuestion: {
            include: { testCases: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!answer) {
    console.error(`quiz answer ${quizAnswerId} not found, skipping`);
    return;
  }

  const codingQuestion = answer.question.codingQuestion;
  if (!codingQuestion || !answer.codeLanguage || answer.codeSubmission === null) {
    console.error(`quiz answer ${quizAnswerId} is missing coding question data, skipping`);
    return;
  }

  try {
    const outcome = await gradeDsa(
      answer.codeLanguage,
      answer.codeSubmission,
      codingQuestion.testCases,
      codingQuestion.functionSignature
    );

    const passedFraction =
      outcome.results.cases.length === 0
        ? 0
        : outcome.results.cases.filter((c) => c.passed).length / outcome.results.cases.length;
    const autoScore = Math.round(passedFraction * answer.question.weight * 100) / 100;

    await prisma.quizAnswer.update({
      where: { id: quizAnswerId },
      data: { autoScore, gradingStatus: "GRADED" },
    });
  } catch (err) {
    console.error(`quiz answer ${quizAnswerId} errored during grading`, err);
    await prisma.quizAnswer.update({
      where: { id: quizAnswerId },
      data: { autoScore: 0, gradingStatus: "GRADED" },
    });
  }
}
```

- [ ] **Step 2: Add the imports**

At the top of `src/worker/index.ts`, update:

```ts
import { SUBMISSIONS_QUEUE, type SubmissionJobData } from "@/lib/queue";
```

to:

```ts
import { SUBMISSIONS_QUEUE, type SubmissionJobData, QUIZ_GRADING_QUEUE, type QuizGradingJobData } from "@/lib/queue";
```

- [ ] **Step 3: Add the second Worker instance**

After the existing `const worker = new Worker<SubmissionJobData>(...)` block and its `.on(...)` handlers, add:

```ts
const quizWorker = new Worker<QuizGradingJobData>(
  QUIZ_GRADING_QUEUE,
  async (job: Job<QuizGradingJobData>) => {
    await processQuizAnswer(job.data.quizAnswerId);
  },
  { connection: redisConnection, concurrency: 4 }
);

quizWorker.on("completed", (job) => {
  console.log(`quiz answer ${job.data.quizAnswerId} graded`);
});

quizWorker.on("failed", (job, err) => {
  console.error(`job ${job?.id} (quiz answer ${job?.data.quizAnswerId}) failed unexpectedly`, err);
});
```

- [ ] **Step 4: Update the startup log and shutdown handler**

Replace:

```ts
console.log(`judge worker listening on queue "${SUBMISSIONS_QUEUE}"...`);
```

with:

```ts
console.log(`judge worker listening on queues "${SUBMISSIONS_QUEUE}" and "${QUIZ_GRADING_QUEUE}"...`);
```

Replace the `shutdown` function's body:

```ts
async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
```

with:

```ts
async function shutdown() {
  await worker.close();
  await quizWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}
```

- [ ] **Step 5: Verify it compiles and starts**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run worker` (in a terminal, then Ctrl+C after confirming)
Expected log line: `judge worker listening on queues "submissions" and "quiz-grading"...`

- [ ] **Step 6: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat: worker grades quiz coding answers via a second BullMQ queue"
```

---

## Phase 4: Shared Admin Editors (Refactor)

`ProblemForm.tsx` already has a function-signature editor and a test-case list editor inline. Extracting them lets the quiz coding-question editor reuse them exactly instead of re-implementing the same UI.

### Task 10: Extract `FunctionSignatureEditor`

**Files:**
- Create: `src/components/admin/FunctionSignatureEditor.tsx`
- Modify: `src/components/admin/ProblemForm.tsx`

- [ ] **Step 1: Create the extracted component**

The existing inline JSX in `ProblemForm.tsx` (the block starting `{form.type === "DSA" && (` through its closing `)}`, roughly lines 245–322 as of this plan's writing — search for `<h2 className="text-sm font-medium text-foreground">Function signature</h2>` to find it exactly) becomes:

```tsx
"use client";

import { PARAM_TYPES, type FunctionSignature, type ParamType } from "@/lib/functionSignature";

export function FunctionSignatureEditor({
  value,
  onChange,
}: {
  value: FunctionSignature;
  onChange: (next: FunctionSignature) => void;
}) {
  function updateSignature(patch: Partial<FunctionSignature>) {
    onChange({ ...value, ...patch });
  }

  function updateParam(index: number, patch: Partial<{ name: string; type: ParamType }>) {
    onChange({
      ...value,
      params: value.params.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  function addParam() {
    onChange({ ...value, params: [...value.params, { name: "", type: "int" }] });
  }

  function removeParam(index: number) {
    onChange({ ...value, params: value.params.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <h2 className="text-sm font-medium text-foreground">Function signature</h2>
      <p className="mt-1 text-xs text-text-muted">
        Optional. If set, students get a LeetCode-style function stub instead of raw stdin/stdout.
      </p>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-text-muted">Function name</span>
        <input
          value={value.functionName}
          onChange={(e) => updateSignature({ functionName: e.target.value })}
          placeholder="twoSum"
          className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 font-mono text-sm text-foreground sm:max-w-xs"
        />
      </label>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Parameters</span>
          <button
            type="button"
            onClick={addParam}
            className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
          >
            Add parameter
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {value.params.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={p.name}
                onChange={(e) => updateParam(i, { name: e.target.value })}
                placeholder="paramName"
                className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 font-mono text-sm text-foreground sm:flex-1"
              />
              <select
                value={p.type}
                onChange={(e) => updateParam(i, { type: e.target.value as ParamType })}
                className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground sm:w-40"
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {value.params.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParam(i)}
                  className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-text-muted">Return type</span>
        <select
          value={value.returnType}
          onChange={(e) => updateSignature({ returnType: e.target.value as ParamType })}
          className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground sm:max-w-xs"
        >
          {PARAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Use it from `ProblemForm.tsx`**

Add the import:

```ts
import { FunctionSignatureEditor } from "./FunctionSignatureEditor";
```

Replace the entire `{form.type === "DSA" && ( ... )}` block (the function-signature section) with:

```tsx
      {form.type === "DSA" && (
        <FunctionSignatureEditor
          value={form.functionSignature ?? EMPTY_SIGNATURE}
          onChange={(sig) => setForm((p) => ({ ...p, functionSignature: sig }))}
        />
      )}
```

- [ ] **Step 3: Verify it compiles and the form still renders correctly**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/admin/FunctionSignatureEditor.tsx src/components/admin/ProblemForm.tsx`
Expected: no errors.

With the dev server running, visit `http://localhost:3000/admin/problems/new` while logged in as admin, select type "DSA", confirm the Function signature section renders and adding/removing parameters still works exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/FunctionSignatureEditor.tsx src/components/admin/ProblemForm.tsx
git commit -m "refactor: extract FunctionSignatureEditor out of ProblemForm"
```

### Task 11: Extract `TestCaseListEditor`

**Files:**
- Create: `src/components/admin/TestCaseListEditor.tsx`
- Modify: `src/components/admin/ProblemForm.tsx`

- [ ] **Step 1: Create the extracted component**

```tsx
"use client";

export interface TestCaseDraft {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
}

export const EMPTY_TEST_CASE: TestCaseDraft = {
  input: "",
  expectedOutput: "",
  isHidden: false,
  order: 0,
};

export function TestCaseListEditor({
  testCases,
  onChange,
}: {
  testCases: TestCaseDraft[];
  onChange: (next: TestCaseDraft[]) => void;
}) {
  function updateTestCase(index: number, patch: Partial<TestCaseDraft>) {
    onChange(testCases.map((tc, i) => (i === index ? { ...tc, ...patch } : tc)));
  }

  function addTestCase() {
    onChange([...testCases, { ...EMPTY_TEST_CASE, order: testCases.length }]);
  }

  function removeTestCase(index: number) {
    onChange(testCases.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Test cases</h2>
        <button
          type="button"
          onClick={addTestCase}
          className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
        >
          Add test case
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {testCases.map((tc, index) => (
          <div key={index} className="rounded-lg border border-navy-border bg-navy-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-text-muted">Test case {index + 1}</span>
              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTestCase(index)}
                  className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Input</span>
                <textarea
                  required
                  rows={4}
                  value={tc.input}
                  onChange={(e) => updateTestCase(index, { input: e.target.value })}
                  className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Expected output</span>
                <textarea
                  required
                  rows={4}
                  value={tc.expectedOutput}
                  onChange={(e) => updateTestCase(index, { expectedOutput: e.target.value })}
                  className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={tc.isHidden}
                  onChange={(e) => updateTestCase(index, { isHidden: e.target.checked })}
                  className="h-5 w-5"
                />
                Hidden test case
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-muted">
                Order
                <input
                  type="number"
                  value={tc.order}
                  onChange={(e) => updateTestCase(index, { order: Number(e.target.value) })}
                  className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it from `ProblemForm.tsx`**

Remove the local `TestCaseDraft` type and `EMPTY_TEST_CASE` constant from `ProblemForm.tsx` (now imported instead), add:

```ts
import { TestCaseListEditor, EMPTY_TEST_CASE, type TestCaseDraft } from "./TestCaseListEditor";
```

Replace the entire "Test cases" section (`<div>` containing the `<h2>Test cases</h2>` through its closing `</div>`) with:

```tsx
      <TestCaseListEditor
        testCases={form.testCases}
        onChange={(testCases) => setForm((p) => ({ ...p, testCases }))}
      />
```

Also remove the now-unused `updateTestCase`, `addTestCase`, `removeTestCase` functions from `ProblemForm.tsx` — they live in `TestCaseListEditor` now.

- [ ] **Step 3: Verify it compiles and the form still works**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/admin/TestCaseListEditor.tsx src/components/admin/ProblemForm.tsx`
Expected: no errors.

Visit `http://localhost:3000/admin/problems/new`, confirm the Test cases section still renders, add/remove/hidden-checkbox all still work.

- [ ] **Step 4: Full regression check on the admin problem form**

Since this is the second refactor of `ProblemForm.tsx` in this plan, do one end-to-end check: create a new DSA problem through the form (with a function signature and 2 test cases), submit it, confirm it appears at `/admin/problems`, edit it, confirm the edit form is pre-populated correctly, save again.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/TestCaseListEditor.tsx src/components/admin/ProblemForm.tsx
git commit -m "refactor: extract TestCaseListEditor out of ProblemForm"
```

---

## Phase 5: Quiz Validation Schema + Admin CRUD API

### Task 12: `quizSchema.ts`

**Files:**
- Create: `src/lib/quizSchema.ts`

- [ ] **Step 1: Write the schema**

Mirrors `src/lib/problemSchema.ts`'s structure and style exactly:

```ts
import { z } from "zod";
import { functionSignatureSchema } from "./functionSignature";

export const quizTestCaseInputSchema = z.object({
  input: z.string().min(1, "Test case input is required"),
  expectedOutput: z.string().min(1, "Test case expected output is required"),
  isHidden: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});

export const quizMcqOptionInputSchema = z.object({
  text: z.string().min(1, "Option text is required"),
  isCorrect: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});

const baseQuestionFields = {
  order: z.number().int().nonnegative(),
  weight: z.number().int().min(1, "Weight must be at least 1").max(100, "Weight cannot exceed 100"),
};

export const mcqQuestionInputSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("MCQ"),
  prompt: z.string().min(1, "Question prompt is required"),
  mcqScoringMode: z.enum(["ALL_OR_NOTHING", "PROPORTIONAL"]),
  mcqOptions: z
    .array(quizMcqOptionInputSchema)
    .min(2, "MCQ needs at least 2 options")
    .refine((opts) => opts.some((o) => o.isCorrect), "At least one option must be marked correct"),
});

export const descriptiveQuestionInputSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("DESCRIPTIVE"),
  prompt: z.string().min(1, "Question prompt is required"),
  descriptiveMode: z.enum(["SHORT_ANSWER", "LONG_ANSWER"]),
  acceptedKeywords: z.array(z.string()).default([]),
}).refine(
  (q) => q.descriptiveMode !== "SHORT_ANSWER" || q.acceptedKeywords.length > 0,
  { message: "Short-answer questions need at least one accepted keyword", path: ["acceptedKeywords"] }
);

export const codingQuestionInputSchema = z.object({
  ...baseQuestionFields,
  type: z.literal("CODING"),
  description: z.string().min(1, "Coding question description is required"),
  constraints: z.string().optional().nullable(),
  functionSignature: functionSignatureSchema,
  testCases: z.array(quizTestCaseInputSchema).min(1, "At least one test case is required"),
});

export const quizQuestionInputSchema = z.discriminatedUnion("type", [
  mcqQuestionInputSchema,
  descriptiveQuestionInputSchema,
  codingQuestionInputSchema,
]);

export const quizInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  opensAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
  timeLimitMinutes: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().positive().default(1),
  questions: z.array(quizQuestionInputSchema),
});

export type QuizInput = z.infer<typeof quizInputSchema>;
export type QuizQuestionInput = z.infer<typeof quizQuestionInputSchema>;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/quizSchema.ts
git commit -m "feat: quiz input validation schema"
```

### Task 13: `POST`/`GET /api/admin/quizzes`

**Files:**
- Create: `src/app/api/admin/quizzes/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { quizInputSchema } from "@/lib/quizSchema";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  // Quizzes are always created as drafts — publishing happens via PUT, which
  // re-validates weights. Force it here regardless of what the client sent.
  const result = quizInputSchema.safeParse({ ...body, status: "DRAFT" });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body", issues: result.error.issues },
      { status: 400 }
    );
  }

  const { questions, ...quizFields } = result.data;

  const quiz = await prisma.quiz.create({
    data: {
      ...quizFields,
      createdBy: user.userId,
      questions: { create: questions.map((q) => buildQuestionCreateInput(q)) },
    },
    include: { questions: { include: { mcqOptions: true, codingQuestion: { include: { testCases: true } } } } },
  });

  return NextResponse.json({ quiz }, { status: 201 });
}

// Shared with the [id] route's PUT handler.
export function buildQuestionCreateInput(q: import("@/lib/quizSchema").QuizQuestionInput) {
  if (q.type === "MCQ") {
    return {
      order: q.order,
      weight: q.weight,
      type: "MCQ" as const,
      prompt: q.prompt,
      mcqScoringMode: q.mcqScoringMode,
      mcqOptions: { create: q.mcqOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })) },
    };
  }
  if (q.type === "DESCRIPTIVE") {
    return {
      order: q.order,
      weight: q.weight,
      type: "DESCRIPTIVE" as const,
      prompt: q.prompt,
      descriptiveMode: q.descriptiveMode,
      acceptedKeywords: q.acceptedKeywords,
    };
  }
  return {
    order: q.order,
    weight: q.weight,
    type: "CODING" as const,
    codingQuestion: {
      create: {
        description: q.description,
        constraints: q.constraints ?? null,
        functionSignature: q.functionSignature as unknown as Prisma.InputJsonValue,
        testCases: { create: q.testCases.map((tc) => ({ ...tc })) },
      },
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. `functionSignature` is cast to `Prisma.InputJsonValue` the same way `src/app/api/admin/problems/route.ts` casts `Problem.functionSignature` — `Prisma`'s `Json` fields don't accept a plain structural type directly, so this cast is required, not optional.

- [ ] **Step 3: Manual verification**

With the dev server running and logged in as admin (`debug-role=admin` cookie or real admin session):

```bash
curl -s -X POST http://localhost:3000/api/admin/quizzes \
  -H "Content-Type: application/json" \
  -b "session=<your admin session cookie>" \
  -d '{
    "title": "Smoke Test Quiz",
    "description": "temp",
    "maxAttempts": 1,
    "questions": [
      {"type":"MCQ","order":0,"weight":100,"prompt":"2+2?","mcqScoringMode":"ALL_OR_NOTHING",
       "mcqOptions":[{"text":"4","isCorrect":true,"order":0},{"text":"5","isCorrect":false,"order":1}]}
    ]
  }'
```

Expected: `201` with the created quiz including its nested question and MCQ options.

Run: `curl -s http://localhost:3000/api/admin/quizzes -b "session=<cookie>"`
Expected: the quiz appears in the list with `_count.questions: 1`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/quizzes/route.ts
git commit -m "feat: POST/GET /api/admin/quizzes"
```

### Task 14: `GET`/`PUT`/`DELETE /api/admin/quizzes/[id]`

> **Amended post-implementation:** code review caught that the PUT handler as originally specified below blocks ALL edits once a quiz has any attempt — including title/schedule-only changes — contradicting its own error message ("Only title, description, and scheduling can change"). The actual shipped fix (commit `5109981`) fetches the quiz's stored questions (not just the attempt count), compares them against the submitted set via a `questionsUnchanged()` comparator added to `src/lib/quizSchema.ts`, and only rejects when they genuinely differ — when unchanged, the update proceeds but skips the `questions` relation write entirely. `buildQuestionCreateInput` also moved from `src/app/api/admin/quizzes/route.ts` into `src/lib/quizSchema.ts` (a second review finding: importing route-to-route was an avoidable smell). The code block below is left as originally planned for historical reference; **the actual behavior in the codebase is the amended version**, not this one.

**Files:**
- Create: `src/app/api/admin/quizzes/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { quizInputSchema } from "@/lib/quizSchema";
import { weightsSumTo100 } from "@/lib/quizScoring";
import { buildQuestionCreateInput } from "../route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { mcqOptions: { orderBy: { order: "asc" } }, codingQuestion: { include: { testCases: { orderBy: { order: "asc" } } } } },
      },
    },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json({ quiz });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.quiz.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const result = quizInputSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body", issues: result.error.issues },
      { status: 400 }
    );
  }

  const { questions, ...quizFields } = result.data;

  // Editing the question set would cascade-delete any existing attempts'
  // answers (QuizAnswer -> QuizQuestion is onDelete: Cascade). Once a quiz
  // has real attempts, only its metadata (title, window, etc.) can change.
  if (existing._count.attempts > 0) {
    return NextResponse.json(
      {
        error: `This quiz already has ${existing._count.attempts} attempt(s) — its questions can't be edited. Only title, description, and scheduling can change.`,
      },
      { status: 400 }
    );
  }

  if (quizFields.status === "PUBLISHED") {
    if (questions.length === 0) {
      return NextResponse.json({ error: "A quiz needs at least one question to publish" }, { status: 400 });
    }
    if (!weightsSumTo100(questions.map((q) => q.weight))) {
      const total = questions.reduce((sum, q) => sum + q.weight, 0);
      return NextResponse.json({ error: `Question weights must sum to 100 (currently ${total})` }, { status: 400 });
    }
  }

  const quiz = await prisma.quiz.update({
    where: { id },
    data: {
      ...quizFields,
      questions: {
        deleteMany: {},
        create: questions.map((q) => buildQuestionCreateInput(q)),
      },
    },
    include: {
      questions: { include: { mcqOptions: true, codingQuestion: { include: { testCases: true } } } },
    },
  });

  return NextResponse.json({ quiz });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.quiz.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  if (existing._count.attempts > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${existing._count.attempts} student attempt(s) exist for this quiz.` },
      { status: 400 }
    );
  }

  await prisma.quiz.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Export `buildQuestionCreateInput` correctly**

Confirm `src/app/api/admin/quizzes/route.ts` exports `buildQuestionCreateInput` as a named export (done in Task 13, Step 1) — Next.js route files can export additional named functions alongside `GET`/`POST`/etc. without issue since only the HTTP-verb exports are treated specially by the router.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Using the quiz id created in Task 13:

```bash
curl -s http://localhost:3000/api/admin/quizzes/<id> -b "session=<cookie>"
```
Expected: full quiz detail with nested question/options.

```bash
curl -s -X PUT http://localhost:3000/api/admin/quizzes/<id> \
  -H "Content-Type: application/json" -b "session=<cookie>" \
  -d '{"title":"Smoke Test Quiz","description":"temp","maxAttempts":1,"status":"PUBLISHED","questions":[{"type":"MCQ","order":0,"weight":100,"prompt":"2+2?","mcqScoringMode":"ALL_OR_NOTHING","mcqOptions":[{"text":"4","isCorrect":true,"order":0},{"text":"5","isCorrect":false,"order":1}]}]}'
```
Expected: `200`, quiz now has `"status":"PUBLISHED"`.

```bash
curl -s -X PUT http://localhost:3000/api/admin/quizzes/<id> \
  -H "Content-Type: application/json" -b "session=<cookie>" \
  -d '{"title":"Smoke Test Quiz","description":"temp","maxAttempts":1,"status":"PUBLISHED","questions":[{"type":"MCQ","order":0,"weight":50,"prompt":"2+2?","mcqScoringMode":"ALL_OR_NOTHING","mcqOptions":[{"text":"4","isCorrect":true,"order":0},{"text":"5","isCorrect":false,"order":1}]}]}'
```
Expected: `400`, `"error":"Question weights must sum to 100 (currently 50)"`.

```bash
curl -s -X DELETE http://localhost:3000/api/admin/quizzes/<id> -b "session=<cookie>"
```
Expected: `200`, `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/quizzes/'[id]'/route.ts
git commit -m "feat: GET/PUT/DELETE /api/admin/quizzes/[id] with attempt-safety guards"
```

---

## Phase 6: Admin Quiz Authoring UI

### Task 15: `QuizQuestionEditor` component

**Files:**
- Create: `src/components/admin/QuizQuestionEditor.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { FunctionSignatureEditor } from "./FunctionSignatureEditor";
import { TestCaseListEditor, EMPTY_TEST_CASE, type TestCaseDraft } from "./TestCaseListEditor";
import type { FunctionSignature } from "@/lib/functionSignature";

export type QuestionDraft =
  | {
      type: "MCQ";
      order: number;
      weight: number;
      prompt: string;
      mcqScoringMode: "ALL_OR_NOTHING" | "PROPORTIONAL";
      mcqOptions: { text: string; isCorrect: boolean; order: number }[];
    }
  | {
      type: "DESCRIPTIVE";
      order: number;
      weight: number;
      prompt: string;
      descriptiveMode: "SHORT_ANSWER" | "LONG_ANSWER";
      acceptedKeywords: string[];
    }
  | {
      type: "CODING";
      order: number;
      weight: number;
      description: string;
      constraints: string | null;
      functionSignature: FunctionSignature;
      testCases: TestCaseDraft[];
    };

export const EMPTY_MCQ_QUESTION: QuestionDraft = {
  type: "MCQ",
  order: 0,
  weight: 0,
  prompt: "",
  mcqScoringMode: "ALL_OR_NOTHING",
  mcqOptions: [
    { text: "", isCorrect: false, order: 0 },
    { text: "", isCorrect: false, order: 1 },
  ],
};

export const EMPTY_DESCRIPTIVE_QUESTION: QuestionDraft = {
  type: "DESCRIPTIVE",
  order: 0,
  weight: 0,
  prompt: "",
  descriptiveMode: "SHORT_ANSWER",
  acceptedKeywords: [],
};

export const EMPTY_CODING_QUESTION: QuestionDraft = {
  type: "CODING",
  order: 0,
  weight: 0,
  description: "",
  constraints: null,
  functionSignature: { functionName: "", params: [{ name: "", type: "int" }], returnType: "int" },
  testCases: [{ ...EMPTY_TEST_CASE, order: 0 }],
};

export function QuizQuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase text-text-muted">{question.type}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Weight
            <input
              type="number"
              min={0}
              max={100}
              value={question.weight}
              onChange={(e) => onChange({ ...question, weight: Number(e.target.value) } as QuestionDraft)}
              className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            Remove question
          </button>
        </div>
      </div>

      {question.type === "MCQ" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Prompt</span>
            <textarea
              rows={2}
              value={question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-xs text-text-muted">Scoring mode</span>
            <select
              value={question.mcqScoringMode}
              onChange={(e) =>
                onChange({ ...question, mcqScoringMode: e.target.value as "ALL_OR_NOTHING" | "PROPORTIONAL" })
              }
              className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
            >
              <option value="ALL_OR_NOTHING">All or nothing</option>
              <option value="PROPORTIONAL">Proportional partial credit</option>
            </select>
          </label>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Options (check the correct one(s))</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...question,
                    mcqOptions: [...question.mcqOptions, { text: "", isCorrect: false, order: question.mcqOptions.length }],
                  })
                }
                className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
              >
                Add option
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {question.mcqOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        mcqOptions: question.mcqOptions.map((o, j) => (j === i ? { ...o, isCorrect: e.target.checked } : o)),
                      })
                    }
                    className="h-5 w-5"
                  />
                  <input
                    value={opt.text}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        mcqOptions: question.mcqOptions.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)),
                      })
                    }
                    placeholder={`Option ${i + 1}`}
                    className="min-h-[44px] flex-1 rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
                  />
                  {question.mcqOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...question, mcqOptions: question.mcqOptions.filter((_, j) => j !== i) })
                      }
                      className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {question.type === "DESCRIPTIVE" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Prompt</span>
            <textarea
              rows={2}
              value={question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-xs text-text-muted">Grading</span>
            <select
              value={question.descriptiveMode}
              onChange={(e) =>
                onChange({ ...question, descriptiveMode: e.target.value as "SHORT_ANSWER" | "LONG_ANSWER" })
              }
              className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
            >
              <option value="SHORT_ANSWER">Short answer — auto-graded by keyword</option>
              <option value="LONG_ANSWER">Long answer — graded manually</option>
            </select>
          </label>
          {question.descriptiveMode === "SHORT_ANSWER" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Accepted keywords (comma-separated)</span>
              <input
                value={question.acceptedKeywords.join(", ")}
                onChange={(e) =>
                  onChange({
                    ...question,
                    acceptedKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                  })
                }
                placeholder="O(log n), logarithmic"
                className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
              />
            </label>
          )}
        </div>
      )}

      {question.type === "CODING" && (
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Description</span>
            <textarea
              rows={4}
              value={question.description}
              onChange={(e) => onChange({ ...question, description: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <FunctionSignatureEditor
            value={question.functionSignature}
            onChange={(sig) => onChange({ ...question, functionSignature: sig })}
          />
          <TestCaseListEditor
            testCases={question.testCases}
            onChange={(testCases) => onChange({ ...question, testCases })}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/QuizQuestionEditor.tsx
git commit -m "feat: QuizQuestionEditor (MCQ / descriptive / coding sub-forms)"
```

### Task 16: `QuizForm` component

**Files:**
- Create: `src/components/admin/QuizForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuizQuestionEditor,
  EMPTY_MCQ_QUESTION,
  EMPTY_DESCRIPTIVE_QUESTION,
  EMPTY_CODING_QUESTION,
  type QuestionDraft,
} from "./QuizQuestionEditor";

export type QuizFormInitial = {
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  opensAt: string;
  closesAt: string;
  timeLimitMinutes: string;
  maxAttempts: number;
  questions: QuestionDraft[];
};

function defaultState(): QuizFormInitial {
  return {
    title: "",
    description: "",
    status: "DRAFT",
    opensAt: "",
    closesAt: "",
    timeLimitMinutes: "",
    maxAttempts: 1,
    questions: [],
  };
}

export function QuizForm({
  mode,
  quizId,
  initial,
}: {
  mode: "create" | "edit";
  quizId?: string;
  initial?: QuizFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuizFormInitial>(initial ?? defaultState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = form.questions.reduce((sum, q) => sum + (q.weight || 0), 0);

  function addQuestion(template: QuestionDraft) {
    setForm((p) => ({
      ...p,
      questions: [...p.questions, { ...template, order: p.questions.length }],
    }));
  }

  function updateQuestion(index: number, next: QuestionDraft) {
    setForm((p) => ({ ...p, questions: p.questions.map((q, i) => (i === index ? next : q)) }));
  }

  function removeQuestion(index: number) {
    setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== index) }));
  }

  async function submitAs(status: "DRAFT" | "PUBLISHED", e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      title: form.title,
      description: form.description,
      status,
      opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : null,
      closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
      maxAttempts: form.maxAttempts,
      questions: form.questions.map((q, i) => ({ ...q, order: i })),
    };

    const url = mode === "create" ? "/api/admin/quizzes" : `/api/admin/quizzes/${quizId}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed with status ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push("/admin/quizzes");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => submitAs("DRAFT", e)} className="flex w-full flex-col gap-6">
      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-text-muted">Title</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-text-muted">Description</span>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Opens at (optional)</span>
          <input
            type="datetime-local"
            value={form.opensAt}
            onChange={(e) => setForm((p) => ({ ...p, opensAt: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Closes at (optional)</span>
          <input
            type="datetime-local"
            value={form.closesAt}
            onChange={(e) => setForm((p) => ({ ...p, closesAt: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Time limit, minutes (optional)</span>
          <input
            type="number"
            min={1}
            value={form.timeLimitMinutes}
            onChange={(e) => setForm((p) => ({ ...p, timeLimitMinutes: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Max attempts</span>
          <input
            type="number"
            min={1}
            required
            value={form.maxAttempts}
            onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            Questions &middot;{" "}
            <span className={totalWeight === 100 ? "text-mint" : "text-amber"}>{totalWeight}/100 weight</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addQuestion(EMPTY_MCQ_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add MCQ
            </button>
            <button type="button" onClick={() => addQuestion(EMPTY_DESCRIPTIVE_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add descriptive
            </button>
            <button type="button" onClick={() => addQuestion(EMPTY_CODING_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add coding
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-4">
          {form.questions.map((q, i) => (
            <QuizQuestionEditor key={i} question={q} onChange={(next) => updateQuestion(i, next)} onRemove={() => removeQuestion(i)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded border border-navy-border px-4 text-sm font-medium text-foreground transition-colors hover:border-cyan disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={(e) => submitAs("PUBLISHED", e)}
          className="min-h-[44px] rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Publish"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/QuizForm.tsx
git commit -m "feat: QuizForm — full quiz authoring form with live weight total"
```

### Task 17: Admin quiz pages

**Files:**
- Create: `src/app/admin/(protected)/quizzes/page.tsx`
- Create: `src/app/admin/(protected)/quizzes/new/page.tsx`
- Create: `src/app/admin/(protected)/quizzes/[id]/edit/page.tsx`
- Modify: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: List page**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";

export const dynamic = "force-dynamic";

async function getQuizzes() {
  return prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });
}

export default async function AdminQuizzesPage() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const quizzes = await getQuizzes();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin: Quizzes</h1>
          <p className="mt-1 text-sm text-text-muted">
            {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}
          </p>
        </div>
        <Link
          href="/admin/quizzes/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
        >
          New quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <p className="mt-8 text-text-muted">No quizzes yet. Create one to get started.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{quiz.title}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        quiz.status === "PUBLISHED" ? "bg-mint/15 text-mint" : "bg-navy-800 text-text-muted"
                      }`}
                    >
                      {quiz.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {quiz._count.questions} question{quiz._count.questions === 1 ? "" : "s"} &middot;{" "}
                    {quiz._count.attempts} attempt{quiz._count.attempts === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/quizzes/${quiz.id}/attempts`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                  >
                    Attempts
                  </Link>
                  <Link
                    href={`/admin/quizzes/${quiz.id}/edit`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: New quiz page**

```tsx
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizForm } from "@/components/admin/QuizForm";

export default async function NewQuizPage() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">New quiz</h1>
      <div className="mt-6">
        <QuizForm mode="create" />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Edit quiz page**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizForm, type QuizFormInitial } from "@/components/admin/QuizForm";
import type { QuestionDraft } from "@/components/admin/QuizQuestionEditor";
import type { FunctionSignature } from "@/lib/functionSignature";

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { mcqOptions: { orderBy: { order: "asc" } }, codingQuestion: { include: { testCases: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!quiz) notFound();

  const initial: QuizFormInitial = {
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    opensAt: quiz.opensAt ? quiz.opensAt.toISOString().slice(0, 16) : "",
    closesAt: quiz.closesAt ? quiz.closesAt.toISOString().slice(0, 16) : "",
    timeLimitMinutes: quiz.timeLimitMinutes ? String(quiz.timeLimitMinutes) : "",
    maxAttempts: quiz.maxAttempts,
    questions: quiz.questions.map((q): QuestionDraft => {
      if (q.type === "MCQ") {
        return {
          type: "MCQ",
          order: q.order,
          weight: q.weight,
          prompt: q.prompt ?? "",
          mcqScoringMode: q.mcqScoringMode ?? "ALL_OR_NOTHING",
          mcqOptions: q.mcqOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
        };
      }
      if (q.type === "DESCRIPTIVE") {
        return {
          type: "DESCRIPTIVE",
          order: q.order,
          weight: q.weight,
          prompt: q.prompt ?? "",
          descriptiveMode: q.descriptiveMode ?? "SHORT_ANSWER",
          acceptedKeywords: q.acceptedKeywords,
        };
      }
      return {
        type: "CODING",
        order: q.order,
        weight: q.weight,
        description: q.codingQuestion?.description ?? "",
        constraints: q.codingQuestion?.constraints ?? null,
        functionSignature: (q.codingQuestion?.functionSignature as unknown as FunctionSignature) ?? {
          functionName: "",
          params: [{ name: "", type: "int" }],
          returnType: "int",
        },
        testCases: (q.codingQuestion?.testCases ?? []).map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          order: tc.order,
        })),
      };
    }),
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Edit quiz</h1>
      <div className="mt-6">
        <QuizForm mode="edit" quizId={quiz.id} initial={initial} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add "Quizzes" to the admin nav**

In `src/components/admin/AdminNav.tsx`, update the `LINKS` array:

```ts
const LINKS = [
  { href: "/admin/problems", label: "Problems" },
  { href: "/admin/quizzes", label: "Quizzes" },
  { href: "/admin/students", label: "Students" },
] as const;
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/admin/'(protected)'/quizzes src/components/admin/AdminNav.tsx`
Expected: no errors.

- [ ] **Step 6: Manual verification**

With the dev server running, log in as admin, visit `/admin/quizzes` — confirm the "Quizzes" nav link appears and is highlighted, the empty state shows, "New quiz" works, create a quiz with one MCQ question, save as draft, confirm it appears in the list as "Draft" with the right question count, click Edit, confirm the form is pre-populated, add a second question so weights sum to 100, click Publish, confirm status flips to "Published".

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/(protected)/quizzes" src/components/admin/AdminNav.tsx
git commit -m "feat: admin quiz list, create, and edit pages"
```

---

## Phase 7: Student — Quiz List and Starting an Attempt

### Task 18: `POST /api/quizzes/[id]/attempts` (start attempt)

**Files:**
- Create: `src/app/api/quizzes/[id]/attempts/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const now = new Date();
  if (quiz.opensAt && now < quiz.opensAt) {
    return NextResponse.json({ error: "This quiz hasn't opened yet" }, { status: 403 });
  }
  if (quiz.closesAt && now > quiz.closesAt) {
    return NextResponse.json({ error: "This quiz has closed" }, { status: 403 });
  }

  const existingAttempts = await prisma.quizAttempt.findMany({
    where: { quizId: id, userId: user.userId },
    orderBy: { attemptNumber: "desc" },
  });

  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return NextResponse.json({ attempt: inProgress });
  }

  if (existingAttempts.length >= quiz.maxAttempts) {
    return NextResponse.json({ error: "You've used all your attempts for this quiz" }, { status: 403 });
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: id,
      userId: user.userId,
      attemptNumber: existingAttempts.length + 1,
    },
  });

  return NextResponse.json({ attempt }, { status: 201 });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quizzes/[id]/attempts/route.ts"
git commit -m "feat: POST /api/quizzes/[id]/attempts — start (or resume) a quiz attempt"
```

### Task 19: `GET /api/quiz-attempts/[attemptId]` (fetch attempt + questions for taking)

Hides correct-answer info and hidden test cases from the student — this is the payload the taking UI renders from.

**Files:**
- Create: `src/app/api/quiz-attempts/[attemptId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              mcqOptions: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } }, // isCorrect withheld
              codingQuestion: {
                include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  return NextResponse.json({ attempt });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quiz-attempts/[attemptId]/route.ts"
git commit -m "feat: GET /api/quiz-attempts/[attemptId] — attempt detail for the taking UI, correct answers withheld"
```

### Task 20: Student quiz list page

**Files:**
- Create: `src/app/(app)/quizzes/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Write the list page**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QuizListPage() {
  const user = await getSessionUserFromCookies();
  if (!user) return null; // AppLayout already redirects unauthenticated visitors

  const now = new Date();
  const quizzes = await prisma.quiz.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    include: { attempts: { where: { userId: user.userId } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Quizzes</h1>
      <p className="mt-1 text-sm text-text-muted">
        {quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"} available
      </p>

      {quizzes.length === 0 ? (
        <p className="mt-8 text-text-muted">No quizzes available right now.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {quizzes.map((quiz) => {
            const attemptsUsed = quiz.attempts.length;
            const exhausted = attemptsUsed >= quiz.maxAttempts && !quiz.attempts.some((a) => a.status === "IN_PROGRESS");
            return (
              <li key={quiz.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{quiz.title}</span>
                  <span className="text-xs text-text-muted">
                    {attemptsUsed}/{quiz.maxAttempts} attempts used
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-muted">{quiz.description}</p>
                <div className="mt-3">
                  {exhausted ? (
                    <span className="text-xs text-text-muted">No attempts remaining</span>
                  ) : (
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="inline-flex min-h-[44px] items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
                    >
                      {quiz.attempts.some((a) => a.status === "IN_PROGRESS") ? "Resume" : "Start"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add a "Quizzes" link to the student nav**

In `src/app/(app)/layout.tsx`, find:

```tsx
          <Link href="/" className="text-sm font-semibold text-foreground">
            Academic OS
          </Link>
```

Replace with:

```tsx
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold text-foreground">
              Academic OS
            </Link>
            <Link href="/quizzes" className="text-sm text-foreground transition-colors hover:text-cyan">
              Quizzes
            </Link>
          </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/quizzes/page.tsx" "src/app/(app)/layout.tsx"
git commit -m "feat: student quiz list page"
```

---

## Phase 8: Student — Taking a Quiz

### Task 21: `POST /api/quiz-attempts/[attemptId]/submit`

Written before the taking UI so the UI has a real endpoint to call.

**Files:**
- Create: `src/app/api/quiz-attempts/[attemptId]/submit/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { scoreMcq, scoreShortAnswerDescriptive } from "@/lib/quizScoring";
import { quizGradingQueue } from "@/lib/queue";
import { z } from "zod";

const submitBodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionIds: z.array(z.string()).default([]),
      textAnswer: z.string().optional().nullable(),
      codeLanguage: z.enum(["C", "CPP", "JAVA", "PYTHON", "GO"]).optional().nullable(),
      codeSubmission: z.string().optional().nullable(),
    })
  ),
});

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { mcqOptions: true } } } } },
  });

  if (!attempt || attempt.userId !== user.userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "This attempt was already submitted" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const result = submitBodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const isLate = Boolean(
    attempt.quiz.timeLimitMinutes &&
      Date.now() - attempt.startedAt.getTime() > attempt.quiz.timeLimitMinutes * 60_000
  );

  const questionsById = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  const codingAnswerIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { status: "SUBMITTED", submittedAt: new Date(), isLate },
    });

    for (const submitted of result.data.answers) {
      const question = questionsById.get(submitted.questionId);
      if (!question) continue;

      if (question.type === "MCQ") {
        const correctOptionIds = question.mcqOptions.filter((o) => o.isCorrect).map((o) => o.id);
        const autoScore = scoreMcq({
          selectedOptionIds: submitted.selectedOptionIds,
          correctOptionIds,
          scoringMode: question.mcqScoringMode ?? "ALL_OR_NOTHING",
          weight: question.weight,
        });
        await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            selectedOptionIds: submitted.selectedOptionIds,
            autoScore,
            gradingStatus: "GRADED",
          },
        });
      } else if (question.type === "DESCRIPTIVE") {
        const isShortAnswer = question.descriptiveMode === "SHORT_ANSWER";
        const autoScore = isShortAnswer
          ? scoreShortAnswerDescriptive(submitted.textAnswer ?? "", question.acceptedKeywords, question.weight)
          : null;
        await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            textAnswer: submitted.textAnswer ?? "",
            autoScore,
            gradingStatus: isShortAnswer ? "GRADED" : "PENDING",
          },
        });
      } else {
        const answer = await tx.quizAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            codeLanguage: submitted.codeLanguage ?? null,
            codeSubmission: submitted.codeSubmission ?? "",
            gradingStatus: "PENDING",
          },
        });
        codingAnswerIds.push(answer.id);
      }
    }
  });

  for (const quizAnswerId of codingAnswerIds) {
    await quizGradingQueue.add("grade", { quizAnswerId });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The zod schema's `codeLanguage` enum values (`"C"`, `"CPP"`, `"JAVA"`, `"PYTHON"`, `"GO"`) match Prisma's generated `Language` union exactly, so `submitted.codeLanguage` is already assignable to the `codeLanguage` field with no cast needed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quiz-attempts/[attemptId]/submit/route.ts"
git commit -m "feat: POST /api/quiz-attempts/[attemptId]/submit — score MCQ/short-answer synchronously, enqueue coding grading"
```

### Task 22: `QuizWorkspace` component

**Files:**
- Create: `src/components/quiz/QuizWorkspace.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { DSA_LANGUAGES, LANGUAGE_LABELS, MONACO_LANGUAGE_IDS, STARTER_CODE } from "@/components/solve/languageMeta";
import { renderInlineCode } from "@/lib/inlineCode";
import type { Language } from "@/generated/prisma/enums";

interface McqOption {
  id: string;
  text: string;
}

interface AttemptQuestion {
  id: string;
  type: "MCQ" | "DESCRIPTIVE" | "CODING";
  prompt: string | null;
  mcqOptions: McqOption[];
  codingQuestion: { description: string; constraints: string | null } | null;
}

export function QuizWorkspace({
  attemptId,
  quizTitle,
  timeLimitMinutes,
  startedAt,
  questions,
}: {
  attemptId: string;
  quizTitle: string;
  timeLimitMinutes: number | null;
  startedAt: string;
  questions: AttemptQuestion[];
}) {
  const router = useRouter();
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [codeLanguages, setCodeLanguages] = useState<Record<string, Language>>(
    () => Object.fromEntries(questions.filter((q) => q.type === "CODING").map((q) => [q.id, "PYTHON" as Language]))
  );
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(questions.filter((q) => q.type === "CODING").map((q) => [q.id, STARTER_CODE.PYTHON]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = useMemo(() => {
    if (!timeLimitMinutes) return null;
    return new Date(startedAt).getTime() + timeLimitMinutes * 60_000;
  }, [timeLimitMinutes, startedAt]);

  const [remainingMs, setRemainingMs] = useState<number | null>(deadline ? deadline - Date.now() : null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const answers = questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: mcqAnswers[q.id] ?? [],
      textAnswer: textAnswers[q.id] ?? "",
      codeLanguage: q.type === "CODING" ? codeLanguages[q.id] : null,
      codeSubmission: q.type === "CODING" ? codeAnswers[q.id] : null,
    }));

    try {
      const res = await fetch(`/api/quiz-attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed with status ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push(`/quizzes`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        submit();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{quizTitle}</h1>
        {remainingMs !== null && (
          <span className={`text-sm font-medium ${remainingMs < 60_000 ? "text-danger" : "text-amber"}`}>
            {Math.max(0, Math.floor(remainingMs / 60000))}:{String(Math.max(0, Math.floor((remainingMs / 1000) % 60))).padStart(2, "0")} remaining
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
            <div className="text-xs uppercase text-text-muted">
              Question {i + 1} &middot; {q.type}
            </div>

            {q.type === "MCQ" && (
              <div className="mt-2">
                <p className="text-sm text-foreground">{renderInlineCode(q.prompt ?? "")}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {q.mcqOptions.map((opt) => {
                    const selected = mcqAnswers[q.id] ?? [];
                    const checked = selected.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setMcqAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.checked
                                ? [...(prev[q.id] ?? []), opt.id]
                                : (prev[q.id] ?? []).filter((id) => id !== opt.id),
                            }))
                          }
                          className="h-5 w-5"
                        />
                        {opt.text}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {q.type === "DESCRIPTIVE" && (
              <div className="mt-2">
                <p className="text-sm text-foreground">{renderInlineCode(q.prompt ?? "")}</p>
                <textarea
                  rows={4}
                  value={textAnswers[q.id] ?? ""}
                  onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="mt-2 w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
                />
              </div>
            )}

            {q.type === "CODING" && q.codingQuestion && (
              <div className="mt-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">{renderInlineCode(q.codingQuestion.description)}</p>
                {q.codingQuestion.constraints && (
                  <p className="mt-2 text-xs text-text-muted">{renderInlineCode(q.codingQuestion.constraints)}</p>
                )}
                <select
                  value={codeLanguages[q.id]}
                  onChange={(e) => {
                    const lang = e.target.value as Language;
                    setCodeLanguages((prev) => ({ ...prev, [q.id]: lang }));
                    setCodeAnswers((prev) => ({ ...prev, [q.id]: STARTER_CODE[lang] }));
                  }}
                  className="select-field mt-3 min-h-[44px] rounded border border-navy-border bg-navy-950 px-2 text-sm text-foreground"
                >
                  {DSA_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {LANGUAGE_LABELS[lang]}
                    </option>
                  ))}
                </select>
                <div className="mt-2 h-[300px]">
                  <Editor
                    height="100%"
                    language={MONACO_LANGUAGE_IDS[codeLanguages[q.id]]}
                    theme="vs-dark"
                    value={codeAnswers[q.id]}
                    onChange={(v) => setCodeAnswers((prev) => ({ ...prev, [q.id]: v ?? "" }))}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-6 min-h-[44px] w-full rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Quiz"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If `STARTER_CODE[lang]` complains because `STARTER_CODE` includes a `SQL` key not in `DSA_LANGUAGES`, that's fine structurally — `Record<Language, string>` indexed by a `Language`-typed variable is valid regardless of which subset is iterated.)

- [ ] **Step 3: Commit**

```bash
git add src/components/quiz/QuizWorkspace.tsx
git commit -m "feat: QuizWorkspace — single-page quiz-taking UI with timer"
```

### Task 23: Quiz-taking page

**Files:**
- Create: `src/app/(app)/quizzes/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { QuizWorkspace } from "@/components/quiz/QuizWorkspace";

export const dynamic = "force-dynamic";

export default async function TakeQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz || quiz.status !== "PUBLISHED") notFound();

  let attempt = await prisma.quizAttempt.findFirst({
    where: { quizId: id, userId: user.userId, status: "IN_PROGRESS" },
  });

  if (!attempt) {
    const attemptCount = await prisma.quizAttempt.count({ where: { quizId: id, userId: user.userId } });
    if (attemptCount >= quiz.maxAttempts) {
      return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          <p className="text-text-muted">You&apos;ve used all your attempts for this quiz.</p>
        </main>
      );
    }
    attempt = await prisma.quizAttempt.create({
      data: { quizId: id, userId: user.userId, attemptNumber: attemptCount + 1 },
    });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-text-muted">Submitted — waiting for results.</p>
      </main>
    );
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: id },
    orderBy: { order: "asc" },
    include: {
      mcqOptions: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } },
      codingQuestion: { select: { description: true, constraints: true } },
    },
  });

  return (
    <QuizWorkspace
      attemptId={attempt.id}
      quizTitle={quiz.title}
      timeLimitMinutes={quiz.timeLimitMinutes}
      startedAt={attempt.startedAt.toISOString()}
      questions={questions}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification**

With `docker compose up -d`, `npm run worker`, and `npm run dev` all running: log in as `student1` / `password123`, visit `/quizzes`, start the smoke-test quiz created earlier (recreate it via the admin UI if it was deleted during Task 14's manual verification), answer the MCQ, click Submit Quiz, confirm it redirects to `/quizzes` and the quiz now shows "Resume" is gone / attempts-used incremented.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/quizzes/[id]/page.tsx"
git commit -m "feat: quiz-taking page — starts/resumes an attempt and renders QuizWorkspace"
```

---

## Phase 9: Admin — Grading and Finalizing Attempts

### Task 24: `GET`/`PUT /api/admin/quiz-attempts/[attemptId]`

**Files:**
- Create: `src/app/api/admin/quiz-attempts/[attemptId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { z } from "zod";

type RouteParams = { params: Promise<{ attemptId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, studentId: true } },
      quiz: { select: { title: true } },
      answers: {
        include: {
          question: {
            include: { mcqOptions: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  return NextResponse.json({ attempt });
}

const overrideBodySchema = z.object({
  questionId: z.string(),
  overriddenScore: z.number(),
});

export async function PUT(req: Request, { params }: RouteParams) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const result = overrideBodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const answer = await prisma.quizAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId: result.data.questionId } },
  });
  if (!answer) {
    return NextResponse.json({ error: "Answer not found" }, { status: 404 });
  }

  const updated = await prisma.quizAnswer.update({
    where: { id: answer.id },
    data: { overriddenScore: result.data.overriddenScore, gradingStatus: "GRADED" },
  });

  return NextResponse.json({ answer: updated });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. `attemptId_questionId` is Prisma's default generated name for the unnamed compound unique `@@unique([attemptId, questionId])` from Task 2 (fields joined by `_` in declared order) — no schema change needed for this to resolve correctly.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/quiz-attempts/[attemptId]/route.ts"
git commit -m "feat: GET/PUT /api/admin/quiz-attempts/[attemptId] — review detail and score overrides"
```

### Task 25: `POST /api/admin/quiz-attempts/[attemptId]/finalize`

**Files:**
- Create: `src/app/api/admin/quiz-attempts/[attemptId]/finalize/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status === "FINALIZED") {
    return NextResponse.json({ error: "Already finalized" }, { status: 400 });
  }
  if (attempt.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Attempt hasn't been submitted yet" }, { status: 400 });
  }

  const pending = attempt.answers.filter((a) => a.gradingStatus === "PENDING");
  if (pending.length > 0) {
    return NextResponse.json(
      { error: `${pending.length} question(s) still need grading before this can be finalized` },
      { status: 400 }
    );
  }

  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });

  return NextResponse.json({ attempt: updated });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/quiz-attempts/[attemptId]/finalize/route.ts"
git commit -m "feat: POST /api/admin/quiz-attempts/[attemptId]/finalize"
```

### Task 26: Admin attempts list + review/finalize page

**Files:**
- Create: `src/app/admin/(protected)/quizzes/[id]/attempts/page.tsx`
- Create: `src/components/admin/QuizAttemptReview.tsx`
- Create: `src/app/admin/(protected)/quizzes/[id]/attempts/[attemptId]/page.tsx`

- [ ] **Step 1: Attempts list page**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";

export const dynamic = "force-dynamic";

export default async function QuizAttemptsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { title: true } });
  if (!quiz) notFound();

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: id },
    orderBy: { startedAt: "desc" },
    include: { user: { select: { name: true, studentId: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">{quiz.title} &middot; Attempts</h1>
      <p className="mt-1 text-sm text-text-muted">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</p>

      {attempts.length === 0 ? (
        <p className="mt-8 text-text-muted">No one has attempted this quiz yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {attempts.map((attempt) => (
            <li key={attempt.id} className="flex items-center justify-between rounded-lg border border-navy-border bg-navy-900 px-4 py-3">
              <div>
                <span className="font-medium text-foreground">{attempt.user.name}</span>
                <span className="ml-2 text-xs text-text-muted">{attempt.user.studentId}</span>
                {attempt.isLate && <span className="ml-2 rounded bg-amber/15 px-2 py-0.5 text-xs text-amber">Late</span>}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    attempt.status === "FINALIZED" ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"
                  }`}
                >
                  {attempt.status === "FINALIZED" ? "Finalized" : attempt.status === "SUBMITTED" ? "Submitted" : "In progress"}
                </span>
                <Link
                  href={`/admin/quizzes/${id}/attempts/${attempt.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground transition-colors hover:border-cyan hover:text-cyan"
                >
                  Review
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: `QuizAttemptReview` client component**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AnswerDetail {
  id: string;
  questionId: string;
  autoScore: number | null;
  overriddenScore: number | null;
  gradingStatus: "PENDING" | "GRADED";
  textAnswer: string | null;
  codeSubmission: string | null;
  question: { type: "MCQ" | "DESCRIPTIVE" | "CODING"; prompt: string | null; weight: number };
}

export function QuizAttemptReview({
  attemptId,
  status,
  answers,
}: {
  attemptId: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "FINALIZED";
  answers: AnswerDetail[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(answers.map((a) => [a.questionId, a.overriddenScore ?? a.autoScore ?? 0]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveOverride(questionId: string) {
    setSaving(questionId);
    await fetch(`/api/admin/quiz-attempts/${attemptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, overriddenScore: scores[questionId] }),
    });
    setSaving(null);
    router.refresh();
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    const res = await fetch(`/api/admin/quiz-attempts/${attemptId}/finalize`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to finalize");
      setFinalizing(false);
      return;
    }
    router.refresh();
  }

  const hasPending = answers.some((a) => a.gradingStatus === "PENDING");
  const total = answers.reduce((sum, a) => sum + (a.overriddenScore ?? a.autoScore ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
        <span className="text-sm text-text-muted">Current total: </span>
        <span className="text-lg font-semibold text-foreground">{total}/100</span>
      </div>

      {answers.map((a) => (
        <div key={a.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-text-muted">
              {a.question.type} &middot; weight {a.question.weight}
            </span>
            {a.gradingStatus === "PENDING" && (
              <span className="rounded bg-amber/15 px-2 py-0.5 text-xs text-amber">Pending review</span>
            )}
          </div>
          {a.question.prompt && <p className="mt-2 text-sm text-foreground">{a.question.prompt}</p>}
          {a.textAnswer && (
            <p className="mt-2 whitespace-pre-wrap rounded border border-navy-border bg-navy-950 p-3 text-sm text-text">
              {a.textAnswer}
            </p>
          )}
          {a.codeSubmission && (
            <pre className="mt-2 overflow-x-auto rounded border border-navy-border bg-navy-950 p-3 text-xs text-text">
              {a.codeSubmission}
            </pre>
          )}
          <div className="mt-3 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              Score
              <input
                type="number"
                min={0}
                max={a.question.weight}
                value={scores[a.questionId]}
                onChange={(e) => setScores((prev) => ({ ...prev, [a.questionId]: Number(e.target.value) }))}
                className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
              />
              / {a.question.weight}
            </label>
            <button
              onClick={() => saveOverride(a.questionId)}
              disabled={saving === a.questionId}
              className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan disabled:opacity-50"
            >
              {saving === a.questionId ? "Saving…" : "Save score"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      {status !== "FINALIZED" && (
        <button
          onClick={finalize}
          disabled={hasPending || finalizing}
          className="min-h-[44px] w-fit rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          title={hasPending ? "Every question needs a score before finalizing" : undefined}
        >
          {finalizing ? "Finalizing…" : "Finalize"}
        </button>
      )}
      {status === "FINALIZED" && <p className="text-sm text-mint">Finalized — visible to the student.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Review page**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizAttemptReview } from "@/components/admin/QuizAttemptReview";

export const dynamic = "force-dynamic";

export default async function QuizAttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, studentId: true } },
      quiz: { select: { title: true } },
      answers: { include: { question: { select: { type: true, prompt: true, weight: true } } } },
    },
  });
  if (!attempt) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">
        {attempt.quiz.title} &middot; {attempt.user.name}
      </h1>
      <p className="mt-1 text-sm text-text-muted">{attempt.user.studentId}</p>

      <div className="mt-6">
        <QuizAttemptReview attemptId={attempt.id} status={attempt.status} answers={attempt.answers} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual end-to-end verification**

As admin, visit `/admin/quizzes/<id>/attempts`, confirm the submitted attempt from Task 23's verification appears with status "Submitted". Click Review, confirm the MCQ answer shows with its auto-computed score, adjust the score and click "Save score", confirm it persists after a refresh, click Finalize, confirm status becomes "Finalized".

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(protected)/quizzes/[id]/attempts" src/components/admin/QuizAttemptReview.tsx
git commit -m "feat: admin attempt list, review, and finalize UI"
```

---

## Phase 10: Student — Viewing Results

### Task 27: Result page

**Files:**
- Create: `src/app/(app)/quizzes/[id]/attempts/[attemptId]/result/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { effectiveScore } from "@/lib/quizScoring";

export const dynamic = "force-dynamic";

export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await getSessionUserFromCookies();
  if (!user) notFound();

  const { attemptId } = await params;
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { select: { title: true } },
      answers: {
        include: {
          question: {
            include: { mcqOptions: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== user.userId) notFound();

  if (attempt.status !== "FINALIZED") {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-text-muted">Submitted — waiting for results.</p>
      </main>
    );
  }

  const total = attempt.answers.reduce((sum, a) => sum + effectiveScore(a.autoScore, a.overriddenScore), 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">{attempt.quiz.title} &middot; Result</h1>
      <p className="mt-1 text-2xl font-semibold text-mint">{total}/100</p>

      <div className="mt-6 flex flex-col gap-4">
        {attempt.answers.map((a) => {
          const score = effectiveScore(a.autoScore, a.overriddenScore);
          const correctOptions = a.question.mcqOptions.filter((o) => o.isCorrect).map((o) => o.text);
          return (
            <div key={a.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-text-muted">{a.question.type}</span>
                <span className="text-sm font-medium text-foreground">
                  {score}/{a.question.weight}
                </span>
              </div>
              {a.question.prompt && <p className="mt-2 text-sm text-foreground">{a.question.prompt}</p>}
              {correctOptions.length > 0 && (
                <p className="mt-2 text-xs text-text-muted">Correct answer: {correctOptions.join(", ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification**

As `student1`, visit `/quizzes/<quizId>/attempts/<attemptId>/result` for the attempt finalized in Task 26 — confirm the total score and per-question breakdown render, including the correct MCQ answer.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/quizzes/[id]/attempts/[attemptId]/result/page.tsx"
git commit -m "feat: student quiz result page"
```

---

## Phase 11: Seed Data and Final Verification

### Task 28: Seed an example quiz

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add a seeded quiz**

Add near the end of `main()` in `prisma/seed.ts`, before the final `console.log`:

```ts
  const existingQuiz = await prisma.quiz.findFirst({ where: { title: "Arrays & Basics Quiz" } });
  if (!existingQuiz) {
    await prisma.quiz.create({
      data: {
        title: "Arrays & Basics Quiz",
        description: "A short mixed quiz covering array fundamentals.",
        status: "PUBLISHED",
        maxAttempts: 2,
        createdBy: adminId,
        questions: {
          create: [
            {
              order: 0,
              weight: 30,
              type: "MCQ",
              prompt: "What is the time complexity of binary search on a sorted array?",
              mcqScoringMode: "ALL_OR_NOTHING",
              mcqOptions: {
                create: [
                  { text: "O(n)", isCorrect: false, order: 0 },
                  { text: "O(log n)", isCorrect: true, order: 1 },
                  { text: "O(n^2)", isCorrect: false, order: 2 },
                  { text: "O(1)", isCorrect: false, order: 3 },
                ],
              },
            },
            {
              order: 1,
              weight: 20,
              type: "DESCRIPTIVE",
              prompt: "In one sentence, what makes binary search possible?",
              descriptiveMode: "SHORT_ANSWER",
              acceptedKeywords: ["sorted"],
            },
            {
              order: 2,
              weight: 50,
              type: "CODING",
              codingQuestion: {
                create: {
                  description: "Given an array of integers `nums`, return the maximum value in the array.",
                  functionSignature: { functionName: "findMax", params: [{ name: "nums", type: "int[]" }], returnType: "int" },
                  testCases: {
                    create: [
                      { input: "3 1 4 1 5", expectedOutput: "5", isHidden: false, order: 0 },
                      { input: "-1 -2 -3", expectedOutput: "-1", isHidden: false, order: 1 },
                      { input: "7", expectedOutput: "7", isHidden: true, order: 2 },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    });
    console.log("Seeded quiz: Arrays & Basics Quiz");
  }
```

This references `adminId`, already defined earlier in `main()` from Task-independent existing code (`bootstrapAdmin()`'s return value).

- [ ] **Step 2: Run the seed and verify**

Run: `npm run db:seed`
Expected: `Seeded quiz: Arrays & Basics Quiz` in the output (or nothing if re-run, since it's idempotent via the `existingQuiz` check).

Run:
```bash
docker exec bros-code-postgres-1 psql -U judge -d judge -tAc "SELECT title, status FROM \"Quiz\";"
```
Expected: `Arrays & Basics Quiz|PUBLISHED`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed an example quiz for manual testing"
```

### Task 29: Full end-to-end verification pass

**Files:** none — verification only.

- [ ] **Step 1: Typecheck and lint the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all `quizScoring.test.ts` cases pass (19 tests from Phase 2).

- [ ] **Step 3: Full manual walkthrough with all services running**

`docker compose up -d`, `npm run worker`, `npm run dev` all running.

1. As admin: visit `/admin/quizzes`, confirm "Arrays & Basics Quiz" is listed as Published with 3 questions.
2. As `student1`: visit `/quizzes`, start "Arrays & Basics Quiz", answer the MCQ correctly, the descriptive question with "it's sorted", and the coding question with a correct `findMax` implementation in Python. Submit.
3. Wait a few seconds for the BullMQ worker to grade the coding answer (check `npm run worker`'s terminal for a `quiz answer ... graded` log line).
4. As admin: visit the attempt's review page, confirm the MCQ shows 30/30, the descriptive shows 20/20 (keyword matched), and the coding question shows a score reflecting test cases passed (50/50 if the implementation was correct and all 3 test cases passed). Click Finalize.
5. As `student1`: visit the result page, confirm the total score and per-question breakdown match what the admin saw.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin sohanraj-quiz-engine
```

---

## Self-Review Notes

- **Spec coverage:** every section of `2026-07-18-quiz-engine-design.md` maps to at least one task — data model (Task 2), MCQ/descriptive/coding scoring (Tasks 3–6, 21), coding reuse via `gradeDsa` (Tasks 7–9), admin authoring incl. weight validation (Tasks 12–17), attempt lifecycle incl. late-submission flagging and the attempt-count/window guards (Tasks 18, 21), finalize-gates-visibility (Tasks 24–27), and the shared-editor refactor (Tasks 10–11).
- **Type consistency verified:** `GradableTestCase` (Task 7) is the type both `Problem.testCases` and `QuizCodingQuestion.testCases` satisfy structurally, used identically in Task 9's `processQuizAnswer` and the existing `processSubmission`. `QuestionDraft` (Task 15) is the single shape threaded through `QuizQuestionEditor`, `QuizForm`, the create and edit pages (Tasks 16–17), and the submit payload's question typing (Task 21) — same field names throughout (`mcqOptions`, `mcqScoringMode`, `descriptiveMode`, `acceptedKeywords`, `functionSignature`, `testCases`).
- **No placeholders:** every step has complete, runnable code or an exact shell command with expected output.
