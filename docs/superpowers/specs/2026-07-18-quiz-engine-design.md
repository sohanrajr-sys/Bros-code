# Quiz Engine — Design

## Summary

Adds a quiz system on top of the existing Academic OS platform: admins build quizzes out of three question types — MCQ, descriptive (short-answer or long-answer), and coding — assign each question a percentage weight, and students take quizzes for a score. Coding questions reuse the existing function-signature codegen and Piston execution infrastructure (`src/lib/codegen`, `src/lib/piston.ts`, `src/lib/functionSignature.ts`) but through entirely new tables, independent of the existing `Problem`/`TestCase` bank — a deliberate choice to keep quiz content isolated from the general problem bank rather than reusing/aliasing it.

## Goals

- Admin authors quizzes containing any mix of MCQ, descriptive, and coding questions, each with an admin-set weight (percentage points; must sum to 100 to publish).
- MCQ supports single- or multi-select, with a per-question choice of all-or-nothing vs. proportional partial-credit scoring.
- Descriptive questions are either short-answer (auto-graded via keyword match) or long-answer (manual grading only), chosen per-question by the admin.
- Coding questions are authored inline (not referencing the existing `Problem` bank), with the same function-signature stub + hidden/shown test-case model as today's DSA problems, graded through Piston the same way.
- Admin controls quiz availability: draft/published status, an optional open/close datetime window, an optional time limit per attempt, and a max-attempts count.
- No student sees any score until an admin explicitly finalizes their attempt — true even for quizzes with nothing requiring manual grading.
- Admin can override any auto-computed score (MCQ, coding, or short-answer descriptive) before finalizing, not just grade the long-answer ones.

## Non-Goals

- Referencing the existing `Problem` bank from a quiz coding question (explicitly rejected in favor of full isolation).
- Auto-grading long-answer descriptive questions in any form (NLP scoring, similarity matching, etc.) — always manual.
- Partial-credit formulas for anything other than multi-select MCQ (proportional scoring is MCQ-only).
- Bulk/automatic finalization — every attempt requires an explicit admin action, regardless of question mix.
- Question banks/reuse across quizzes — each quiz's questions belong to that quiz only (mirrors how quiz coding questions are isolated from `Problem`).

## Data Model

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

model Quiz {
  id                String      @id @default(cuid())
  title             String
  description       String
  status            QuizStatus  @default(DRAFT)
  opensAt           DateTime?
  closesAt          DateTime?
  timeLimitMinutes  Int?
  maxAttempts       Int         @default(1)
  createdBy         String
  createdByUser     User        @relation("QuizCreatedBy", fields: [createdBy], references: [id])
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  questions QuizQuestion[]
  attempts  QuizAttempt[]
}

model QuizQuestion {
  id     String           @id @default(cuid())
  quizId String
  order  Int
  type   QuizQuestionType
  weight Int              // percentage points; a quiz's questions must sum to 100 to publish

  // MCQ-only
  mcqScoringMode McqScoringMode?

  // Descriptive-only
  descriptiveMode   DescriptiveMode?
  acceptedKeywords  String[]        // used only when descriptiveMode == SHORT_ANSWER
  prompt            String?         // question text for descriptive/MCQ (coding uses QuizCodingQuestion.description instead)

  quiz          Quiz               @relation(fields: [quizId], references: [id], onDelete: Cascade)
  mcqOptions    QuizMcqOption[]
  codingQuestion QuizCodingQuestion?
  answers       QuizAnswer[]

  @@index([quizId])
}

model QuizMcqOption {
  id         String       @id @default(cuid())
  questionId String
  text       String
  isCorrect  Boolean      @default(false)
  order      Int

  question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
}

model QuizCodingQuestion {
  id                String  @id @default(cuid())
  questionId        String  @unique
  description       String
  constraints       String?
  functionSignature Json    // same shape as Problem.functionSignature — src/lib/functionSignature.ts

  question  QuizQuestion         @relation(fields: [questionId], references: [id], onDelete: Cascade)
  testCases QuizCodingTestCase[]
}

model QuizCodingTestCase {
  id             String  @id @default(cuid())
  codingQuestionId String
  input          String
  expectedOutput String
  isHidden       Boolean @default(false)
  order          Int

  codingQuestion QuizCodingQuestion @relation(fields: [codingQuestionId], references: [id], onDelete: Cascade)

  @@index([codingQuestionId])
}

model QuizAttempt {
  id            String            @id @default(cuid())
  quizId        String
  userId        String
  attemptNumber Int
  status        QuizAttemptStatus @default(IN_PROGRESS)
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
  id         String        @id @default(cuid())
  attemptId  String
  questionId String

  // exactly one of these is populated, depending on the question's type
  selectedOptionIds String[]  // MCQ
  textAnswer        String?   // descriptive
  codeLanguage      Language? // coding
  codeSubmission    String?   // coding

  autoScore      Float?         // computed score, null until graded
  overriddenScore Float?        // admin override, takes precedence over autoScore when set
  gradingStatus  GradingStatus  @default(PENDING)

  attempt  QuizAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([attemptId])
  @@index([questionId])
}
```

Adds `createdQuizzes Quiz[] @relation("QuizCreatedBy")` and `quizAttempts QuizAttempt[]` to `User`, mirroring the existing `createdProblems`/`submissions` relations.

`effectiveScore` for a `QuizAnswer` is `overriddenScore ?? autoScore ?? 0` — computed at read time, not stored redundantly.

## Grading

**Synchronous at submit time** (no sandbox involved):
- MCQ: compare `selectedOptionIds` against the question's correct-option set.
  - `ALL_OR_NOTHING`: exact set match → full `weight`, else `0`.
  - `PROPORTIONAL`: `max(0, correctPicks - wrongPicks) / totalCorrectOptions * weight`.
- Descriptive, `SHORT_ANSWER`: case-insensitive substring match of `textAnswer` against any entry in `acceptedKeywords` → full `weight` on any match, else `0`.
- Descriptive, `LONG_ANSWER`: `gradingStatus` stays `PENDING`, `autoScore` stays `null`. Only an admin's `overriddenScore` entry grades it.

**Asynchronous, via the existing BullMQ worker**:
- Coding questions enqueue a new job type alongside the existing DSA grading job. The job handler is a thin sibling to `src/worker/graders/dsa.ts` — same shape, but its Prisma queries target `QuizCodingQuestion`/`QuizCodingTestCase` instead of `Problem`/`TestCase`, and it writes to `QuizAnswer.autoScore` instead of `Submission.results`. It calls `getCodegen`/`runPistonSubmission` exactly as `dsa.ts` does today — those functions don't know about `Problem` at all, so nothing about them changes.
- Score: `(test cases passed / total test cases) * weight`, matching the existing platform's "score based on number of test cases" behavior (hidden and shown cases both count; shown cases are just the ones visible to the student while solving).

## Attempt Lifecycle

1. Student starts a quiz (blocked if `maxAttempts` already used, or outside `opensAt`/`closesAt`) → new `QuizAttempt(IN_PROGRESS)`.
2. If `timeLimitMinutes` is set, a client-side countdown starts from `startedAt`. Server validates elapsed time on submit but accepts a late submission rather than silently dropping it (a dropped connection near the deadline shouldn't cost a student their only attempt) — a late submission is just flagged for the admin's awareness on the review screen, not rejected.
3. Submit (manual or timer-triggered auto-submit) → `QuizAttempt(SUBMITTED)`. MCQ and short-answer descriptive answers score immediately; coding answers enqueue grading jobs.
4. The attempt is **never visible to the student** while `SUBMITTED` — even if every question auto-graded successfully. An admin must open the attempt's review screen and click **Finalize**.
5. Review screen (`/admin/quizzes/[id]/attempts/[attemptId]`): every question listed with its current `effectiveScore`, an editable input next to each (writes `overriddenScore` when changed, works identically for MCQ/coding/descriptive). Finalize is disabled while any `QuizAnswer` is `gradingStatus: PENDING` (i.e., an ungraded long-answer question, or a coding job that hasn't returned yet).
6. Finalize → `QuizAttempt(FINALIZED)`, `finalizedAt` set. Student can now see: total score (sum of `effectiveScore` across answers), and a per-question breakdown (their answer, the score they earned, and for MCQ, which options were actually correct).

## Admin UX

- `/admin/quizzes` — list page mirroring `/admin/problems`: title, status badge, question count, attempt count, Edit link.
- `/admin/quizzes/new` and `/admin/quizzes/[id]/edit` — quiz form: title, description, `opensAt`/`closesAt` (optional datetime inputs), `timeLimitMinutes` (optional), `maxAttempts`.
  - Question builder inside the form: add MCQ / Descriptive / Coding questions, reorder, set weight per question.
  - Coding question editor reuses the function-signature + test-case UI already built in `src/components/admin/ProblemForm.tsx`, factored into a shared component (`FunctionSignatureEditor` + `TestCaseListEditor`) since the shape is identical to what `Problem` already has — this is the one piece of existing code this feature refactors, not duplicates.
  - Live-updating weight total; Publish is blocked (with an inline error) until weights sum to exactly 100. Draft saves are unrestricted.
- `/admin/quizzes/[id]/attempts` — list of attempts for a quiz: student, submitted-at, status (Submitted / Finalized).
- `/admin/quizzes/[id]/attempts/[attemptId]` — the grading/review screen described in the lifecycle above.

## Student UX

- `/quizzes` — list of `PUBLISHED` quizzes currently within their window (or with no window set), showing attempts-used/`maxAttempts`.
- `/quizzes/[id]` — single scrollable page (not a paginated wizard) with every question rendered in order: MCQ as radio (single-select) or checkbox (multi-select) groups, descriptive as a textarea, coding as an inline Monaco editor identical to the existing solve page's editor, same language dropdown. One "Submit Quiz" button at the bottom. A countdown banner if `timeLimitMinutes` is set, auto-submitting at zero.
- Post-submit: "Submitted — waiting for results," no score or answer feedback, until `FINALIZED`.
- `/quizzes/[id]/attempts/[attemptId]/result` (visible only once `FINALIZED`) — total score and the per-question breakdown described above.

## Open Questions / Future Work

- Whether `acceptedKeywords` matching should support simple wildcards or stay pure substring match — starting with substring-only since that's the simplest thing that satisfies "keyword auto-grading."
- No question bank/reuse across quizzes in this version — every question, including coding ones, is authored fresh per quiz.
- No partial credit for coding questions beyond the existing test-case fraction (e.g. no separate credit for compiling but failing all tests) — matches how the DSA grader already works.
