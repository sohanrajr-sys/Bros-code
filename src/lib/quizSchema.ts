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
