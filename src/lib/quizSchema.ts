import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
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

/** Shared by the admin quiz create (POST) and update (PUT) routes. */
export function buildQuestionCreateInput(q: QuizQuestionInput) {
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

/** DB-fetched question shape, as returned by the GET/PUT routes' `include`. */
export interface StoredQuestion {
  type: "MCQ" | "DESCRIPTIVE" | "CODING";
  order: number;
  weight: number;
  prompt: string | null;
  mcqScoringMode: "ALL_OR_NOTHING" | "PROPORTIONAL" | null;
  descriptiveMode: "SHORT_ANSWER" | "LONG_ANSWER" | null;
  acceptedKeywords: string[];
  mcqOptions: { text: string; isCorrect: boolean; order: number }[];
  codingQuestion: {
    description: string;
    constraints: string | null;
    functionSignature: unknown;
    testCases: { input: string; expectedOutput: string; isHidden: boolean; order: number }[];
  } | null;
}

/** Canonical, comparable shape for both a submitted question and a stored one. */
function canonicalizeQuestion(q: QuizQuestionInput | StoredQuestion): unknown {
  const base = { type: q.type, order: q.order, weight: q.weight };
  if (q.type === "MCQ") {
    return {
      ...base,
      prompt: q.prompt,
      mcqScoringMode: q.mcqScoringMode,
      mcqOptions: q.mcqOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
    };
  }
  if (q.type === "DESCRIPTIVE") {
    return { ...base, prompt: q.prompt, descriptiveMode: q.descriptiveMode, acceptedKeywords: q.acceptedKeywords };
  }
  // CODING — submitted input is flat, stored rows nest under `codingQuestion`.
  const coding = "codingQuestion" in q ? q.codingQuestion : q;
  return {
    ...base,
    description: coding?.description,
    constraints: coding?.constraints ?? null,
    functionSignature: coding?.functionSignature,
    testCases: (coding?.testCases ?? []).map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden,
      order: tc.order,
    })),
  };
}

/**
 * Deterministic JSON serialization that sorts object keys — plain
 * JSON.stringify is insertion-order-dependent, but Postgres `jsonb` columns
 * (e.g. QuizCodingQuestion.functionSignature) don't preserve the key order
 * they were written with, so a submitted object and its own just-fetched
 * round-trip can stringify differently even when semantically identical.
 * Array element order is preserved (it's meaningful — e.g. function params).
 */
function canonicalJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * True if a submitted question set is identical (order included) to what's
 * already stored — used to allow metadata-only quiz edits (title, schedule,
 * etc.) once a quiz has real attempts, without permitting the destructive
 * delete+recreate of `questions` that would cascade-delete those attempts'
 * answers.
 */
export function questionsUnchanged(submitted: QuizQuestionInput[], stored: StoredQuestion[]): boolean {
  if (submitted.length !== stored.length) return false;
  return submitted.every(
    (q, i) => canonicalJsonStringify(canonicalizeQuestion(q)) === canonicalJsonStringify(canonicalizeQuestion(stored[i]))
  );
}
